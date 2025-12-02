#!/usr/bin/env python3
"""
Prerender.io Recache Script for Top10Lists.us

This script fetches URLs from a sitemap and sends them to Prerender.io
for recaching. Useful for ensuring bots see fresh content after updates.

Usage:
    python prerender-recache.py --token YOUR_PRERENDER_TOKEN
    python prerender-recache.py --token YOUR_PRERENDER_TOKEN --sitemap https://top10lists.us/sitemap.xml
    python prerender-recache.py --token YOUR_PRERENDER_TOKEN --urls https://top10lists.us/az/phoenix
    
Environment variable alternative:
    export PRERENDER_TOKEN=your_token_here
    python prerender-recache.py
"""

import argparse
import os
import re
import requests
import time
from typing import List

PRERENDER_API = "https://api.prerender.io/recache"
DEFAULT_SITEMAP = "https://top10lists.us/sitemap.xml"
BATCH_SIZE = 1000


def fetch_sitemap_urls(sitemap_url: str) -> List[str]:
    """Fetch and parse URLs from a sitemap XML."""
    print(f"Fetching sitemap: {sitemap_url}")
    
    response = requests.get(sitemap_url, timeout=30)
    response.raise_for_status()
    
    # Parse URLs using regex (simple approach)
    urls = re.findall(r'<loc>([^<]+)</loc>', response.text)
    
    print(f"Found {len(urls)} URLs in sitemap")
    return urls


def send_recache_batch(
    urls: List[str], 
    token: str, 
    batch_number: int,
    adaptive_type: str = "desktop"
) -> dict:
    """Send a batch of URLs to Prerender.io for recaching."""
    print(f"Sending batch {batch_number} with {len(urls)} URLs...")
    
    payload = {
        "prerenderToken": token,
        "urls": urls,
        "adaptiveType": adaptive_type
    }
    
    response = requests.post(
        PRERENDER_API,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60
    )
    
    if response.ok:
        print(f"  ✓ Batch {batch_number}: Success")
        return {"success": True, "count": len(urls), "message": response.text}
    else:
        print(f"  ✗ Batch {batch_number}: Failed - {response.status_code} {response.text}")
        return {"success": False, "count": 0, "message": f"{response.status_code}: {response.text}"}


def recache(
    token: str,
    sitemap_url: str = None,
    urls: List[str] = None,
    adaptive_type: str = "desktop"
) -> dict:
    """Main recache function."""
    all_urls = []
    
    # Fetch from sitemap if provided
    if sitemap_url:
        sitemap_urls = fetch_sitemap_urls(sitemap_url)
        all_urls.extend(sitemap_urls)
    
    # Add directly provided URLs
    if urls:
        all_urls.extend(urls)
    
    if not all_urls:
        return {"success": False, "error": "No URLs provided"}
    
    # Remove duplicates
    all_urls = list(set(all_urls))
    print(f"\nProcessing {len(all_urls)} unique URLs with adaptiveType: {adaptive_type}")
    
    # Split into batches
    batches = [all_urls[i:i + BATCH_SIZE] for i in range(0, len(all_urls), BATCH_SIZE)]
    print(f"Split into {len(batches)} batch(es)\n")
    
    # Process batches
    results = []
    success_count = 0
    failed_batches = 0
    
    for i, batch in enumerate(batches):
        result = send_recache_batch(batch, token, i + 1, adaptive_type)
        results.append(result)
        
        if result["success"]:
            success_count += result["count"]
        else:
            failed_batches += 1
        
        # Small delay between batches
        if i < len(batches) - 1:
            time.sleep(0.5)
    
    print(f"\n{'='*50}")
    print(f"Recache complete!")
    print(f"  Total URLs: {len(all_urls)}")
    print(f"  Processed: {success_count}")
    print(f"  Failed batches: {failed_batches}")
    print(f"{'='*50}")
    
    return {
        "success": failed_batches == 0,
        "total_urls": len(all_urls),
        "processed_urls": success_count,
        "total_batches": len(batches),
        "failed_batches": failed_batches
    }


def main():
    parser = argparse.ArgumentParser(
        description="Trigger Prerender.io recache for Top10Lists.us",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--token",
        default=os.environ.get("PRERENDER_TOKEN"),
        help="Prerender.io API token (or set PRERENDER_TOKEN env var)"
    )
    
    parser.add_argument(
        "--sitemap",
        default=DEFAULT_SITEMAP,
        help=f"Sitemap URL to fetch (default: {DEFAULT_SITEMAP})"
    )
    
    parser.add_argument(
        "--urls",
        nargs="+",
        help="Specific URLs to recache (in addition to sitemap)"
    )
    
    parser.add_argument(
        "--no-sitemap",
        action="store_true",
        help="Skip sitemap, only use --urls"
    )
    
    parser.add_argument(
        "--adaptive-type",
        choices=["desktop", "mobile"],
        default="desktop",
        help="Device type for rendering (default: desktop)"
    )
    
    args = parser.parse_args()
    
    if not args.token:
        print("Error: Prerender token required. Use --token or set PRERENDER_TOKEN env var")
        exit(1)
    
    sitemap = None if args.no_sitemap else args.sitemap
    
    result = recache(
        token=args.token,
        sitemap_url=sitemap,
        urls=args.urls,
        adaptive_type=args.adaptive_type
    )
    
    exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
