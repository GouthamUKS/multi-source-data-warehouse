from datetime import datetime
from typing import Iterator


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        return None


def _bucket_amount(amount: float) -> str:
    if amount == 0:
        return "zero"
    if amount < 50:
        return "0-50"
    if amount < 150:
        return "50-150"
    if amount < 500:
        return "150-500"
    return "500+"


def transform(records: Iterator[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    dim_customers: dict[str, dict] = {}
    dim_currencies: dict[str, dict] = {}
    fact_transactions = []

    for rec in records:
        cid = rec["customer_id"]
        if cid not in dim_customers:
            dim_customers[cid] = {"customer_id": cid, "first_seen": _parse_dt(rec["created_at"])}
        else:
            existing = dim_customers[cid]["first_seen"]
            ts = _parse_dt(rec["created_at"])
            if ts and (existing is None or ts < existing):
                dim_customers[cid]["first_seen"] = ts

        currency = rec["currency"]
        if currency not in dim_currencies:
            dim_currencies[currency] = {"currency_code": currency}

        fact_transactions.append(
            {
                "transaction_id": rec["transaction_id"],
                "customer_id": cid,
                "currency_code": currency,
                "amount": float(rec["amount"]),
                "amount_bucket": _bucket_amount(float(rec["amount"])),
                "status": rec["status"],
                "payment_method": rec["payment_method"],
                "created_at": _parse_dt(rec["created_at"]),
            }
        )

    return list(dim_customers.values()), list(dim_currencies.values()), fact_transactions
