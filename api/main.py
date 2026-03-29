import os
from contextlib import asynccontextmanager
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_DSN = os.getenv("DATABASE_URL", "postgresql://warehouse:warehouse@localhost:5432/warehouse")

_conn: psycopg2.extensions.connection | None = None


def get_conn() -> psycopg2.extensions.connection:
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DB_DSN)
    return _conn


def query(sql: str, params: tuple = ()) -> list[dict]:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_conn()
    yield
    if _conn and not _conn.closed:
        _conn.close()


app = FastAPI(title="Warehouse API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    try:
        query("SELECT 1")
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ---- GitHub endpoints ----

@app.get("/api/github/repos")
def github_repos(
    limit: int = Query(20, ge=1, le=200),
    sort: str = Query("stars", pattern="^(stars|forks|open_issues)$"),
) -> list[dict]:
    sql = f"""
        SELECT dr.repo_name, dr.owner, dr.language_name, dr.created_at,
               MAX(frm.stars) AS stars, MAX(frm.forks) AS forks,
               MAX(frm.open_issues) AS open_issues, MAX(frm.updated_at) AS updated_at
        FROM dim_repos dr
        JOIN fact_repo_metrics frm ON frm.repo_id = dr.repo_id
        GROUP BY dr.repo_name, dr.owner, dr.language_name, dr.created_at
        ORDER BY MAX(frm.{sort}) DESC
        LIMIT %s
    """
    return query(sql, (limit,))


@app.get("/api/github/trends")
def github_trends(days: int = Query(30, ge=1, le=365)) -> list[dict]:
    sql = """
        SELECT DATE_TRUNC('day', snapshot_ts)::DATE AS day,
               SUM(stars) AS total_stars, AVG(stars) AS avg_stars,
               COUNT(DISTINCT repo_id) AS repo_count
        FROM fact_repo_metrics
        WHERE snapshot_ts >= NOW() - INTERVAL '1 day' * %s
        GROUP BY 1 ORDER BY 1
    """
    return query(sql, (days,))


@app.get("/api/github/languages")
def github_languages() -> list[dict]:
    sql = """
        SELECT dl.language_name,
               COUNT(DISTINCT dr.repo_id) AS repo_count,
               AVG(frm.stars) AS avg_stars,
               SUM(frm.stars) AS total_stars
        FROM dim_languages dl
        JOIN dim_repos dr ON dr.language_name = dl.language_name
        JOIN fact_repo_metrics frm ON frm.repo_id = dr.repo_id
        GROUP BY dl.language_name
        ORDER BY total_stars DESC
    """
    return query(sql)


@app.get("/api/github/heatmap")
def github_heatmap() -> list[dict]:
    sql = """
        SELECT language_name,
               CASE
                   WHEN stars < 1000 THEN '0-1k'
                   WHEN stars < 5000 THEN '1k-5k'
                   WHEN stars < 20000 THEN '5k-20k'
                   WHEN stars < 100000 THEN '20k-100k'
                   ELSE '100k+'
               END AS star_bucket,
               COUNT(*) AS repo_count
        FROM fact_repo_metrics
        GROUP BY 1, 2
        ORDER BY 1, MIN(stars)
    """
    return query(sql)


# ---- Stripe endpoints ----

@app.get("/api/stripe/revenue_trend")
def stripe_revenue_trend(days: int = Query(30, ge=1, le=365)) -> list[dict]:
    sql = """
        SELECT DATE_TRUNC('day', created_at)::DATE AS day,
               COUNT(*) AS transaction_count,
               COUNT(*) FILTER (WHERE status = 'succeeded') AS successful,
               SUM(amount) FILTER (WHERE status = 'succeeded') AS daily_revenue,
               AVG(amount) FILTER (WHERE status = 'succeeded') AS avg_order_value
        FROM fact_transactions
        WHERE created_at >= NOW() - INTERVAL '1 day' * %s
        GROUP BY 1 ORDER BY 1
    """
    return query(sql, (days,))


@app.get("/api/stripe/top_customers")
def stripe_top_customers(limit: int = Query(10, ge=1, le=100)) -> list[dict]:
    sql = """
        SELECT dc.customer_id,
               dc.first_seen::DATE AS customer_since,
               COUNT(ft.transaction_id) AS num_transactions,
               SUM(ft.amount) AS total_spent,
               AVG(ft.amount) AS avg_transaction_value,
               MAX(ft.created_at)::DATE AS last_transaction
        FROM dim_customers dc
        JOIN fact_transactions ft ON ft.customer_id = dc.customer_id
        WHERE ft.status = 'succeeded'
        GROUP BY dc.customer_id, dc.first_seen
        ORDER BY total_spent DESC
        LIMIT %s
    """
    return query(sql, (limit,))


@app.get("/api/stripe/by_currency")
def stripe_by_currency() -> list[dict]:
    sql = """
        SELECT currency_code,
               COUNT(*) AS transaction_count,
               SUM(amount) FILTER (WHERE status = 'succeeded') AS total_revenue,
               AVG(amount) FILTER (WHERE status = 'succeeded') AS avg_amount,
               ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0), 2) AS success_rate
        FROM fact_transactions
        GROUP BY currency_code
        ORDER BY total_revenue DESC NULLS LAST
    """
    return query(sql)


@app.get("/api/stripe/heatmap")
def stripe_heatmap() -> list[dict]:
    sql = """
        SELECT currency_code, amount_bucket,
               COUNT(*) AS transaction_count,
               SUM(amount) AS bucket_revenue
        FROM fact_transactions
        WHERE status = 'succeeded'
        GROUP BY 1, 2 ORDER BY 1, 2
    """
    return query(sql)


# ---- Twitter endpoints ----

@app.get("/api/twitter/engagement_trend")
def twitter_engagement_trend(days: int = Query(30, ge=1, le=365)) -> list[dict]:
    sql = """
        SELECT DATE_TRUNC('day', created_at)::DATE AS day,
               COUNT(*) AS tweet_count,
               SUM(likes) AS total_likes,
               SUM(retweets) AS total_retweets,
               SUM(replies) AS total_replies,
               AVG(engagement_rate) AS avg_engagement_rate
        FROM fact_tweets
        WHERE created_at >= NOW() - INTERVAL '1 day' * %s
        GROUP BY 1 ORDER BY 1
    """
    return query(sql, (days,))


@app.get("/api/twitter/top_accounts")
def twitter_top_accounts(limit: int = Query(10, ge=1, le=100)) -> list[dict]:
    sql = """
        SELECT account_name,
               COUNT(*) AS tweet_count,
               SUM(likes) AS total_likes,
               SUM(retweets) AS total_retweets,
               SUM(impressions) AS total_impressions,
               ROUND(AVG(engagement_rate) * 100, 4) AS avg_engagement_pct
        FROM fact_tweets
        GROUP BY account_name
        ORDER BY total_likes DESC
        LIMIT %s
    """
    return query(sql, (limit,))


@app.get("/api/twitter/hashtag_trends")
def twitter_hashtag_trends(days: int = Query(30, ge=1, le=365)) -> list[dict]:
    sql = """
        SELECT fth.hashtag,
               COUNT(ft.tweet_id) AS tweet_count,
               SUM(ft.likes) AS total_likes,
               SUM(ft.retweets) AS total_retweets,
               AVG(ft.engagement_rate) AS avg_engagement_rate
        FROM fact_tweet_hashtags fth
        JOIN fact_tweets ft ON ft.tweet_id = fth.tweet_id
        WHERE ft.created_at >= NOW() - INTERVAL '1 day' * %s
        GROUP BY fth.hashtag
        ORDER BY total_likes DESC
    """
    return query(sql, (days,))


@app.get("/api/twitter/heatmap")
def twitter_heatmap() -> list[dict]:
    sql = """
        SELECT fth.hashtag, da.account_name, COUNT(*) AS tweet_count,
               SUM(ft.likes) AS total_likes
        FROM fact_tweet_hashtags fth
        JOIN fact_tweets ft ON ft.tweet_id = fth.tweet_id
        JOIN dim_accounts da ON da.account_name = ft.account_name
        GROUP BY 1, 2
        ORDER BY total_likes DESC
    """
    return query(sql)
