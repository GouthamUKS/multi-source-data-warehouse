from datetime import datetime
from typing import Iterator


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except ValueError:
        return None


def transform(records: Iterator[dict]) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    dim_accounts: dict[str, dict] = {}
    dim_hashtags: dict[str, dict] = {}
    fact_tweets = []
    fact_tweet_hashtags = []

    for rec in records:
        account = rec["account"]
        if account not in dim_accounts:
            dim_accounts[account] = {"account_name": account}

        for tag in rec.get("hashtags", []):
            if tag not in dim_hashtags:
                dim_hashtags[tag] = {"hashtag": tag}
            fact_tweet_hashtags.append({"tweet_id": rec["tweet_id"], "hashtag": tag})

        impressions = int(rec.get("impressions") or 0)
        likes = int(rec.get("likes") or 0)
        engagement_rate = round(likes / impressions, 6) if impressions > 0 else 0.0

        fact_tweets.append(
            {
                "tweet_id": rec["tweet_id"],
                "account_name": account,
                "likes": likes,
                "retweets": int(rec.get("retweets") or 0),
                "replies": int(rec.get("replies") or 0),
                "impressions": impressions,
                "engagement_rate": engagement_rate,
                "created_at": _parse_dt(rec["created_at"]),
            }
        )

    return list(dim_accounts.values()), list(dim_hashtags.values()), fact_tweets, fact_tweet_hashtags
