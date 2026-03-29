import random
import uuid
from datetime import datetime, timedelta
from typing import Generator

CURRENCIES = ["USD", "EUR", "GBP", "CAD"]
STATUSES = ["succeeded", "failed", "pending"]
STATUS_WEIGHTS = [0.88, 0.07, 0.05]
CUSTOMER_POOL = [f"cus_{uuid.uuid4().hex[:14]}" for _ in range(100)]
PAYMENT_METHODS = ["card", "bank_transfer", "wallet"]
NUM_TRANSACTIONS = 500

_rng = random.Random(42)


def _random_date(days_back: int = 90) -> datetime:
    offset = timedelta(
        days=_rng.randint(0, days_back),
        hours=_rng.randint(0, 23),
        minutes=_rng.randint(0, 59),
        seconds=_rng.randint(0, 59),
    )
    return datetime.utcnow() - offset


def _random_amount() -> float:
    raw = _rng.gauss(150.0, 200.0)
    return max(round(raw, 2), 0.0)


def extract() -> Generator[dict, None, None]:
    for _ in range(NUM_TRANSACTIONS):
        status = _rng.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
        amount = _random_amount() if status != "failed" else 0.0
        yield {
            "transaction_id": f"ch_{uuid.uuid4().hex}",
            "customer_id": _rng.choice(CUSTOMER_POOL),
            "amount": amount,
            "currency": _rng.choice(CURRENCIES),
            "status": status,
            "payment_method": _rng.choice(PAYMENT_METHODS),
            "created_at": _random_date().isoformat(),
        }
