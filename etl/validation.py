import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    pass


def _check_nulls(records: list[dict], required_fields: list[str], source: str) -> list[str]:
    errors = []
    for i, rec in enumerate(records):
        for field in required_fields:
            if rec.get(field) is None or rec.get(field) == "":
                errors.append(f"{source}[{i}] missing required field '{field}'")
    return errors


def _check_outliers_numeric(records: list[dict], field: str, lo: float, hi: float, source: str) -> list[str]:
    errors = []
    for i, rec in enumerate(records):
        val = rec.get(field)
        if val is not None and not (lo <= float(val) <= hi):
            errors.append(f"{source}[{i}] field '{field}'={val} outside [{lo}, {hi}]")
    return errors


def _check_freshness(records: list[dict], date_field: str, max_age_days: int, source: str) -> list[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    errors = []
    for i, rec in enumerate(records):
        val = rec.get(date_field)
        if val is None:
            continue
        if isinstance(val, str):
            try:
                val = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"{source}[{i}] unparseable date '{val}'")
                continue
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        if val < cutoff:
            errors.append(f"{source}[{i}] stale record: {date_field}={val.isoformat()}")
    return errors


def validate_github(records: list[dict]) -> None:
    errors = []
    errors += _check_nulls(records, ["repo_id", "repo_name", "owner", "language"], "github")
    errors += _check_outliers_numeric(records, "stars", 0, 5_000_000, "github")
    errors += _check_outliers_numeric(records, "forks", 0, 2_000_000, "github")
    if errors:
        for e in errors:
            logger.warning("VALIDATION: %s", e)
    logger.info("GitHub validation: %d records, %d warnings", len(records), len(errors))


def validate_stripe(records: list[dict]) -> None:
    errors = []
    errors += _check_nulls(records, ["transaction_id", "customer_id", "currency", "status"], "stripe")
    errors += _check_outliers_numeric(records, "amount", 0, 1_000_000, "stripe")
    errors += _check_freshness(records, "created_at", 365, "stripe")
    if errors:
        for e in errors:
            logger.warning("VALIDATION: %s", e)
    logger.info("Stripe validation: %d records, %d warnings", len(records), len(errors))


def validate_twitter(records: list[dict]) -> None:
    errors = []
    errors += _check_nulls(records, ["tweet_id", "account", "created_at"], "twitter")
    errors += _check_outliers_numeric(records, "likes", 0, 10_000_000, "twitter")
    errors += _check_freshness(records, "created_at", 365, "twitter")
    if errors:
        for e in errors:
            logger.warning("VALIDATION: %s", e)
    logger.info("Twitter validation: %d records, %d warnings", len(records), len(errors))
