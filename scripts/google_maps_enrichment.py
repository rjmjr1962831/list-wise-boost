"""
Google Maps Places API Enrichment Script
=========================================
Enriches professionals table with Google Business data.
If agent has NOT verified their profile (claim_status != 'claimed'),
replaces the phone on file with the Google Maps business phone.

SETUP:
  cd C:\\Users\\rober\\list-wise-boost
  pip install requests python-dotenv

Secrets: Use .env (GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY) or fallbacks.

SQL (run in Supabase SQL Editor FIRST if columns don't exist):
  ALTER TABLE professionals
    ADD COLUMN IF NOT EXISTS google_business_name TEXT,
    ADD COLUMN IF NOT EXISTS google_address TEXT,
    ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
    ADD COLUMN IF NOT EXISTS google_review_count INTEGER,
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
    ADD COLUMN IF NOT EXISTS google_phone TEXT,
    ADD COLUMN IF NOT EXISTS google_enriched_at TIMESTAMPTZ;

RUN (all unenriched agents, 10 concurrent workers):
  python scripts/google_maps_enrichment.py

RUN (test on 10 agents only):
  python scripts/google_maps_enrichment.py --test

RUN (background, full enrichment):
  python scripts/google_maps_enrichment.py 1> google_enrichment.out 2>&1 &
"""

import argparse
import os
import sys
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

GOOGLE_API_KEY = os.getenv(
    "GOOGLE_API_KEY",
    "AIzaSyDqQmYg4j5_lG_OzNjMSc0eXK0Xz2VqUyk",
)
SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    "https://wiotrvoirdgzfacuuiem.supabase.co",
)
SUPABASE_KEY = os.getenv(
    "SUPABASE_SERVICE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgxNzA3NywiZXhwIjoyMDg1MzkzMDc3fQ"
    ".pDoL9EYI7ta4nvlkMGaZhwPNYLJRwi8FgyZ8DI5X-GE",
)

BATCH_SIZE = 100
TEST_LIMIT = 10
CONCURRENCY = 10
DELAY_SECONDS = 0.2  # per worker between API call and DB write
LOG_FILE = "google_enrichment.log"

# Google Places (New) endpoint
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = (
    "places.displayName,"
    "places.formattedAddress,"
    "places.rating,"
    "places.userRatingCount,"
    "places.googleMapsUri,"
    "places.nationalPhoneNumber"
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("google_enrichment")


# ---------------------------------------------------------------------------
# Google Places search
# ---------------------------------------------------------------------------
def search_google_places(name: str, city: str, state: str) -> dict | None:
    """
    Search Google Places (New) Text Search for a real estate agent.
    Returns a dict of enrichment fields or None if not found.
    """
    if not name or not city or not state:
        log.warning("  Skip: missing name, city, or state")
        return None

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK,
    }
    body = {
        "textQuery": f"{name} real estate agent {city} {state}",
    }

    try:
        resp = requests.post(
            PLACES_SEARCH_URL, headers=headers, json=body, timeout=15
        )
    except requests.RequestException as e:
        log.error(f"  Network error: {e}")
        return None

    if resp.status_code != 200:
        log.error(f"  API {resp.status_code}: {resp.text[:300]}")
        return None

    places = resp.json().get("places", [])
    if not places:
        return None

    p = places[0]
    return {
        "google_business_name": (p.get("displayName") or {}).get("text"),
        "google_address": p.get("formattedAddress"),
        "google_rating": p.get("rating"),
        "google_review_count": p.get("userRatingCount"),
        "google_maps_url": p.get("googleMapsUri"),
        "google_phone": p.get("nationalPhoneNumber"),
        "google_enriched_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Supabase REST API (no supabase package needed)
# ---------------------------------------------------------------------------
def supabase_get(
    table: str,
    select: str,
    filters: dict,
    limit: int,
    offset: int,
) -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = {
        "select": select,
        "order": "id.asc",
        "limit": limit,
        "offset": offset,
    }
    params.update(filters)
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json() if resp.text else []


def supabase_patch(table: str, id_val: str, data: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    resp = requests.patch(
        url, params={"id": f"eq.{id_val}"}, json=data, headers=headers, timeout=30
    )
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Process single agent (runs in worker thread)
# ---------------------------------------------------------------------------
def process_agent(agent: dict, stats: dict, stats_lock: threading.Lock) -> None:
    """Process one agent: Google lookup, then Supabase update."""
    aid = agent["id"]
    name = agent.get("name", "")
    claim_status = agent.get("claim_status", "unclaimed")

    cities = agent.get("cities")
    if isinstance(cities, dict):
        city = cities.get("name", "") or ""
        state = cities.get("state", "") or ""
    else:
        city = ""
        state = ""

    if not city or not state:
        with stats_lock:
            stats["errors"] += 1
            stats["processed"] += 1
        log.warning("  %s: no city/state. Skipping.", name or "(no name)")
        try:
            supabase_patch(
                "professionals",
                aid,
                {"google_enriched_at": datetime.now(timezone.utc).isoformat()},
            )
        except Exception as e:
            log.error("  %s: patch failed: %s", name, e)
        return

    try:
        google_data = search_google_places(name, city, state)

        if google_data:
            google_phone = google_data.get("google_phone")
            if claim_status != "claimed" and google_phone:
                google_data["phone"] = google_phone
                with stats_lock:
                    stats["phones_replaced"] += 1
                log.info("  %s: phone -> %s", name, google_phone)

            supabase_patch("professionals", aid, google_data)
            time.sleep(DELAY_SECONDS)
            with stats_lock:
                stats["found"] += 1
                stats["processed"] += 1
            rating = google_data.get("google_rating")
            count = google_data.get("google_review_count")
            log.info("  %s: FOUND %s stars, %s reviews", name, rating, count)
        else:
            supabase_patch(
                "professionals",
                aid,
                {"google_enriched_at": datetime.now(timezone.utc).isoformat()},
            )
            with stats_lock:
                stats["not_found"] += 1
                stats["processed"] += 1
            log.info("  %s: NOT FOUND", name)

    except Exception as e:
        with stats_lock:
            stats["errors"] += 1
        log.error("  %s: ERROR %s", name, e)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Process only 10 agents")
    parser.add_argument(
        "--concurrent",
        type=int,
        default=CONCURRENCY,
        help=f"Max concurrent workers (default {CONCURRENCY})",
    )
    args = parser.parse_args()
    test_mode = args.test
    concurrency = max(1, min(args.concurrent, 20))

    log.info("Connected to Supabase (wiotrvoirdgzfacuuiem)")
    log.info("Concurrency: %d workers", concurrency)
    if test_mode:
        log.info("TEST MODE: limiting to %d agents", TEST_LIMIT)

    stats = {"processed": 0, "found": 0, "not_found": 0, "errors": 0, "phones_replaced": 0}
    stats_lock = threading.Lock()
    offset = 0
    processed_total = 0

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        while True:
            select = "id,name,phone,claim_status,cities(name,state)"
            try:
                agents = supabase_get(
                    "professionals",
                    select,
                    {"google_enriched_at": "is.null"},
                    BATCH_SIZE,
                    offset,
                )
            except requests.RequestException as e:
                log.error("Supabase fetch failed: %s", e)
                break

            if not agents:
                log.info("No more agents to enrich.")
                break

            if test_mode:
                agents = agents[:TEST_LIMIT - processed_total]
                if not agents:
                    break

            log.info("Batch offset %d: %d agents -> %d workers", offset, len(agents), concurrency)

            futures = [executor.submit(process_agent, a, stats, stats_lock) for a in agents]
            for _ in as_completed(futures):
                pass

            processed_total += len(agents)
            log.info("Progress: %d done | found=%d not_found=%d errors=%d phones_replaced=%d",
                     stats["processed"], stats["found"], stats["not_found"], stats["errors"], stats["phones_replaced"])

            if test_mode:
                log.info("TEST LIMIT reached. Stopping.")
                break

            offset += BATCH_SIZE

    log.info("=" * 60)
    log.info("ENRICHMENT COMPLETE")
    log.info("  Processed:       %s", stats["processed"])
    log.info("  Found:           %s", stats["found"])
    log.info("  Not Found:       %s", stats["not_found"])
    log.info("  Errors:          %s", stats["errors"])
    log.info("  Phones Replaced: %s", stats["phones_replaced"])
    log.info("=" * 60)


if __name__ == "__main__":
    main()
