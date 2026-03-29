from datetime import datetime, timezone
from typing import Iterator


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except ValueError:
        return None


def transform(records: Iterator[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    dim_repos = []
    dim_languages = {}
    fact_metrics = []

    for rec in records:
        lang = rec.get("language") or "Unknown"
        if lang not in dim_languages:
            dim_languages[lang] = {"language_name": lang}

        dim_repos.append(
            {
                "repo_id": rec["repo_id"],
                "repo_name": rec["repo_name"],
                "owner": rec["owner"],
                "language_name": lang,
                "created_at": _parse_dt(rec.get("created_at")),
            }
        )

        fact_metrics.append(
            {
                "repo_id": rec["repo_id"],
                "language_name": lang,
                "stars": int(rec.get("stars") or 0),
                "forks": int(rec.get("forks") or 0),
                "open_issues": int(rec.get("open_issues") or 0),
                "snapshot_ts": datetime.now(timezone.utc),
                "updated_at": _parse_dt(rec.get("updated_at")),
            }
        )

    return dim_repos, list(dim_languages.values()), fact_metrics
