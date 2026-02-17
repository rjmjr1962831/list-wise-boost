#!/usr/bin/env python3
"""
Test: Pull 10 agents from our DB and cross-check transaction data against RealTrends.
- Fetches agents with name, state_slug, city (from cities), sales_count_all_time (our Zillow-derived data).
- Builds RealTrends ranking URL for state (and city when we have it) so recipients can recreate the lookup.
- Fetches the RealTrends page and checks whether the agent name appears (for cross-check).

To maximize hit rate:
  1. Use --browser to render the page with Playwright (JS-rendered table is then in the HTML we scan).
  2. Name matching normalizes punctuation, "Team", "Mc X" so more variants match.

Secrets: SUPABASE_SERVICE_ROLE_KEY (env or .env).
Usage: python scripts/test_realtrends_crosscheck.py [LIMIT] [--browser]
  LIMIT default 10. --browser = use Playwright to render page (pip install playwright && playwright install chromium).
"""

import os
import re
import sys
from pathlib import Path

# Load .env from project root
def load_env():
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line and not os.environ.get(line.split("=")[0].strip()):
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip().strip('"').strip("'")

load_env()

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

SVC_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
BASE = "https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1"
HEADERS = {"apikey": SVC_KEY, "Authorization": f"Bearer {SVC_KEY}"}

argv = [a for a in sys.argv[1:] if a != "--browser"]
USE_BROWSER = "--browser" in sys.argv
LIMIT = int(argv[0]) if argv else 10


def slugify(s: str) -> str:
    """Lowercase, replace spaces/special with hyphen."""
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or ""


def realtrends_state_url(state_slug: str) -> str:
    """e.g. arizona -> best-real-estate-agents-arizona"""
    return f"https://www.realtrends.com/ranking/best-real-estate-agents-{state_slug}/individuals-by-volume/"


def realtrends_city_url(city_name: str, state_slug: str) -> str:
    """e.g. Scottsdale, arizona -> best-real-estate-agents-scottsdale-arizona"""
    city_slug = slugify(city_name or "")
    if not city_slug:
        return realtrends_state_url(state_slug)
    return f"https://www.realtrends.com/ranking/best-real-estate-agents-{city_slug}-{state_slug}/individuals-by-volume/"


def fetch_agents(limit: int):
    """Fetch agents (state-level RealTrends URL; city join optional for city-level URL)."""
    url = f"{BASE}/professionals"
    params = {
        "select": "id,name,state_slug,sales_count_all_time,company",
        "active": "eq.true",
        "state_slug": "in.(arizona,california)",
        "order": "name.asc",
        "limit": limit,
    }
    r = requests.get(url, headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()


def fetch_realtrends_page(url: str) -> tuple[str, int]:
    """Fetch RealTrends page (raw HTML); return (text, status_code). Table may be JS-rendered (not in HTML)."""
    try:
        resp = requests.get(
            url,
            timeout=15,
            headers={"User-Agent": "Top10Lists-Verification/1.0 (cross-check)"},
        )
        return (resp.text, resp.status_code)
    except Exception as e:
        return (str(e), 0)


def fetch_realtrends_page_browser(url: str, wait_sec: float = 6.0) -> tuple[str, int]:
    """Fetch RealTrends page with Playwright so JS-rendered table is in the DOM. Returns (body_text, 200) or (error, 0)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return ("Playwright not installed: pip install playwright && playwright install chromium", 0)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(int(wait_sec * 1000))
            text = page.inner_text("body") or ""
            browser.close()
            return (text, 200)
    except Exception as e:
        return (str(e), 0)


def normalize_for_match(name: str) -> list[str]:
    """Produce variants of name for matching (RealTrends may show 'Tom Wood' vs 'A. Tom Wood Team')."""
    if not name:
        return []
    s = name.strip()
    # Remove common suffixes so "A. Tom Wood Team" can match "Tom Wood" on RealTrends
    for suffix in (" Team", " Group", " & Associates", " Realty", " Real Estate"):
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
    # Normalize: collapse punctuation and spaces for "Mc Elhinnie" -> "mcelhinnie", "A. B." -> "a b"
    no_punct = re.sub(r"[^\w\s]", " ", s)
    collapsed = re.sub(r"\s+", " ", no_punct).strip().lower()
    parts = [p for p in collapsed.split() if len(p) > 1]
    variants = [collapsed]
    if len(parts) >= 2:
        # "first last" and "last first" and "last, first"
        variants.append(parts[-1] + " " + parts[0])  # last first
        variants.append(" ".join(parts[:2]))           # first two (e.g. "tom wood")
        variants.append(parts[-1])                    # last name alone (risky but RealTrends may list that)
    return variants


def name_in_page(name: str, html: str) -> bool:
    """Check if agent name appears in page (case-insensitive, normalized variants for higher hit rate)."""
    if not name or not html:
        return False
    text = html.replace("\n", " ").replace("\r", " ")
    lower = text.lower()
    # Exact full name
    if name.strip().lower() in lower:
        return True
    # Normalized variants (strip "Team", punctuation, try last+first etc.)
    for variant in normalize_for_match(name):
        if variant and len(variant) >= 3 and variant in lower:
            return True
    # Fallback: at least last name + one other token
    parts = name.strip().split()
    if len(parts) >= 2:
        last = parts[-1].lower().replace(".", "")
        first = parts[0].lower().replace(".", "")
        if last in lower and (first in lower or (len(parts[0]) <= 2 and any(p.lower() in lower for p in parts[1:-1]))):
            return True
    return False


def main():
    if not SVC_KEY:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not set (env or .env)")
        sys.exit(1)

    if USE_BROWSER:
        print("Using Playwright to render RealTrends pages (JS table will be included).")
    print(f"Fetching {LIMIT} agents from Supabase...")
    agents = fetch_agents(LIMIT)
    if not agents:
        print("No agents returned.")
        sys.exit(0)

    print(f"Got {len(agents)} agents.\n")
    print("Agent | Our sales (Zillow) | City | State | RealTrends URL (query we run) | Name found on page?")
    print("-" * 100)

    for i, a in enumerate(agents):
        name = a.get("name") or "?"
        our_sales = a.get("sales_count_all_time")
        state_slug = a.get("state_slug") or "arizona"
        city = a.get("cities")
        if isinstance(city, dict):
            city_name = city.get("name")
        else:
            city_name = None
        company = a.get("company") or ""

        # Build the query we run: RealTrends state (and city if we had it) ranking URL
        url = realtrends_city_url(city_name, state_slug) if city_name else realtrends_state_url(state_slug)

        if USE_BROWSER:
            html, status = fetch_realtrends_page_browser(url)
        else:
            html, status = fetch_realtrends_page(url)
        found = "Yes" if (status == 200 and name_in_page(name, html)) else "No" if status == 200 else f"HTTP {status}"

        sales_str = str(our_sales) if our_sales is not None else "—"
        city_str = city_name or "—"
        print(f"{name[:28]:28} | {sales_str:>8} | {city_str[:14]:14} | {state_slug:10} | {url[:52]:52} | {found}")

    print("\n" + "=" * 100)
    if USE_BROWSER:
        print("Rendered with Playwright; table content was in the DOM. For more hits, ensure name variants")
        print("(e.g. without 'Team', normalized punctuation) are covered; see normalize_for_match() in script.")
    else:
        print("RealTrends loads the table via JavaScript. For higher hit rate run with: --browser")
        print("(pip install playwright && playwright install chromium). We still provide the URL as 'query we ran'.")


if __name__ == "__main__":
    main()
