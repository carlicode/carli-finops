"""
Strands Agent for the FinOps Telegram bot.
The agent parses free-text expense descriptions and guides the user through
collecting: description, category, amount, and payment method.
"""
import json
import os
from typing import Optional

import boto3
from strands import Agent, tool
from strands.models import BedrockModel

REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
EXPENSES_TABLE = os.environ.get("EXPENSES_TABLE", "carli-finops-expenses")
OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "carli")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
expenses_table = dynamodb.Table(EXPENSES_TABLE)

CATEGORIES = [
    "Comida & Restaurantes",
    "Supermercado",
    "Transporte",
    "Entretenimiento",
    "Salud",
    "Servicios (luz, agua, etc.)",
    "Ropa & Personal",
    "Suscripciones",
    "Viajes",
    "Otros",
]

PAYMENT_METHODS = [
    "Efectivo",
    "Tarjeta de Crédito",
    "Tarjeta de Débito",
    "Transferencia",
    "SINPE Móvil",
]

SYSTEM_PROMPT = f"""Eres el asistente financiero personal de Carli. Tu rol es registrar gastos de forma rápida y amigable.

Cuando Carli te diga en qué gastó dinero, debes:
1. Confirmar la descripción del gasto.
2. Sugerir la categoría más apropiada de esta lista: {json.dumps(CATEGORIES, ensure_ascii=False)}.
3. Preguntar el monto exacto si no fue mencionado.
4. Preguntar el método de pago si no fue mencionado, opciones: {json.dumps(PAYMENT_METHODS, ensure_ascii=False)}.
5. Una vez que tengas TODOS los datos (descripción, categoría, monto, método de pago), llamar a la herramienta save_expense.

Reglas importantes:
- Responde siempre en español, de forma corta y directa.
- Si el usuario menciona el monto en el primer mensaje, no lo preguntes de nuevo.
- Detecta montos en colones (₡ o CRC) o dólares ($ o USD).
- Si el monto tiene "mil" asúmelo como CRC (ej: "5 mil" = 5000 CRC).
- El método de pago por defecto si no se menciona es "Tarjeta de Débito".
- No uses emojis excesivos, sé conciso.
- Cuando guardes el gasto, confirma con un mensaje breve de éxito."""


@tool
def save_expense(
    description: str,
    category: str,
    amount: float,
    currency: str,
    payment_method: str,
) -> str:
    """
    Guarda un gasto en la base de datos DynamoDB.

    Args:
        description: Descripción del gasto (ej: "Almuerzo en El Spoon")
        category: Categoría del gasto. Debe ser exactamente una de las categorías válidas.
        amount: Monto del gasto como número positivo.
        currency: Moneda, "CRC" para colones o "USD" para dólares.
        payment_method: Método de pago. Debe ser exactamente uno de los métodos válidos.

    Returns:
        Mensaje de confirmación del guardado.
    """
    import uuid
    from datetime import datetime, timezone

    if category not in CATEGORIES:
        category = "Otros"
    if payment_method not in PAYMENT_METHODS:
        payment_method = "Tarjeta de Débito"
    if currency not in ("CRC", "USD"):
        currency = "CRC"

    now = datetime.now(timezone.utc)
    expense_id = f"{now.strftime('%Y-%m-%dT%H:%M:%S')}#{uuid.uuid4().hex[:8]}"
    month = now.strftime("%Y-%m")

    item = {
        "userId": OWNER_USER_ID,
        "expenseId": expense_id,
        "description": description,
        "category": category,
        "amount": str(amount),
        "currency": currency,
        "paymentMethod": payment_method,
        "createdAt": now.isoformat(),
        "month": month,
    }
    expenses_table.put_item(Item=item)

    currency_symbol = "₡" if currency == "CRC" else "$"
    formatted = f"{currency_symbol}{amount:,.0f}" if currency == "CRC" else f"{currency_symbol}{amount:.2f}"
    return f"Gasto guardado: {description} — {formatted} ({payment_method}) en {category}."


def get_finops_agent() -> Agent:
    model = BedrockModel(
        model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
        region_name=REGION,
        temperature=0.3,
        streaming=False,
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[save_expense],
    )


def process_message(user_message: str, conversation_history: Optional[list] = None) -> tuple[str, list]:
    """
    Process a user message using the Strands agent.
    Returns (agent_response_text, updated_conversation_history).
    """
    agent = get_finops_agent()

    if conversation_history:
        for msg in conversation_history:
            agent.messages.append(msg)

    result = agent(user_message)

    response_text = ""
    if hasattr(result, "message") and result.message:
        content = result.message.get("content", [])
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                response_text += block.get("text", "")
    elif hasattr(result, "__str__"):
        response_text = str(result)

    return response_text.strip(), agent.messages
