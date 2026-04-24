"""
Telegram Bot webhook Lambda handler for Carli FinOps.
Receives updates from Telegram, manages conversation state in DynamoDB,
and delegates to the Strands agent for AI-powered expense parsing.
"""
import json
import logging
import os
import time
from typing import Optional

import boto3
import requests
from agent import process_message

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
SESSIONS_TABLE = os.environ["SESSIONS_TABLE"]
OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "carli")
REGION = os.environ.get("REGION", "us-east-1")

# Authorized Telegram user IDs (set after first use, or leave empty to allow all)
ALLOWED_CHAT_IDS: set = set()

dynamodb = boto3.resource("dynamodb", region_name=REGION)
sessions = dynamodb.Table(SESSIONS_TABLE)

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


def lambda_handler(event: dict, context) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
        logger.info("Telegram update: %s", json.dumps(body, ensure_ascii=False)[:500])
        _handle_update(body)
    except Exception as e:
        logger.exception("Error handling update: %s", e)
    return {"statusCode": 200, "body": "OK"}


def _handle_update(update: dict) -> None:
    message = update.get("message") or update.get("callback_query", {}).get("message")
    callback_query = update.get("callback_query")

    if callback_query:
        _handle_callback(callback_query)
        return

    if not message:
        return

    chat_id = str(message["chat"]["id"])
    text = (message.get("text") or "").strip()

    if not text:
        return

    if text.startswith("/start"):
        _send_message(
            chat_id,
            "Hola Carli! Soy tu asistente de finanzas.\n\n"
            "Cuéntame en qué gastaste y yo te ayudo a registrarlo.\n"
            "Ejemplo: *Almuerzo en restaurante 8500 colones tarjeta de débito*\n\n"
            "Comandos:\n"
            "/nuevo — Registrar un gasto\n"
            "/resumen — Ver resumen del mes\n"
            "/cancelar — Cancelar el registro actual",
            parse_mode="Markdown",
        )
        return

    if text.startswith("/cancelar"):
        _clear_session(chat_id)
        _send_message(chat_id, "Registro cancelado.")
        return

    if text.startswith("/resumen"):
        _send_summary(chat_id)
        return

    if text.startswith("/nuevo"):
        _clear_session(chat_id)
        _send_message(
            chat_id,
            "Cuéntame en qué gastaste:",
        )
        return

    # Main flow: pass to Strands agent
    _process_with_agent(chat_id, text)


def _process_with_agent(chat_id: str, user_text: str) -> None:
    session = _get_session(chat_id)
    conversation_history = session.get("history", [])

    try:
        _send_typing(chat_id)
        response_text, updated_history = process_message(user_text, conversation_history)

        # Keep only last 20 messages to avoid DynamoDB item size limits
        if len(updated_history) > 20:
            updated_history = updated_history[-20:]

        _save_session(chat_id, {"history": updated_history})

        if response_text:
            _send_message(chat_id, response_text)

        # Check if the agent saved an expense (tool was called)
        tool_called = _check_tool_called(updated_history)
        if tool_called:
            # Clear session after successful save
            _clear_session(chat_id)
            # Offer quick actions
            _send_inline_keyboard(
                chat_id,
                "¿Qué quieres hacer ahora?",
                [[("Registrar otro gasto", "nuevo"), ("Ver resumen del mes", "resumen")]],
            )

    except Exception as e:
        logger.exception("Agent error: %s", e)
        _send_message(
            chat_id,
            "Ocurrió un error procesando tu mensaje. Por favor intenta de nuevo.",
        )


def _check_tool_called(messages: list) -> bool:
    for msg in reversed(messages):
        content = msg.get("content", [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    if block.get("name") == "save_expense":
                        return True
    return False


def _send_summary(chat_id: str) -> None:
    from datetime import datetime, timezone
    import boto3
    from boto3.dynamodb.conditions import Key

    expenses_table_name = os.environ.get("EXPENSES_TABLE", "carli-finops-expenses")
    expenses_table = boto3.resource("dynamodb", region_name=REGION).Table(expenses_table_name)

    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    month_label = now.strftime("%B %Y")

    try:
        resp = expenses_table.query(
            IndexName="month-createdAt-index",
            KeyConditionExpression=Key("month").eq(month),
        )
        items = resp.get("Items", [])

        if not items:
            _send_message(chat_id, f"No hay gastos registrados en {month_label}.")
            return

        total_crc = sum(float(i.get("amount", 0)) for i in items if i.get("currency") == "CRC")
        total_usd = sum(float(i.get("amount", 0)) for i in items if i.get("currency") == "USD")

        by_category: dict = {}
        for item in items:
            cat = item.get("category", "Otros")
            by_category[cat] = by_category.get(cat, 0) + float(item.get("amount", 0))

        lines = [f"*Resumen de {month_label}*", f"Total gastos: {len(items)}", ""]
        if total_crc:
            lines.append(f"₡{total_crc:,.0f} colones")
        if total_usd:
            lines.append(f"${total_usd:.2f} dólares")
        lines.append("")
        lines.append("*Por categoría:*")
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1]):
            lines.append(f"  • {cat}: ₡{amt:,.0f}")

        _send_message(chat_id, "\n".join(lines), parse_mode="Markdown")
    except Exception as e:
        logger.exception("Summary error: %s", e)
        _send_message(chat_id, "Error al obtener el resumen.")


def _handle_callback(callback_query: dict) -> None:
    query_id = callback_query["id"]
    chat_id = str(callback_query["message"]["chat"]["id"])
    data = callback_query.get("data", "")

    _answer_callback(query_id)

    if data == "nuevo":
        _clear_session(chat_id)
        _send_message(chat_id, "Cuéntame en qué gastaste:")
    elif data == "resumen":
        _send_summary(chat_id)


def _get_session(chat_id: str) -> dict:
    try:
        resp = sessions.get_item(Key={"chatId": chat_id})
        item = resp.get("Item", {})
        return item if item else {}
    except Exception:
        return {}


def _save_session(chat_id: str, data: dict) -> None:
    try:
        sessions.put_item(Item={
            "chatId": chat_id,
            "ttl": int(time.time()) + 86400,  # 24h TTL
            **data,
        })
    except Exception as e:
        logger.warning("Could not save session: %s", e)


def _clear_session(chat_id: str) -> None:
    try:
        sessions.delete_item(Key={"chatId": chat_id})
    except Exception:
        pass


def _send_message(chat_id: str, text: str, parse_mode: str = "") -> None:
    payload: dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        requests.post(f"{TELEGRAM_API}/sendMessage", json=payload, timeout=10)
    except Exception as e:
        logger.warning("sendMessage failed: %s", e)


def _send_inline_keyboard(chat_id: str, text: str, buttons: list) -> None:
    keyboard = {"inline_keyboard": [[{"text": btn[0], "callback_data": btn[1]} for btn in row] for row in buttons]}
    try:
        requests.post(
            f"{TELEGRAM_API}/sendMessage",
            json={"chat_id": chat_id, "text": text, "reply_markup": keyboard},
            timeout=10,
        )
    except Exception as e:
        logger.warning("sendMessage (keyboard) failed: %s", e)


def _send_typing(chat_id: str) -> None:
    try:
        requests.post(
            f"{TELEGRAM_API}/sendChatAction",
            json={"chat_id": chat_id, "action": "typing"},
            timeout=5,
        )
    except Exception:
        pass


def _answer_callback(query_id: str) -> None:
    try:
        requests.post(
            f"{TELEGRAM_API}/answerCallbackQuery",
            json={"callback_query_id": query_id},
            timeout=5,
        )
    except Exception:
        pass
