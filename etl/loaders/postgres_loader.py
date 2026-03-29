import logging
from typing import Any, Sequence
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def _build_upsert(table: str, rows: list[dict], conflict_cols: list[str]) -> tuple[str, list[tuple]]:
    columns = list(rows[0].keys())
    col_list = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    update_set = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in columns if c not in conflict_cols
    )
    conflict = ", ".join(conflict_cols)
    if update_set:
        on_conflict = f"ON CONFLICT ({conflict}) DO UPDATE SET {update_set}"
    else:
        on_conflict = f"ON CONFLICT ({conflict}) DO NOTHING"
    sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) {on_conflict}"
    values = [tuple(r[c] for c in columns) for r in rows]
    return sql, values


def _batch_upsert(cur: Any, table: str, rows: list[dict], conflict_cols: list[str]) -> int:
    if not rows:
        return 0
    sql, values = _build_upsert(table, rows, conflict_cols)
    inserted = 0
    for i in range(0, len(values), BATCH_SIZE):
        batch = values[i : i + BATCH_SIZE]
        psycopg2.extras.execute_batch(cur, sql, batch, page_size=BATCH_SIZE)
        inserted += len(batch)
    return inserted


def load_github(conn: Any, dim_repos: list[dict], dim_languages: list[dict], fact_metrics: list[dict]) -> None:
    with conn.cursor() as cur:
        n = _batch_upsert(cur, "dim_languages", dim_languages, ["language_name"])
        logger.info("Upserted %d dim_languages rows", n)
        n = _batch_upsert(cur, "dim_repos", dim_repos, ["repo_id"])
        logger.info("Upserted %d dim_repos rows", n)
        n = _batch_upsert(cur, "fact_repo_metrics", fact_metrics, ["repo_id", "snapshot_ts"])
        logger.info("Upserted %d fact_repo_metrics rows", n)
    conn.commit()


def load_stripe(
    conn: Any, dim_customers: list[dict], dim_currencies: list[dict], fact_transactions: list[dict]
) -> None:
    with conn.cursor() as cur:
        n = _batch_upsert(cur, "dim_currencies", dim_currencies, ["currency_code"])
        logger.info("Upserted %d dim_currencies rows", n)
        n = _batch_upsert(cur, "dim_customers", dim_customers, ["customer_id"])
        logger.info("Upserted %d dim_customers rows", n)
        n = _batch_upsert(cur, "fact_transactions", fact_transactions, ["transaction_id"])
        logger.info("Upserted %d fact_transactions rows", n)
    conn.commit()


def load_twitter(
    conn: Any,
    dim_accounts: list[dict],
    dim_hashtags: list[dict],
    fact_tweets: list[dict],
    fact_tweet_hashtags: list[dict],
) -> None:
    with conn.cursor() as cur:
        n = _batch_upsert(cur, "dim_accounts", dim_accounts, ["account_name"])
        logger.info("Upserted %d dim_accounts rows", n)
        n = _batch_upsert(cur, "dim_hashtags", dim_hashtags, ["hashtag"])
        logger.info("Upserted %d dim_hashtags rows", n)
        n = _batch_upsert(cur, "fact_tweets", fact_tweets, ["tweet_id"])
        logger.info("Upserted %d fact_tweets rows", n)
        n = _batch_upsert(cur, "fact_tweet_hashtags", fact_tweet_hashtags, ["tweet_id", "hashtag"])
        logger.info("Upserted %d fact_tweet_hashtags rows", n)
    conn.commit()
