-- ============================================================
-- Multi-Source Data Warehouse Schema
-- Star schema covering GitHub, Stripe, and Twitter sources
-- ============================================================

-- ============================================================
-- GitHub dimension tables
-- ============================================================

CREATE TABLE IF NOT EXISTS dim_languages (
    language_name VARCHAR(64) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS dim_repos (
    repo_id        BIGINT PRIMARY KEY,
    repo_name      VARCHAR(256) NOT NULL,
    owner          VARCHAR(128) NOT NULL,
    language_name  VARCHAR(64) REFERENCES dim_languages(language_name),
    created_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dim_repos_language ON dim_repos(language_name);
CREATE INDEX IF NOT EXISTS idx_dim_repos_owner ON dim_repos(owner);

-- ============================================================
-- GitHub fact table
-- ============================================================

CREATE TABLE IF NOT EXISTS fact_repo_metrics (
    id            BIGSERIAL PRIMARY KEY,
    repo_id       BIGINT NOT NULL REFERENCES dim_repos(repo_id),
    language_name VARCHAR(64) REFERENCES dim_languages(language_name),
    stars         INT NOT NULL DEFAULT 0,
    forks         INT NOT NULL DEFAULT 0,
    open_issues   INT NOT NULL DEFAULT 0,
    snapshot_ts   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ,
    UNIQUE (repo_id, snapshot_ts)
);

CREATE INDEX IF NOT EXISTS idx_fact_repo_metrics_repo_id ON fact_repo_metrics(repo_id);
CREATE INDEX IF NOT EXISTS idx_fact_repo_metrics_snapshot_ts ON fact_repo_metrics(snapshot_ts);
CREATE INDEX IF NOT EXISTS idx_fact_repo_metrics_language ON fact_repo_metrics(language_name);
CREATE INDEX IF NOT EXISTS idx_fact_repo_metrics_stars ON fact_repo_metrics(stars DESC);

-- ============================================================
-- Stripe dimension tables
-- ============================================================

CREATE TABLE IF NOT EXISTS dim_currencies (
    currency_code CHAR(3) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS dim_customers (
    customer_id VARCHAR(64) PRIMARY KEY,
    first_seen  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dim_customers_first_seen ON dim_customers(first_seen);

-- ============================================================
-- Stripe fact table
-- ============================================================

CREATE TABLE IF NOT EXISTS fact_transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    customer_id    VARCHAR(64) NOT NULL REFERENCES dim_customers(customer_id),
    currency_code  CHAR(3) NOT NULL REFERENCES dim_currencies(currency_code),
    amount         NUMERIC(14, 2) NOT NULL DEFAULT 0,
    amount_bucket  VARCHAR(16),
    status         VARCHAR(16) NOT NULL,
    payment_method VARCHAR(32),
    created_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fact_txn_customer ON fact_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_fact_txn_created ON fact_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_txn_currency ON fact_transactions(currency_code);
CREATE INDEX IF NOT EXISTS idx_fact_txn_status ON fact_transactions(status);

-- ============================================================
-- Twitter dimension tables
-- ============================================================

CREATE TABLE IF NOT EXISTS dim_accounts (
    account_name VARCHAR(64) PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS dim_hashtags (
    hashtag VARCHAR(128) PRIMARY KEY
);

-- ============================================================
-- Twitter fact tables
-- ============================================================

CREATE TABLE IF NOT EXISTS fact_tweets (
    tweet_id        VARCHAR(64) PRIMARY KEY,
    account_name    VARCHAR(64) NOT NULL REFERENCES dim_accounts(account_name),
    likes           INT NOT NULL DEFAULT 0,
    retweets        INT NOT NULL DEFAULT 0,
    replies         INT NOT NULL DEFAULT 0,
    impressions     INT NOT NULL DEFAULT 0,
    engagement_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fact_tweets_account ON fact_tweets(account_name);
CREATE INDEX IF NOT EXISTS idx_fact_tweets_created ON fact_tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_tweets_likes ON fact_tweets(likes DESC);

CREATE TABLE IF NOT EXISTS fact_tweet_hashtags (
    tweet_id VARCHAR(64) NOT NULL REFERENCES fact_tweets(tweet_id),
    hashtag  VARCHAR(128) NOT NULL REFERENCES dim_hashtags(hashtag),
    PRIMARY KEY (tweet_id, hashtag)
);

CREATE INDEX IF NOT EXISTS idx_fact_tweet_hashtags_hashtag ON fact_tweet_hashtags(hashtag);
