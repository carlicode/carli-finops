#!/bin/bash
# Carli FinOps — Full deployment script
# Usage: TELEGRAM_BOT_TOKEN=<token> ./scripts/deploy.sh
#
# Required env vars:
#   TELEGRAM_BOT_TOKEN   — from @BotFather
#   COGNITO_PASSWORD     — initial password for the 'carli' user (default: auto-generated)
#
# Optional env vars:
#   CDK_DEPLOY_ACCOUNT   — AWS account ID (auto-detected if not set)
#   CDK_DEPLOY_REGION    — AWS region (default: us-east-1)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Validate required secrets
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "❌ TELEGRAM_BOT_TOKEN is required."
  echo "   Export it: export TELEGRAM_BOT_TOKEN=your_token_here"
  exit 1
fi

if [ -z "${GROQ_API_KEY:-}" ]; then
  echo "❌ GROQ_API_KEY is required."
  echo "   Obtén una gratis en: https://console.groq.com"
  echo "   Export it: export GROQ_API_KEY=your_key_here"
  exit 1
fi

COGNITO_PASSWORD="${COGNITO_PASSWORD:-$(openssl rand -base64 12)!Aa1}"
AWS_REGION="${CDK_DEPLOY_REGION:-us-east-1}"

echo "==========================================="
echo " Carli FinOps — Deployment"
echo "==========================================="

# ── 1. Bootstrap CDK (only needed once) ─────────────────────────────────────
echo ""
echo "▶ Step 1/5 — Setting up CDK environment..."
cd "$PROJECT_DIR/infrastructure"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt -q

# ── Pre-build: package Telegram bot Lambda with dependencies ─────────────────
echo ""
echo "▶ Pre-build — Packaging Telegram bot Lambda..."
BUILD_DIR="$PROJECT_DIR/backend/telegram_bot_build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
pip install \
    --platform manylinux2014_x86_64 \
    --python-version 3.12 \
    --implementation cp \
    --only-binary=:all: \
    -r "$PROJECT_DIR/backend/telegram_bot/requirements.txt" \
    -t "$BUILD_DIR" \
    -q
cp "$PROJECT_DIR/backend/telegram_bot/"*.py "$BUILD_DIR/"
echo "  Bot Lambda packaged at backend/telegram_bot_build/"

# ── 2. CDK Deploy ────────────────────────────────────────────────────────────
echo ""
echo "▶ Step 2/5 — Deploying AWS infrastructure (CDK)..."
cdk bootstrap 2>/dev/null || true
cdk deploy --require-approval never --outputs-file cdk-outputs.json

# ── 3. Extract outputs ───────────────────────────────────────────────────────
echo ""
echo "▶ Step 3/5 — Extracting deployment outputs..."
USER_POOL_ID=$(jq -r '.CarliFinopsStack.UserPoolId' cdk-outputs.json)
USER_POOL_CLIENT_ID=$(jq -r '.CarliFinopsStack.UserPoolClientId' cdk-outputs.json)
APPSYNC_ENDPOINT=$(jq -r '.CarliFinopsStack.AppSyncEndpoint' cdk-outputs.json)
WEBHOOK_URL=$(jq -r '.CarliFinopsStack.WebhookUrl' cdk-outputs.json)

echo "  User Pool ID:      $USER_POOL_ID"
echo "  User Pool Client:  $USER_POOL_CLIENT_ID"
echo "  AppSync Endpoint:  $APPSYNC_ENDPOINT"
echo "  Webhook URL:       $WEBHOOK_URL"
echo "  AWS Region:        $AWS_REGION"

# ── 4. Create .env for frontend ──────────────────────────────────────────────
echo ""
echo "▶ Step 4/5 — Writing frontend config..."
cat > "$PROJECT_DIR/frontend/.env" << EOF
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_APPSYNC_ENDPOINT=$APPSYNC_ENDPOINT
EOF
echo "  Written to frontend/.env"

# ── 5. Create Cognito user ──────────────────────────────────────────────────
echo ""
echo "▶ Step 5/5 — Creating Cognito user 'carli'..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username carli \
  --user-attributes Name=email,Value=carli@finops.local \
  --temporary-password "$COGNITO_PASSWORD" \
  --region "$AWS_REGION" 2>/dev/null && echo "  User created." \
  || echo "  User already exists, skipping."

# ── Set permanent password ───────────────────────────────────────────────────
echo "  Setting permanent password..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username carli \
  --password "$COGNITO_PASSWORD" \
  --permanent \
  --region "$AWS_REGION" && echo "  Password set permanently." || true

# ── Register Telegram webhook ────────────────────────────────────────────────
echo ""
echo "▶ Registering Telegram webhook..."
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\"}")
echo "  Telegram response: $RESPONSE"

echo ""
echo "==========================================="
echo " Deployment complete!"
echo "==========================================="
echo ""
echo " Dashboard URL: (connect Amplify, see README)"
echo " Bot URL:       https://t.me/your_bot"
echo " Login:         usuario=carli / password=$COGNITO_PASSWORD"
echo ""
echo " NEXT STEP: Deploy the frontend to Amplify:"
echo "   cd frontend && npm install && npm run build"
echo "   Then connect the repo in AWS Amplify Console."
echo ""
deactivate
