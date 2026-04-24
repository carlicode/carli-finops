# Carli FinOps

Control de gastos personal con bot de Telegram + dashboard web en tiempo real.

## Stack

| Capa | Tecnología |
|---|---|
| AI / Bot | AWS Strands Agents + Amazon Bedrock (Claude 3.5 Haiku) |
| Bot | Telegram Bot API (webhook → AWS Lambda) |
| Backend | AWS Lambda (Python 3.12) |
| Base de datos | Amazon DynamoDB |
| API | AWS AppSync (GraphQL + suscripciones en tiempo real) |
| Auth | Amazon Cognito |
| Frontend | React + TypeScript + Vite |
| Hosting | AWS Amplify |
| Infraestructura | AWS CDK (Python) |

## Estructura del proyecto

```
Carli Finops/
├── infrastructure/       # CDK stack (DynamoDB, Cognito, AppSync, Lambda)
├── backend/
│   ├── telegram_bot/     # Webhook handler + Strands Agent
│   └── expenses_api/     # GraphQL resolver Lambda
├── frontend/             # React dashboard
└── scripts/              # Deployment scripts
```

## Despliegue paso a paso

### Prerequisitos

- AWS CLI configurado (`aws configure`)
- Node.js 18+ y Python 3.10+
- CDK CLI: `npm install -g aws-cdk`

### 1. Habilitar Bedrock

Habilita el modelo Claude 3.5 Haiku en Amazon Bedrock:

```bash
open https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
```

Activa "Anthropic Claude 3.5 Haiku".

### 2. Deploy de infraestructura + bot

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Esto despliega:
- DynamoDB tables
- Cognito User Pool + usuario `carli`
- AppSync GraphQL API
- Lambda: bot de Telegram + resolver GraphQL
- API Gateway para el webhook
- Registra automáticamente el webhook en Telegram

### 3. Deploy del frontend en Amplify

1. Ve a [AWS Amplify Console](https://us-east-1.console.aws.amazon.com/amplify/home)
2. "New app" → "Host web app"
3. Conecta este repositorio de Git
4. En "Build settings" usa el archivo `frontend/amplify.yml`
5. En "Environment variables" agrega las variables del archivo `frontend/.env` que generó el script:
   - `VITE_USER_POOL_ID`
   - `VITE_USER_POOL_CLIENT_ID`
   - `VITE_APPSYNC_ENDPOINT`

### 4. Usar el bot

Abre [@Carli_Finops_bot](https://t.me/Carli_Finops_bot) en Telegram y escribe `/start`.

Ejemplo de uso:
```
Tú: Almuerzo en restaurante 8500 colones tarjeta
Bot: ¿Es esto correcto?
     Descripción: Almuerzo en restaurante
     Categoría: Comida & Restaurantes
     Monto: ₡8,500
     Pago: Tarjeta de Débito
Bot: ¡Gasto guardado! ✓
```

## Credenciales del dashboard

- **Usuario**: `carli`
- **Contraseña**: la que definiste en `COGNITO_PASSWORD` al hacer el deploy

Cámbiala después del primer login desde la consola de Cognito.

## Costo estimado

~$1–2/mes (uso personal). Con créditos AWS = $0.

| Servicio | Costo |
|---|---|
| Lambda, DynamoDB, API Gateway, Cognito, AppSync | Free Tier |
| Amazon Bedrock (Claude Haiku) | ~$0.50/mes |
| AWS Amplify | ~$0.50/mes |
