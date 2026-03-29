import logging
import os
import sys
import time

import psycopg2

from etl.extractors import github_extractor, stripe_extractor, twitter_extractor
from etl.transformers import github_transformer, stripe_transformer, twitter_transformer
from etl.loaders import postgres_loader
from etl import validation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

DB_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://warehouse:warehouse@localhost:5432/warehouse",
)


def _connect_with_retry(dsn: str, retries: int = 10, delay: int = 5) -> psycopg2.extensions.connection:
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg2.connect(dsn)
            logger.info("Connected to PostgreSQL on attempt %d", attempt)
            return conn
        except psycopg2.OperationalError as exc:
            logger.warning("DB not ready (attempt %d/%d): %s", attempt, retries, exc)
            if attempt == retries:
                raise
            time.sleep(delay)


def run_github(conn) -> None:
    logger.info("--- GitHub pipeline start ---")
    raw = list(github_extractor.extract())
    logger.info("Extracted %d GitHub repos", len(raw))
    validation.validate_github(raw)
    dim_repos, dim_langs, fact_metrics = github_transformer.transform(iter(raw))
    postgres_loader.load_github(conn, dim_repos, dim_langs, fact_metrics)
    logger.info("--- GitHub pipeline done ---")


def run_stripe(conn) -> None:
    logger.info("--- Stripe pipeline start ---")
    raw = list(stripe_extractor.extract())
    logger.info("Extracted %d Stripe transactions", len(raw))
    validation.validate_stripe(raw)
    dim_customers, dim_currencies, fact_txns = stripe_transformer.transform(iter(raw))
    postgres_loader.load_stripe(conn, dim_customers, dim_currencies, fact_txns)
    logger.info("--- Stripe pipeline done ---")


def run_twitter(conn) -> None:
    logger.info("--- Twitter pipeline start ---")
    raw = list(twitter_extractor.extract())
    logger.info("Extracted %d tweets", len(raw))
    validation.validate_twitter(raw)
    dim_accounts, dim_hashtags, fact_tweets, fact_th = twitter_transformer.transform(iter(raw))
    postgres_loader.load_twitter(conn, dim_accounts, dim_hashtags, fact_tweets, fact_th)
    logger.info("--- Twitter pipeline done ---")


def main() -> None:
    conn = _connect_with_retry(DB_DSN)
    try:
        run_github(conn)
        run_stripe(conn)
        run_twitter(conn)
    except Exception:
        logger.exception("Pipeline failed")
        conn.close()
        sys.exit(1)
    finally:
        conn.close()
    logger.info("All pipelines completed successfully")


if __name__ == "__main__":
    main()
