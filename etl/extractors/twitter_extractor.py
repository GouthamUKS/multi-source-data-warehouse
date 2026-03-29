import random
import uuid
from datetime import datetime, timedelta
from typing import Generator

ACCOUNTS = [
    "techcrunch", "verge", "wired", "acloudguru", "awscloud",
    "docker", "kubernetesio", "golang", "rustlang", "nodejs",
    "python", "javascript", "databricks", "snowflakedb", "hashicorp",
    "github", "gitlab", "linuxfoundation", "cncfcloud", "datadotworld",
]
HASHTAGS = ["Python", "JavaScript", "Go", "Rust", "AWS", "Docker", "Kubernetes", "DataEng"]
NUM_TWEETS = 300

_rng = random.Random(7)


def _power_law(scale: float = 1.0, exponent: float = 2.5) -> int:
    u = _rng.random()
    val = int(scale * (1.0 / (u + 1e-9)) ** (1.0 / (exponent - 1.0)))
    return min(val, 500_000)


def _random_date(days_back: int = 90) -> datetime:
    offset = timedelta(
        days=_rng.randint(0, days_back),
        hours=_rng.randint(0, 23),
        minutes=_rng.randint(0, 59),
    )
    return datetime.utcnow() - offset


def _pick_hashtags(k_min: int = 1, k_max: int = 4) -> list:
    k = _rng.randint(k_min, k_max)
    return _rng.sample(HASHTAGS, min(k, len(HASHTAGS)))


def extract() -> Generator[dict, None, None]:
    for _ in range(NUM_TWEETS):
        likes = _power_law(scale=5, exponent=2.2)
        retweets = int(likes * _rng.uniform(0.05, 0.35))
        replies = int(likes * _rng.uniform(0.01, 0.15))
        yield {
            "tweet_id": f"tw_{uuid.uuid4().hex}",
            "account": _rng.choice(ACCOUNTS),
            "hashtags": _pick_hashtags(),
            "likes": likes,
            "retweets": retweets,
            "replies": replies,
            "impressions": likes * _rng.randint(10, 80),
            "created_at": _random_date().isoformat(),
        }
