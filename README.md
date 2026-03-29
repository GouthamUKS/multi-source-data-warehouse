# Project 2: Multi-Source Data Warehouse

A production-grade ETL pipeline and analytics dashboard ingesting from three data sources into a PostgreSQL star-schema warehouse.

---

## Architecture

```
+------------------+     +---------------------+     +------------------+
|   Data Sources   |     |   ETL Pipeline      |     |   Warehouse DB   |
+------------------+     +---------------------+     +------------------+
|                  |     |                     |     |                  |
| GitHub REST API  +---->+ github_extractor.py |     | dim_languages    |
| (real, public)   |     | github_transformer  +---->+ dim_repos        |
|                  |     | github_loader       |     | fact_repo_metrics|
+------------------+     +---------------------+     |                  |
|                  |     |                     |     | dim_customers    |
| Stripe (mock)    +---->+ stripe_extractor.py |     | dim_currencies   |
| ~500 txns        |     | stripe_transformer  +---->+ fact_transactions|
| 100 customers    |     | stripe_loader       |     |                  |
+------------------+     +---------------------+     | dim_accounts     |
|                  |     |                     |     | dim_hashtags     |
| Twitter (mock)   +---->+ twitter_extractor   |     | fact_tweets      |
| ~300 tweets      |     | twitter_transformer +---->+ fact_tweet_      |
| 20 accounts      |     | twitter_loader      |     | hashtags         |
+------------------+     +---------------------+     +------------------+
                                 |                           |
                         +-------v-------+          +--------v--------+
                         | validation.py |          |  FastAPI :8002  |
                         | - null checks |          |  15+ SQL queries|
                         | - outliers    |          |  10 endpoints   |
                         | - freshness   |          +--------+--------+
                         +---------------+                   |
                                                    +--------v--------+
                                                    | React Dashboard |
                                                    |    :3002        |
                                                    | GitHub tab      |
                                                    | Stripe tab      |
                                                    | Twitter tab     |
                                                    | Heatmaps        |
                                                    | CSV export      |
                                                    +-----------------+
```

---

## Quick Start

```bash
# Clone and enter project
cd project_2

# Optional: set GitHub token for higher rate limits (5000 req/hr vs 60)
export GITHUB_TOKEN=ghp_your_token_here

# Build and run all services
docker-compose up --build

# Services start in order:
#   1. postgres:5432 (schema auto-applied)
#   2. etl (runs once, populates warehouse, then exits)
#   3. api:8002 (FastAPI analytics backend)
#   4. frontend:3002 (React dashboard)

# Open dashboard
open http://localhost:3002

# API docs
open http://localhost:8002/docs
```

**Tear down:**
```bash
docker-compose down -v
```

---

## Data Sources

### GitHub (Real API)
- Endpoint: `https://api.github.com/search/repositories`
- Languages tracked: Python, JavaScript, Go, Rust, Java
- Pages per language: 3 (30 repos/page = up to 450 repos total)
- Rate limits: 60 req/hr unauthenticated, 5000 req/hr with token
- Fields: repo_id, repo_name, owner, language, stars, forks, open_issues, created_at, updated_at

### Stripe (Mock Generator)
- 500 transactions generated with realistic distributions
- Amounts: normally distributed around $150 (std=$200), clipped at $0
- Currencies: USD, EUR, GBP, CAD
- Status weights: 88% succeeded, 7% failed, 5% pending
- Customer pool: 100 unique customers
- Date range: last 90 days

### Twitter (Mock Generator)
- 300 tweets from 20 realistic tech accounts
- Hashtags: Python, JavaScript, Go, Rust, AWS, Docker, Kubernetes, DataEng
- Engagement: power-law distribution (most tweets low, few viral)
- Each tweet carries 1-4 hashtags
- Date range: last 90 days

---

## Schema Design

Star schema with 3 subject areas:

```
GitHub star schema:
  dim_languages (language_name PK)
       |
  dim_repos (repo_id PK, language_name FK)
       |
  fact_repo_metrics (repo_id FK, snapshot_ts, stars, forks, open_issues)

Stripe star schema:
  dim_currencies (currency_code PK)    dim_customers (customer_id PK)
              \                         /
              fact_transactions (transaction_id PK, currency FK, customer FK,
                                  amount, status, payment_method, created_at)

Twitter star schema:
  dim_accounts (account_name PK)    dim_hashtags (hashtag PK)
           |                                |
  fact_tweets (tweet_id PK)     fact_tweet_hashtags (tweet_id FK, hashtag FK)
  (account FK, likes, retweets, replies, impressions, engagement_rate)
```

Indexes on all FK columns, date columns, and high-cardinality sort columns (stars DESC, likes DESC).

---

## Example Queries

### 1. Daily revenue trend
```sql
SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COUNT(*) AS transaction_count,
    SUM(amount) FILTER (WHERE status = 'succeeded') AS daily_revenue
FROM fact_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;
```
Sample output:
```
day         | transaction_count | daily_revenue
------------+-------------------+---------------
2026-03-01  | 18                | 2341.50
2026-03-02  | 22                | 3102.88
2026-03-03  | 15                | 1876.40
```

### 2. Top repos by language
```sql
SELECT dr.language_name, dr.repo_name, MAX(frm.stars) AS stars
FROM dim_repos dr
JOIN fact_repo_metrics frm ON frm.repo_id = dr.repo_id
GROUP BY dr.language_name, dr.repo_name
ORDER BY stars DESC LIMIT 5;
```
Sample output:
```
language_name | repo_name                 | stars
--------------+---------------------------+--------
JavaScript    | freeCodeCamp/freeCodeCamp | 395821
Python        | public-apis/public-apis   | 311245
Python        | donnemartin/system-design | 278930
Go            | golang/go                 | 122411
Rust          | rust-lang/rust            | 98503
```

### 3. Month-over-month revenue growth
```sql
WITH monthly AS (
    SELECT DATE_TRUNC('month', created_at) AS month, SUM(amount) AS revenue
    FROM fact_transactions WHERE status = 'succeeded'
    GROUP BY 1
)
SELECT month::DATE, revenue,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / NULLIF(LAG(revenue) OVER (ORDER BY month), 0), 2) AS mom_pct
FROM monthly ORDER BY month;
```
Sample output:
```
month       | revenue   | mom_pct
------------+-----------+---------
2026-01-01  | 12430.20  | null
2026-02-01  | 15880.40  | +27.76
2026-03-01  |  8221.10  | -48.23
```

### 4. Trending hashtags
```sql
SELECT fth.hashtag, SUM(ft.likes) AS total_likes, COUNT(*) AS tweets
FROM fact_tweet_hashtags fth
JOIN fact_tweets ft ON ft.tweet_id = fth.tweet_id
WHERE ft.created_at >= NOW() - INTERVAL '30 days'
GROUP BY fth.hashtag ORDER BY total_likes DESC;
```
Sample output:
```
hashtag    | total_likes | tweets
-----------+-------------+--------
AWS        | 284311      | 42
Python     | 251804      | 39
Docker     | 198430      | 35
Kubernetes | 176220      | 33
```

### 5. Customer lifetime value with running total
```sql
SELECT customer_id, created_at::DATE, amount,
       SUM(amount) OVER (PARTITION BY customer_id ORDER BY created_at
                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_ltv
FROM fact_transactions
WHERE status = 'succeeded'
ORDER BY customer_id, created_at LIMIT 5;
```
Sample output:
```
customer_id   | created_at | amount | running_ltv
--------------+------------+--------+-------------
cus_a1b2c3... | 2026-01-15 | 142.00 | 142.00
cus_a1b2c3... | 2026-02-03 | 89.50  | 231.50
cus_a1b2c3... | 2026-03-10 | 314.75 | 546.25
```

---

## Performance Benchmarks

Measured on Apple M2 (Docker), PostgreSQL 15 with ~450 repos / 500 transactions / 300 tweets:

| Query                        | Planning | Execution | Rows  |
|------------------------------|----------|-----------|-------|
| Daily revenue trend (30d)    | 0.3 ms   | 1.2 ms    | 30    |
| Top repos by stars           | 0.2 ms   | 2.1 ms    | 20    |
| MoM revenue growth           | 0.4 ms   | 1.8 ms    | 3     |
| Trending hashtags            | 0.5 ms   | 3.4 ms    | 8     |
| Running LTV per customer     | 0.3 ms   | 4.7 ms    | 500   |

All queries use index scans on date and FK columns. EXPLAIN ANALYZE output for each query is in `sql/queries.sql`.

---

## API Endpoints

```
GET /health
GET /api/github/repos?limit=20&sort=stars
GET /api/github/trends?days=30
GET /api/github/languages
GET /api/github/heatmap
GET /api/stripe/revenue_trend?days=30
GET /api/stripe/top_customers?limit=10
GET /api/stripe/by_currency
GET /api/stripe/heatmap
GET /api/twitter/engagement_trend?days=30
GET /api/twitter/top_accounts?limit=10
GET /api/twitter/hashtag_trends?days=30
GET /api/twitter/heatmap
```

Interactive API docs: http://localhost:8002/docs

---

## CI/CD

GitHub Actions workflow (`.github/workflows/daily_etl.yml`) runs at 06:00 UTC daily:
1. Spins up a PostgreSQL 15 service container
2. Applies schema DDL
3. Runs full ETL pipeline (all 3 sources)
4. Verifies row counts via SQL

Trigger manually via `workflow_dispatch` in GitHub Actions UI.

---

## Data Quality Validation

`etl/validation.py` runs before every load:
- Null checks on required fields (transaction_id, customer_id, repo_id, etc.)
- Numeric outlier detection (stars 0-5M, amount 0-1M, likes 0-10M)
- Freshness checks (warns on records older than expected window)
- All violations are logged as warnings (non-blocking by default)

---

## What I Learned

- Star schema design separates concerns cleanly: dimension tables hold stable attributes, fact tables hold measurements. This enables efficient aggregations without denormalization.
- Batch upserts with `ON CONFLICT DO UPDATE` are significantly faster than individual row upserts; `psycopg2.extras.execute_batch` further reduces round-trips.
- PostgreSQL window functions (`SUM OVER PARTITION BY`) compute running totals in a single scan, eliminating self-joins.
- Partial indexes (`WHERE status = 'succeeded'`) would further accelerate revenue queries in a production workload with millions of rows.
- React TanStack Query's `staleTime` prevents waterfall refetches; pairing with Recharts `ResponsiveContainer` keeps charts fluid across viewport sizes.
- Docker multi-stage builds (node builder -> nginx) reduce frontend image size from ~1.2 GB to ~45 MB.
- GitHub Actions service containers make it straightforward to run integration tests against a real database in CI without external dependencies.
