-- ============================================================
-- Analytics Queries - Multi-Source Data Warehouse
-- Each query uses EXPLAIN ANALYZE prefix when profiling
-- ============================================================


-- Query 1: Daily transaction volume and revenue (last 30 days)
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COUNT(*) AS transaction_count,
    COUNT(*) FILTER (WHERE status = 'succeeded') AS successful_count,
    SUM(amount) FILTER (WHERE status = 'succeeded') AS daily_revenue,
    AVG(amount) FILTER (WHERE status = 'succeeded') AS avg_order_value
FROM fact_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;


-- Query 2: Weekly repo star growth by language
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('week', snapshot_ts)::DATE AS week_start,
    language_name,
    SUM(stars) AS total_stars,
    AVG(stars) AS avg_stars_per_repo,
    COUNT(DISTINCT repo_id) AS repo_count
FROM fact_repo_metrics
WHERE snapshot_ts >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2
ORDER BY 1, total_stars DESC;


-- Query 3: Daily tweet engagement trends
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COUNT(*) AS tweet_count,
    SUM(likes) AS total_likes,
    SUM(retweets) AS total_retweets,
    SUM(replies) AS total_replies,
    AVG(engagement_rate) AS avg_engagement_rate
FROM fact_tweets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;


-- Query 4: Customer lifetime value by signup month
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('month', dc.first_seen)::DATE AS signup_month,
    COUNT(DISTINCT ft.customer_id) AS customers,
    SUM(ft.amount) AS total_revenue,
    SUM(ft.amount) / NULLIF(COUNT(DISTINCT ft.customer_id), 0) AS avg_ltv,
    COUNT(ft.transaction_id) AS total_transactions
FROM dim_customers dc
JOIN fact_transactions ft ON ft.customer_id = dc.customer_id
WHERE ft.status = 'succeeded'
GROUP BY 1
ORDER BY 1;


-- Query 5: Repository growth cohorts by creation year-quarter
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('quarter', dr.created_at)::DATE AS cohort_quarter,
    dr.language_name,
    COUNT(DISTINCT dr.repo_id) AS repos_created,
    AVG(frm.stars) AS avg_current_stars,
    MAX(frm.stars) AS max_stars
FROM dim_repos dr
JOIN fact_repo_metrics frm ON frm.repo_id = dr.repo_id
WHERE dr.created_at IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, avg_current_stars DESC;


-- Query 6: Month-over-month revenue growth
EXPLAIN ANALYZE
WITH monthly_revenue AS (
    SELECT
        DATE_TRUNC('month', created_at) AS month,
        SUM(amount) AS revenue
    FROM fact_transactions
    WHERE status = 'succeeded'
    GROUP BY 1
)
SELECT
    month::DATE,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_month_revenue,
    ROUND(
        100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
        / NULLIF(LAG(revenue) OVER (ORDER BY month), 0),
        2
    ) AS mom_growth_pct
FROM monthly_revenue
ORDER BY month;


-- Query 7: Top growing repos by absolute star count
EXPLAIN ANALYZE
SELECT
    dr.repo_name,
    dr.language_name,
    dr.owner,
    MAX(frm.stars) AS current_stars,
    MAX(frm.forks) AS current_forks,
    MAX(frm.open_issues) AS open_issues
FROM dim_repos dr
JOIN fact_repo_metrics frm ON frm.repo_id = dr.repo_id
GROUP BY dr.repo_name, dr.language_name, dr.owner
ORDER BY current_stars DESC
LIMIT 20;


-- Query 8: Trending hashtags by tweet engagement (last 30 days)
EXPLAIN ANALYZE
SELECT
    fth.hashtag,
    COUNT(ft.tweet_id) AS tweet_count,
    SUM(ft.likes) AS total_likes,
    SUM(ft.retweets) AS total_retweets,
    AVG(ft.engagement_rate) AS avg_engagement_rate
FROM fact_tweet_hashtags fth
JOIN fact_tweets ft ON ft.tweet_id = fth.tweet_id
WHERE ft.created_at >= NOW() - INTERVAL '30 days'
GROUP BY fth.hashtag
ORDER BY total_likes DESC;


-- Query 9: Cross-source correlation: language popularity in repos vs tweet hashtag mentions
EXPLAIN ANALYZE
WITH repo_lang_counts AS (
    SELECT language_name, COUNT(*) AS repo_count
    FROM dim_repos
    GROUP BY language_name
),
hashtag_mention_counts AS (
    SELECT hashtag, COUNT(*) AS mention_count
    FROM fact_tweet_hashtags
    GROUP BY hashtag
)
SELECT
    rlc.language_name,
    rlc.repo_count,
    COALESCE(hmc.mention_count, 0) AS tweet_mentions,
    ROUND(
        COALESCE(hmc.mention_count, 0)::NUMERIC / NULLIF(rlc.repo_count, 0),
        4
    ) AS mentions_per_repo
FROM repo_lang_counts rlc
LEFT JOIN hashtag_mention_counts hmc ON LOWER(hmc.hashtag) = LOWER(rlc.language_name)
ORDER BY repo_count DESC;


-- Query 10: Revenue breakdown by currency
EXPLAIN ANALYZE
SELECT
    ft.currency_code,
    COUNT(*) AS transaction_count,
    COUNT(*) FILTER (WHERE status = 'succeeded') AS successful_count,
    SUM(amount) FILTER (WHERE status = 'succeeded') AS total_revenue,
    AVG(amount) FILTER (WHERE status = 'succeeded') AS avg_amount,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'succeeded') / NULLIF(COUNT(*), 0),
        2
    ) AS success_rate_pct
FROM fact_transactions ft
GROUP BY ft.currency_code
ORDER BY total_revenue DESC NULLS LAST;


-- Query 11: Top customers by total revenue with ranking
EXPLAIN ANALYZE
SELECT
    dc.customer_id,
    DATE_TRUNC('month', dc.first_seen)::DATE AS customer_since,
    COUNT(ft.transaction_id) AS num_transactions,
    SUM(ft.amount) AS total_spent,
    AVG(ft.amount) AS avg_transaction_value,
    MAX(ft.created_at) AS last_transaction,
    RANK() OVER (ORDER BY SUM(ft.amount) DESC) AS revenue_rank
FROM dim_customers dc
JOIN fact_transactions ft ON ft.customer_id = dc.customer_id
WHERE ft.status = 'succeeded'
GROUP BY dc.customer_id, dc.first_seen
ORDER BY total_spent DESC
LIMIT 10;


-- Query 12: Error rate over time (failed or zero-amount transactions)
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    COUNT(*) AS total_transactions,
    COUNT(*) FILTER (WHERE status = 'failed' OR amount = 0) AS error_count,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE status = 'failed' OR amount = 0)
        / NULLIF(COUNT(*), 0),
        2
    ) AS error_rate_pct
FROM fact_transactions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;


-- Query 13: Average stars by language with percentile stats
EXPLAIN ANALYZE
SELECT
    language_name,
    COUNT(DISTINCT repo_id) AS repo_count,
    ROUND(AVG(stars)) AS avg_stars,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY stars) AS median_stars,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY stars) AS p90_stars,
    MAX(stars) AS max_stars
FROM fact_repo_metrics
GROUP BY language_name
ORDER BY avg_stars DESC;


-- Query 14: Engagement rate per account (Twitter)
EXPLAIN ANALYZE
SELECT
    da.account_name,
    COUNT(ft.tweet_id) AS tweet_count,
    SUM(ft.likes) AS total_likes,
    SUM(ft.retweets) AS total_retweets,
    SUM(ft.impressions) AS total_impressions,
    ROUND(AVG(ft.engagement_rate) * 100, 4) AS avg_engagement_rate_pct,
    SUM(ft.likes + ft.retweets + ft.replies) AS total_interactions
FROM dim_accounts da
JOIN fact_tweets ft ON ft.account_name = da.account_name
GROUP BY da.account_name
ORDER BY avg_engagement_rate_pct DESC;


-- Query 15: Running total revenue per customer (window function)
EXPLAIN ANALYZE
SELECT
    customer_id,
    created_at::DATE AS transaction_date,
    amount,
    SUM(amount) OVER (
        PARTITION BY customer_id
        ORDER BY created_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at) AS txn_sequence
FROM fact_transactions
WHERE status = 'succeeded'
ORDER BY customer_id, created_at
LIMIT 200;


-- Query 16: Heatmap data - language vs star bucket
EXPLAIN ANALYZE
SELECT
    language_name,
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
ORDER BY 1, MIN(stars);


-- Query 17: Heatmap data - currency vs amount bucket
EXPLAIN ANALYZE
SELECT
    currency_code,
    amount_bucket,
    COUNT(*) AS transaction_count,
    SUM(amount) AS bucket_revenue
FROM fact_transactions
WHERE status = 'succeeded'
GROUP BY 1, 2
ORDER BY 1, 2;


-- Query 18: Daily active repos (repos with updated_at on that day)
EXPLAIN ANALYZE
SELECT
    DATE_TRUNC('day', updated_at)::DATE AS day,
    language_name,
    COUNT(DISTINCT repo_id) AS repos_updated
FROM fact_repo_metrics
WHERE updated_at >= NOW() - INTERVAL '90 days'
GROUP BY 1, 2
ORDER BY 1, repos_updated DESC;
