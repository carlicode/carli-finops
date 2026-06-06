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

dynamodb = boto3.resource("dynamodb", region_name=REGION)
sessions = dynamodb.Table(SESSIONS_TABLE)

MESES_ES = {
    "January": "enero", "February": "febrero", "March": "marzo",
    "April": "abril", "May": "mayo", "June": "junio",
    "July": "julio", "August": "agosto", "September": "septiembre",
    "October": "octubre", "November": "noviembre", "December": "diciembre",
}

WELCOME_MESSAGE = (
    "👋 ¡Hola Carli\\! Soy tu asistente financiero personal\\.\n\n"
    "📝 *¿Qué puedo hacer?*\n"
    "• Registrar *gastos* en Bs\\. o US$\n"
    "• Registrar *ingresos* \\(sueldo, TikTok, freelance\\.\\.\\.\\)\n"
    "• Mostrar tu *resumen mensual*\n\n"
    "💬 *¿Cómo usarme?*\n"
    "Solo cuéntame en lenguaje natural:\n\n"
    "_Gasto:_ \"Almorcé en el mercado, 50 Bs, efectivo\"\n"
    "_Ingreso:_ \"Me pagaron el sueldo 3500 bolivianos a BNB\"\n\n"
    "🗂 *Comandos:*\n"
    "/nuevo \\— Nuevo registro\n"
    "/resumen \\— Resumen del mes\n"
    "/cancelar \\— Cancelar el registro actual"
)


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
        _send_message(chat_id, WELCOME_MESSAGE, parse_mode="MarkdownV2")
        return

    if text.startswith("/cancelar"):
        _clear_session(chat_id)
        _send_message(chat_id, "✅ Registro cancelado\\. Cuando quieras, cuéntame un nuevo movimiento\\.", parse_mode="MarkdownV2")
        return

    if text.startswith("/resumen"):
        _send_summary(chat_id)
        return

    if text.startswith("/nuevo"):
        _clear_session(chat_id)
        _send_message(
            chat_id,
            "📝 Listo\\! Cuéntame tu gasto o ingreso\\.\n\n"
            "_Ej\\.: \"Almuerzo 25 Bs efectivo\" o \"Me pagaron 500 dólares\"_",
            parse_mode="MarkdownV2",
        )
        return

    _process_with_agent(chat_id, text)


def _process_with_agent(chat_id: str, user_text: str) -> None:
    session = _get_session(chat_id)
    conversation_history = session.get("history", [])

    # Enviar mensaje de "procesando" inmediatamente para que el usuario sepa que recibimos su mensaje
    thinking_msg_id = _send_message_get_id(chat_id, "⏳ Recibido\\! Procesando tu mensaje\\.\\.\\.", parse_mode="MarkdownV2")

    try:
        response_text, updated_history = process_message(user_text, conversation_history)

        if len(updated_history) > 20:
            updated_history = updated_history[-20:]

        _save_session(chat_id, {"history": updated_history})

        tool_called = _check_tool_called(updated_history)
        confirm = (response_text or "").strip()
        if tool_called and not confirm:
            confirm = _save_entry_confirmation_from_history(updated_history)
        if tool_called and not confirm:
            confirm = "Listo, movimiento guardado."

        if tool_called:
            _clear_session(chat_id)
            full_text = f"✅ {confirm}\n\n¿Qué hacemos ahora?"
            keyboard = {"inline_keyboard": [[
                {"text": "➕ Otro movimiento", "callback_data": "nuevo"},
                {"text": "📊 Resumen del mes", "callback_data": "resumen"},
            ]]}
            if thinking_msg_id:
                _edit_message(chat_id, thinking_msg_id, full_text, reply_markup=keyboard)
            else:
                _send_inline_keyboard(chat_id, full_text, [[("➕ Otro movimiento", "nuevo"), ("📊 Resumen del mes", "resumen")]])
        elif confirm:
            if thinking_msg_id:
                _edit_message(chat_id, thinking_msg_id, confirm)
            else:
                _send_message(chat_id, confirm)

    except Exception as e:
        logger.exception("Agent error: %s", e)
        error_text = "❌ Ocurrió un error procesando tu mensaje\\. Por favor intenta de nuevo\\."
        if thinking_msg_id:
            _edit_message(chat_id, thinking_msg_id, error_text, parse_mode="MarkdownV2")
        else:
            _send_message(chat_id, error_text, parse_mode="MarkdownV2")


def _save_entry_confirmation_from_history(messages: list) -> str:
    for msg in reversed(messages):
        if msg.get("role") != "user":
            continue
        for block in msg.get("content", []):
            if not isinstance(block, dict):
                continue
            tr = block.get("toolResult")
            if not isinstance(tr, dict):
                continue
            for item in tr.get("content") or []:
                if isinstance(item, dict):
                    t = item.get("text")
                    if isinstance(t, str) and t.strip():
                        return t.strip()
    return ""


def _check_tool_called(messages: list) -> bool:
    for msg in reversed(messages):
        content = msg.get("content", [])
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use" and block.get("name") in ("save_entry",):
                return True
            tu = block.get("toolUse")
            if isinstance(tu, dict) and tu.get("name") in ("save_entry",):
                return True
    return False


def _send_summary(chat_id: str) -> None:
    from datetime import datetime, timezone
    from boto3.dynamodb.conditions import Key

    expenses_table_name = os.environ.get("EXPENSES_TABLE", "carli-finops-expenses")
    expenses_table = boto3.resource("dynamodb", region_name=REGION).Table(expenses_table_name)

    now = datetime.now(timezone.utc)
    month = now.strftime("%Y-%m")
    month_en = now.strftime("%B")
    month_label = f"{MESES_ES.get(month_en, month_en)} {now.year}"

    status_msg_id = _send_message_get_id(chat_id, f"📊 Calculando tu resumen de {month_label}...")

    try:
        resp = expenses_table.query(
            IndexName="month-createdAt-index",
            KeyConditionExpression=Key("month").eq(month),
        )
        items = [i for i in resp.get("Items", []) if i.get("userId") == OWNER_USER_ID]

        if not items:
            text = f"📭 No hay movimientos registrados en {month_label}."
            if status_msg_id:
                _edit_message(chat_id, status_msg_id, text)
            else:
                _send_message(chat_id, text)
            return

        def is_bob(c: str) -> bool:
            return (c or "BOB").upper() in ("BOB", "BS")

        out_bob = sum(float(i.get("amount", 0)) for i in items if i.get("flow", "EXPENSE") == "EXPENSE" and is_bob(i.get("currency", "BOB")))
        out_usd = sum(float(i.get("amount", 0)) for i in items if i.get("flow", "EXPENSE") == "EXPENSE" and (i.get("currency", "") or "").upper() == "USD")
        in_bob  = sum(float(i.get("amount", 0)) for i in items if i.get("flow") == "INCOME" and is_bob(i.get("currency", "BOB")))
        in_usd  = sum(float(i.get("amount", 0)) for i in items if i.get("flow") == "INCOME" and (i.get("currency", "") or "").upper() == "USD")

        net_bob = in_bob - out_bob
        net_usd = in_usd - out_usd
        net_bob_sign = "+" if net_bob >= 0 else "-"
        net_usd_sign = "+" if net_usd >= 0 else "-"

        text = (
            f"<b>📊 Resumen {month_label}</b>\n"
            f"<i>{len(items)} movimientos registrados</i>\n\n"
            f"💸 <b>Gastos</b>\n"
            f"  Bs. {out_bob:,.2f}   |   US$ {out_usd:,.2f}\n\n"
            f"💰 <b>Ingresos</b>\n"
            f"  Bs. {in_bob:,.2f}   |   US$ {in_usd:,.2f}\n\n"
            f"📈 <b>Balance</b>\n"
            f"  {net_bob_sign} Bs. {abs(net_bob):,.2f}   |   {net_usd_sign} US$ {abs(net_usd):,.2f}"
        )

        if status_msg_id:
            _edit_message(chat_id, status_msg_id, text, parse_mode="HTML")
        else:
            _send_message(chat_id, text, parse_mode="HTML")

    except Exception as e:
        logger.exception("Summary error: %s", e)
        err = "❌ Error al obtener el resumen. Intenta de nuevo."
        if status_msg_id:
            _edit_message(chat_id, status_msg_id, err)
        else:
            _send_message(chat_id, err)


def _handle_callback(callback_query: dict) -> None:
    query_id = callback_query["id"]
    chat_id = str(callback_query["message"]["chat"]["id"])
    data = callback_query.get("data", "")

    _answer_callback(query_id)

    if data == "nuevo":
        _clear_session(chat_id)
        _send_message(
            chat_id,
            "📝 Listo\\! Cuéntame tu gasto o ingreso\\.",
            parse_mode="MarkdownV2",
        )
    elif data == "resumen":
        _send_summary(chat_id)


# ── DynamoDB session helpers ────────────────────────────────────────────────

def _get_session(chat_id: str) -> dict:
    try:
        resp = sessions.get_item(Key={"chatId": chat_id})
        return resp.get("Item", {})
    except Exception:
        return {}


def _save_session(chat_id: str, data: dict) -> None:
    try:
        sessions.put_item(Item={"chatId": chat_id, "ttl": int(time.time()) + 86400, **data})
    except Exception as e:
        logger.warning("Could not save session: %s", e)


def _clear_session(chat_id: str) -> None:
    try:
        sessions.delete_item(Key={"chatId": chat_id})
    except Exception:
        pass


# ── Telegram API helpers ────────────────────────────────────────────────────

def _send_message(chat_id: str, text: str, parse_mode: str = "") -> None:
    payload: dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        r = requests.post(f"{TELEGRAM_API}/sendMessage", json=payload, timeout=10)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if not data.get("ok"):
            logger.warning("Telegram sendMessage not ok: %s", data)
    except Exception as e:
        logger.warning("sendMessage failed: %s", e)


def _send_message_get_id(chat_id: str, text: str, parse_mode: str = "") -> Optional[int]:
    """Sends a message and returns its message_id for later editing."""
    payload: dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    try:
        r = requests.post(f"{TELEGRAM_API}/sendMessage", json=payload, timeout=10)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if data.get("ok"):
            return data["result"]["message_id"]
        logger.warning("Telegram sendMessage not ok: %s", data)
    except Exception as e:
        logger.warning("sendMessage failed: %s", e)
    return None


def _edit_message(chat_id: str, message_id: int, text: str, parse_mode: str = "", reply_markup: dict = None) -> None:
    """Edits a previously sent message in-place."""
    payload: dict = {"chat_id": chat_id, "message_id": message_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        r = requests.post(f"{TELEGRAM_API}/editMessageText", json=payload, timeout=10)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if not data.get("ok"):
            logger.warning("Telegram editMessageText not ok: %s", data)
    except Exception as e:
        logger.warning("editMessageText failed: %s", e)


def _send_inline_keyboard(chat_id: str, text: str, buttons: list) -> None:
    keyboard = {"inline_keyboard": [[{"text": btn[0], "callback_data": btn[1]} for btn in row] for row in buttons]}
    try:
        r = requests.post(
            f"{TELEGRAM_API}/sendMessage",
            json={"chat_id": chat_id, "text": text, "reply_markup": keyboard},
            timeout=10,
        )
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if not data.get("ok"):
            logger.warning("Telegram sendMessage (keyboard) not ok: %s", data)
    except Exception as e:
        logger.warning("sendMessage (keyboard) failed: %s", e)


def _answer_callback(query_id: str) -> None:
    try:
        requests.post(f"{TELEGRAM_API}/answerCallbackQuery", json={"callback_query_id": query_id}, timeout=5)
    except Exception:
        pass
