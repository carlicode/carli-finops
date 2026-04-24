#!/bin/bash
# Enable Claude Haiku model access in Amazon Bedrock (us-east-1)
# Run this ONCE before deploying.

echo "Enabling Amazon Bedrock model access..."
echo "Go to: https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess"
echo ""
echo "Select and enable:"
echo "  - Anthropic Claude 3.5 Haiku"
echo ""
echo "Or use AWS CLI:"
aws bedrock put-foundation-model-entitlement \
  --model-id "anthropic.claude-3-5-haiku-20241022-v1:0" \
  --region us-east-1 2>/dev/null \
  && echo "Model access requested!" \
  || echo "Please enable manually in the console (link above)."
