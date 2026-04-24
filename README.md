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

---

## Manual de uso

### Bot de Telegram

#### Registrar un gasto (lenguaje natural)

Puedes escribirle al bot de forma libre. El agente de IA extrae la información automáticamente:

```
Tú:  Almuerzo en el Spoon 8500 tarjeta de débito
Bot: Gasto guardado: Almuerzo en el Spoon — ₡8,500 (Tarjeta de Débito) en Comida & Restaurantes.
```

```
Tú:  Uber 3 dólares
Bot: ¿Cuál fue el método de pago?
Tú:  Tarjeta de crédito
Bot: Gasto guardado: Uber — $3.00 (Tarjeta de Crédito) en Transporte.
```

También puedes dar todos los datos juntos o ir respondiendo lo que el bot pregunte.

#### Comandos disponibles

| Comando | Descripción |
|---|---|
| `/start` | Saludo inicial + instrucciones |
| `/nuevo` | Iniciar registro de un gasto |
| `/resumen` | Ver totales del mes actual por categoría |
| `/cancelar` | Cancelar el registro en curso |

#### Categorías de gasto

El bot las asigna automáticamente, pero puedes corregirla si lo pide:

- Comida & Restaurantes
- Supermercado
- Transporte
- Entretenimiento
- Salud
- Servicios (luz, agua, etc.)
- Ropa & Personal
- Suscripciones
- Viajes
- Otros

#### Métodos de pago

- Efectivo
- Tarjeta de Crédito
- Tarjeta de Débito
- Transferencia
- SINPE Móvil

#### Monedas soportadas

- **CRC** — colones (`₡`, "mil", "colones")
- **USD** — dólares (`$`, "dólares", "USD")

Si escribes "5 mil" lo interpreta como ₡5,000. Si escribes "$10" lo registra como $10.00 USD.

---

### Dashboard web

#### Acceso

1. Abre la URL del dashboard (la que entrega Amplify tras el deploy).
2. Ingresa con usuario `carli` y la contraseña que configuraste.

#### Funciones principales

**Barra lateral izquierda**
- Navega entre **Gastos** (lista) y **Estadísticas** (gráficos).
- Selecciona el mes que quieres ver (últimos 6 meses disponibles).

**Registrar un gasto manualmente**
1. Haz clic en **+ Nuevo gasto** (arriba a la derecha).
2. Completa: descripción, categoría, monto, moneda y método de pago.
3. Haz clic en **Guardar**.

El gasto aparece en la lista de inmediato.

**Vista Gastos**
- Lista de gastos del mes ordenados del más reciente al más antiguo.
- Cada ítem muestra: descripción, categoría, método de pago, fecha y monto.
- Haz clic en **✕** al final de una fila para eliminar ese gasto.

**Vista Estadísticas**
- **Tarjetas de resumen**: total de gastos, total en CRC, total en USD, promedio por gasto.
- **Gráfico de torta**: distribución de gastos por categoría.
- **Gráfico de barras**: cantidad de gastos por método de pago.

**Tiempo real**
- El punto verde junto a "Actualizado" indica que la suscripción en vivo está activa.
- Cuando registras un gasto desde el bot de Telegram, aparece en el dashboard automáticamente sin recargar la página.

---

## Costo estimado

~$1–2/mes (uso personal). Con créditos AWS = $0.

| Servicio | Costo |
|---|---|
| Lambda, DynamoDB, API Gateway, Cognito, AppSync | Free Tier |
| Amazon Bedrock (Claude Haiku) | ~$0.50/mes |
| AWS Amplify | ~$0.50/mes |
