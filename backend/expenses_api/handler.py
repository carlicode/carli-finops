"""
GraphQL Lambda resolver for AppSync.
Handles all Query and Mutation operations for the FinOps expense tracker.
"""
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

REGION = os.environ.get("REGION", "us-east-1")
EXPENSES_TABLE = os.environ.get("EXPENSES_TABLE", "carli-finops-expenses")
OWNER_USER_ID = os.environ.get("OWNER_USER_ID", "carli")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(EXPENSES_TABLE)

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
    info = event.get("info", {})
    field_name = info.get("fieldName", "")
    arguments = event.get("arguments", {})
    identity = event.get("identity", {})

    # Resolve the caller user id (Cognito user or owner for API key callers)
    user_id = _resolve_user_id(identity)

    if field_name == "listExpenses":
        return _list_expenses(user_id, arguments)
    elif field_name == "getMonthSummary":
        return _get_month_summary(user_id, arguments)
    elif field_name == "createExpense":
        return _create_expense(user_id, arguments.get("input", {}))
    elif field_name == "deleteExpense":
        return _delete_expense(user_id, arguments.get("input", {}))
    else:
        raise ValueError(f"Unknown field: {field_name}")


def _resolve_user_id(identity: dict) -> str:
    if not identity:
        # API key caller (bot Lambda) — always the owner
        return OWNER_USER_ID
    # Cognito identity
    return identity.get("username") or identity.get("sub") or OWNER_USER_ID


def _list_expenses(user_id: str, args: dict) -> dict:
    month = args.get("month")
    limit = args.get("limit", 100)
    next_token = args.get("nextToken")

    kwargs: dict = {"KeyConditionExpression": Key("userId").eq(user_id)}
    if month:
        # Filter by month via GSI
        kwargs = {
            "IndexName": "month-createdAt-index",
            "KeyConditionExpression": Key("month").eq(month),
        }
    kwargs["Limit"] = min(limit, 200)
    if next_token:
        kwargs["ExclusiveStartKey"] = json.loads(next_token)

    if "IndexName" in kwargs:
        kwargs["FilterExpression"] = boto3.dynamodb.conditions.Attr("userId").eq(user_id)

    if "IndexName" in kwargs:
        resp = table.query(**kwargs)
    else:
        resp = table.query(**kwargs)

    items = resp.get("Items", [])
    total = sum(float(item.get("amount", 0)) for item in items)

    new_next_token = None
    if "LastEvaluatedKey" in resp:
        new_next_token = json.dumps(resp["LastEvaluatedKey"])

    return {"items": _format_items(items), "nextToken": new_next_token, "total": total}


def _get_month_summary(user_id: str, args: dict) -> dict:
    now = datetime.now(timezone.utc)
    month = args.get("month") or now.strftime("%Y-%m")
    return _list_expenses(user_id, {"month": month, "limit": 200})


def _create_expense(user_id: str, inp: dict) -> dict:
    now = datetime.now(timezone.utc)
    expense_id = f"{now.strftime('%Y-%m-%dT%H:%M:%S')}#{uuid.uuid4().hex[:8]}"
    month = now.strftime("%Y-%m")
    currency = inp.get("currency", "CRC")

    item = {
        "userId": user_id,
        "expenseId": expense_id,
        "description": inp["description"],
        "category": inp["category"],
        "amount": str(inp["amount"]),
        "currency": currency,
        "paymentMethod": inp["paymentMethod"],
        "createdAt": now.isoformat(),
        "month": month,
    }
    table.put_item(Item=item)
    return _format_item(item)


def _delete_expense(user_id: str, inp: dict) -> bool:
    expense_id = inp["expenseId"]
    table.delete_item(Key={"userId": user_id, "expenseId": expense_id})
    return True


def _format_items(items: list) -> list:
    return [_format_item(i) for i in items]


def _format_item(item: dict) -> dict:
    return {
        "userId": item.get("userId", ""),
        "expenseId": item.get("expenseId", ""),
        "description": item.get("description", ""),
        "category": item.get("category", ""),
        "amount": float(item.get("amount", 0)),
        "currency": item.get("currency", "CRC"),
        "paymentMethod": item.get("paymentMethod", ""),
        "createdAt": item.get("createdAt", ""),
        "month": item.get("month", ""),
    }
