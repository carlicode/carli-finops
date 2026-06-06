# Carli FinOps

Control de **gastos e ingresos** en **bolivianos (BOB / Bs.)** y **dólares (USD)**. Incluye bot de Telegram (IA), dashboard web en tiempo real (tema rosado) y autenticación con Cognito.

## Stack

| Capa | Tecnología |
|------|------------|
| AI / Bot | AWS Strands Agents + **Llama 3.3 70B** vía Groq (LiteLLM) |
| Bot | Telegram Bot API (webhook → API Gateway → Lambda) |
| Backend | AWS Lambda (Python 3.12): webhook + resolver GraphQL |
| Base de datos | Amazon DynamoDB |
| API | AWS AppSync (GraphQL + suscripciones) |
| Auth | Amazon Cognito |
| Frontend | React + TypeScript + Vite |
| Hosting | AWS Amplify |
| Infra | AWS CDK (Python) |

Tras cambiar `schema.graphql` o el stack CDK: vuelve a desplegar infraestructura (`cdk deploy` o `./scripts/deploy.sh`).

## Estructura del proyecto

```
Carli Finops/
├── infrastructure/       # CDK (DynamoDB, Cognito, AppSync, Lambda, API Gateway)
├── backend/
│   ├── telegram_bot/     # Webhook + Strands + Gemini
│   ├── telegram_bot_build/  # Generado al deploy (no commitear)
│   └── expenses_api/     # Resolvers GraphQL
├── frontend/             # Dashboard React
└── scripts/              # deploy.sh
```

## Despliegue

### Variables de entorno

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `TELEGRAM_BOT_TOKEN` | Sí | Token de @BotFather; el CDK lo inyecta en la Lambda del bot |
| `GROQ_API_KEY` | Sí | API key de Groq ([obtener gratis](https://console.groq.com)) |
| `COGNITO_PASSWORD` | Recomendada | Contraseña del usuario `carli`. Si omites, se genera una aleatoria (se mostrará al final). |
| `CDK_DEPLOY_REGION` | No | Por defecto `us-east-1` |

### Prerrequisitos

- AWS CLI configurado
- Node.js 18+, Python 3.10+
- `npm install -g aws-cdk`
- API key de Groq (gratis en [console.groq.com](https://console.groq.com))

### Infraestructura + bot + webhook

```bash
export TELEGRAM_BOT_TOKEN="tu_token_de_BotFather"
export COGNITO_PASSWORD="tu_contraseña_segura"   # recomendado
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

El script:

- Empaqueta la Lambda del bot con dependencias **Linux x86_64** (`manylinux2014_x86_64`) para evitar errores de `pydantic_core` en Lambda
- Ejecuta `cdk deploy`
- Escribe `frontend/.env` con Cognito y AppSync
- Crea/actualiza usuario `carli` en Cognito
- Registra el **webhook** de Telegram

### Frontend en Amplify

1. [Amplify Console](https://us-east-1.console.aws.amazon.com/amplify/home) → la app existente o nueva
2. Build: `frontend/amplify.yml`
3. Variables de entorno: mismas que `frontend/.env` (`VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_APPSYNC_ENDPOINT`)

Build local:

```bash
cd frontend && npm install && npm run build
```

Para subir un artefacto estático (zip con el **contenido** de `dist/` en la raíz del zip), puedes usar la API de Amplify Hosting como en flujos manuales de despliegue.

## Manual de uso — Bot de Telegram

Abre [@Carli_Finops_bot](https://t.me/Carli_Finops_bot) y envía `/start`.

### Comandos

| Comando | Descripción |
|---------|-------------|
| `/start` | Bienvenida e instrucciones |
| `/nuevo` | Nuevo movimiento (limpia contexto del agente) |
| `/resumen` | Totales del mes (gastos e ingresos en BOB y USD) |
| `/cancelar` | Cancela el registro en curso |

### Lenguaje natural

Escribe gastos o ingresos en una sola frase cuando puedas (descripción, monto, moneda si aplica, método o cuenta).

**Gasto**

```
Almorcé en el mercado, 50 Bs, efectivo
```

**Ingreso**

```
Me pagaron el sueldo 3500 bolivianos, BNB
```

Tras guardar, el bot envía **un mensaje** con la confirmación y botones «Otro movimiento» / «Resumen del mes».

### Categorías de gasto

Incluye entre otras: Comida & Restaurantes, Supermercado, Transporte, Entretenimiento, Salud, Servicios, Ropa & Personal, Suscripciones, Viajes, **Madre**, Otros.

### Categorías / fuentes de ingreso

Salario / Trabajo, Redes sociales (TikTok, etc.), Freelance, Inversiones / intereses, Regalos, Otros ingresos.

### Métodos y cuentas

Efectivo, Tarjeta de Crédito/Débito, Transferencia, **BCP**, **BNB**, **Regions Bank**, **Truist Bank**, Billetera digital.

### Monedas

- **BOB** por defecto si solo das montos «en bolivianos» o «Bs.»
- **USD** si mencionas dólares, `USD` o `$`

## Manual de uso — Dashboard web

1. Abre la URL de Amplify.
2. Usuario: **`carli`**. Contraseña: la de `COGNITO_PASSWORD` (o la que fijaste en Cognito).

### Funciones

- **Movimientos**: lista del mes; **✎** editar; **✕** eliminar.
- **+ Nuevo movimiento**: gasto o ingreso, BOB/USD, categorías y métodos alineados con el bot.
- **Resumen**: totales y gráficos (BOB/USD, gastos vs ingresos).
- Los cambios desde la web o Telegram se reflejan con la suscripción en vivo cuando está activa.

## Solución de problemas (bot)

| Síntoma | Causa habitual |
|---------|----------------|
| No responde o error genérico | `GROQ_API_KEY` inválida o expirada. Verifica en CloudWatch y genera una nueva en [console.groq.com](https://console.groq.com). |
| Lambda `ImportModuleError` | Vuelve a empaquetar con `./scripts/deploy.sh` (instalación `manylinux` para Linux, no macOS). |
| Respuesta vacía del agente | Revisa CloudWatch — puede ser rate limit de Groq (free tier: 14,400 req/día). |

Si algo falla, revisa **CloudWatch** → log group `/aws/lambda/carli-finops-telegram-bot` (líneas `Agent error` o `Telegram sendMessage not ok`).

## Credenciales

- **Usuario web**: `carli`
- **Contraseña**: `COGNITO_PASSWORD` al desplegar, o la que configures en Cognito

No commitees tokens ni contraseñas.

## Costo estimado (uso personal)

Del orden de **~$0/mes**. Groq (Llama 3.3 70B) es gratuito (14,400 req/día). AWS Lambda, DynamoDB y Amplify en uso personal entran en el free tier.
