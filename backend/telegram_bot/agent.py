"""
Strands Agent for the FinOps Telegram bot.
Registers expenses and income in BOB or USD using Gemini via LiteLLM.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from strands import Agent, tool
from strands.models.litellm import LiteLLMModel

REGION = os.environ.get("REGION", "us-east-1")
EXPENSES_TABLE = os.environ.get("EXPENSES_TABLE", "carli-finops-expenses")
OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "carli")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
expenses_table = dynamodb.Table(EXPENSES_TABLE)

EXPENSE_CATEGORIES = [
    "Comida & Restaurantes",
    "Supermercado",
    "Transporte",
    "Entretenimiento",
    "Salud",
    "Servicios (luz, agua, etc.)",
    "Ropa & Personal",
    "Suscripciones",
    "Viajes",
    "Madre",
    "Otros",
]

INCOME_CATEGORIES = [
    "Salario / Trabajo",
    "Redes sociales (TikTok, etc.)",
    "Freelance",
    "Inversiones / intereses",
    "Regalos",
    "Otros ingresos",
]

PAYMENT_METHODS = [
    "Efectivo",
    "Tarjeta de Crédito",
    "Tarjeta de Débito",
    "Transferencia",
    "BCP",
    "BNB",
    "Regions Bank",
    "Truist Bank",
    "Billetera digital",
]

SYSTEM_PROMPT = f"""Eres el asistente financiero personal de Carli (Bolivia). Registras GASTOS e INGRESOS en bolivianos (BOB / Bs.) o dólares (USD).

**Gastos:** cuando diga en qué gastó, pide o infiere: descripción, categoría de gasto, monto, moneda (BOB por defecto), método de pago.
**Ingresos:** cuando diga que le pagaron, cobró, recibió salario, ganó en TikTok, etc., usa flow=INCOME y categoría de ingreso.

Categorías de GASTO: {json.dumps(EXPENSE_CATEGORIES, ensure_ascii=False)}
Categorías de INGRESO: {json.dumps(INCOME_CATEGORIES, ensure_ascii=False)}
Métodos / cuentas: {json.dumps(PAYMENT_METHODS, ensure_ascii=False)}

Cuando tengas todos los datos, llama a save_entry UNA vez con flow "EXPENSE" o "INCOME".

Reglas:
- Responde en español, breve.
- Moneda por defecto: BOB (Bs.). Si dice "dólares", "USD" o "$", usa USD.
- Montos en bolivianos sin decir moneda = BOB.
- Para ingresos, payment_method = dónde entró el dinero (ej. Tarjeta de Débito = cuenta bancaria).
- Confirma con un mensaje corto al guardar."""


@tool
def save_entry(
    flow: str,
    description: str,
    category: str,
    amount: float,
    currency: str,
    payment_method: str,
) -> str:
    """
    Guarda un gasto o un ingreso en DynamoDB.

    Args:
        flow: "EXPENSE" para gastos o "INCOME" para ingresos.
        description: Qué se compró o de qué es el ingreso.
        category: Una categoría de la lista correcta según el flow.
        amount: Monto positivo.
        currency: "BOB" o "USD".
        payment_method: Método de pago o cuenta; debe ser de la lista válida.

    Returns:
        Mensaje de confirmación.
    """
    f = (flow or "EXPENSE").upper()
    if f not in ("EXPENSE", "INCOME"):
        f = "EXPENSE"
    c = (currency or "BOB").upper()
    if c not in ("BOB", "USD"):
        c = "BOB"

    if f == "INCOME":
        if category not in INCOME_CATEGORIES:
            category = "Otros ingresos"
    else:
        if category not in EXPENSE_CATEGORIES:
            category = "Otros"

    if payment_method not in PAYMENT_METHODS:
        payment_method = "Tarjeta de Débito"

    amount = float(amount)

    now = datetime.now(timezone.utc)
    expense_id = f"{now.strftime('%Y-%m-%dT%H:%M:%S')}#{uuid.uuid4().hex[:8]}"
    month = now.strftime("%Y-%m")

    item = {
        "userId": OWNER_USER_ID,
        "expenseId": expense_id,
        "description": description,
        "category": category,
        "amount": str(amount),
        "currency": c,
        "paymentMethod": payment_method,
        "flow": f,
        "createdAt": now.isoformat(),
        "month": month,
    }
    expenses_table.put_item(Item=item)

    formatted = f"US$ {amount:,.2f}" if c == "USD" else f"Bs. {amount:,.2f}"
    kind = "Gasto" if f == "EXPENSE" else "Ingreso"
    return f"{kind} guardado: {description} — {formatted} ({payment_method}) · {category}."


def get_finops_agent() -> Agent:
    model = LiteLLMModel(
        model_id="groq/llama-3.3-70b-versatile",
        temperature=0.3,
        streaming=False,
    )
    return Agent(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        tools=[save_entry],
    )


def process_message(user_message: str, conversation_history: Optional[list] = None) -> tuple[str, list]:
    agent = get_finops_agent()

    if conversation_history:
        for msg in conversation_history:
            agent.messages.append(msg)

    result = agent(user_message)
    response_text = str(result).strip()

    return response_text, agent.messages
