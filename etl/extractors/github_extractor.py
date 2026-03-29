import os
import time
import logging
from typing import Generator
import requests

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"
LANGUAGES = ["Python", "JavaScript", "Go", "Rust", "Java"]
PAGES_PER_LANGUAGE = 3
PER_PAGE = 30


def _get_headers() -> dict:
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _fetch_repos_page(language: str, page: int, session: requests.Session) -> list:
    params = {
        "q": f"language:{language} stars:>100",
        "sort": "stars",
        "order": "desc",
        "per_page": PER_PAGE,
        "page": page,
    }
    resp = session.get(f"{GITHUB_API}/search/repositories", params=params, headers=_get_headers(), timeout=30)
    if resp.status_code == 403:
        reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
        wait = max(reset_ts - int(time.time()), 1)
        logger.warning("Rate limited. Sleeping %s seconds.", wait)
        time.sleep(wait)
        resp = session.get(f"{GITHUB_API}/search/repositories", params=params, headers=_get_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json().get("items", [])


def _parse_repo(item: dict, language: str) -> dict:
    return {
        "repo_id": item["id"],
        "repo_name": item["full_name"],
        "owner": item["owner"]["login"],
        "language": language,
        "stars": item.get("stargazers_count", 0),
        "forks": item.get("forks_count", 0),
        "open_issues": item.get("open_issues_count", 0),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def extract() -> Generator[dict, None, None]:
    session = requests.Session()
    seen_ids: set = set()
    for language in LANGUAGES:
        for page in range(1, PAGES_PER_LANGUAGE + 1):
            try:
                items = _fetch_repos_page(language, page, session)
            except requests.HTTPError as exc:
                logger.error("Failed fetching %s page %s: %s", language, page, exc)
                break
            for item in items:
                rid = item["id"]
                if rid not in seen_ids:
                    seen_ids.add(rid)
                    yield _parse_repo(item, language)
            time.sleep(0.5)
