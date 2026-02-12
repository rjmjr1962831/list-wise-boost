#!/usr/bin/env python3
"""
Generate "Why We Selected" rationale for agents using DeepSeek.

This script:
1. Fetches active agents with synthesized_bio but no selection_rationale
2. Uses DeepSeek to generate concise selection explanation
3. Updates professionals table with the rationale

DO NOT RUN YET - Infrastructure setup only.

Usage:
  python3 generate_selection_rationale.py --limit 10 --test
  python3 generate_selection_rationale.py --all
"""

import requests
import json
import time
from datetime import datetime

# Configuration
SUPABASE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co"
ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a"
DEEPSEEK_API_KEY = "REDACTED_DEEPSEEK_KEY"

DEEPSEEK_ENDPOINT = "https://api.deepseek.com/v1/chat/completions"

PROMPT_TEMPLATE = """Based on this agent's complete profile, write a concise 2-3 sentence explanation of why they were selected for Top10Lists certification.

Focus on:
- Quantifiable performance metrics (rating, review count, transactions)
- Community involvement and credentials
- What makes them stand out in their market

Profile data:
{bio}

Write in third person, present tense. Start with "Selected for..."
Keep it factual and merit-based. Max 280 characters."""


def fetch_agents_needing_rationale(limit=None):
    """Fetch agents with bios but no selection_rationale."""
    url = f"{SUPABASE_URL}/functions/v1/enrichment-api"
    headers = {
        "X-Enrichment-Key": ENRICHMENT_KEY,
        "Content-Type": "application/json"
    }
    
    # Fetch agents with synthesized_bio
    # Filter for NULL selection_rationale in Python since API doesn't handle NULL filters well
    payload = {
        "table": "professionals",
        "select": "id,name,synthesized_bio,selection_rationale",
        "filters": [],  # No filters, we'll filter in Python
        "limit": limit or 1000,
        "offset": 0
    }
    
    response = requests.post(
        f"{url}?action=query",
        headers=headers,
        json=payload
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to fetch agents: {response.text}")
    
    result = response.json()
    agents = result.get('data', [])
    
    # Filter in Python: must have bio and no rationale
    filtered = [
        a for a in agents 
        if a.get('synthesized_bio') and not a.get('selection_rationale')
    ]
    
    return filtered


def generate_rationale(bio):
    """Generate selection rationale using DeepSeek."""
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "user",
                "content": PROMPT_TEMPLATE.format(bio=bio)
            }
        ],
        "max_tokens": 150,
        "temperature": 0.7
    }
    
    response = requests.post(
        DEEPSEEK_ENDPOINT,
        headers=headers,
        json=payload
    )
    
    if response.status_code != 200:
        raise Exception(f"DeepSeek API error: {response.text}")
    
    result = response.json()
    rationale = result["choices"][0]["message"]["content"].strip()
    
    # Ensure it's under 280 chars
    if len(rationale) > 280:
        rationale = rationale[:277] + "..."
    
    return rationale


def update_agent_rationale(agent_id, rationale):
    """Update agent's selection_rationale in database."""
    url = f"{SUPABASE_URL}/functions/v1/enrichment-api"
    headers = {
        "X-Enrichment-Key": ENRICHMENT_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "professional_id": agent_id,
        "selection_rationale": rationale
    }
    
    response = requests.post(
        f"{url}?action=update",
        headers=headers,
        json=payload
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to update agent: {response.text}")
    
    return response.json()


def main(limit=None, test_mode=False):
    """Main enrichment loop."""
    print(f"[{datetime.now()}] Starting selection_rationale enrichment")
    print(f"Test mode: {test_mode}, Limit: {limit or 'None'}")
    
    # Fetch agents
    print("\nFetching agents needing rationale...")
    agents = fetch_agents_needing_rationale(limit=limit)
    print(f"Found {len(agents)} agents")
    
    if test_mode and len(agents) > 0:
        print("\n--- TEST MODE: Processing first agent only ---")
        agents = agents[:1]
    
    # Process each agent
    success_count = 0
    error_count = 0
    
    for i, agent in enumerate(agents, 1):
        try:
            print(f"\n[{i}/{len(agents)}] Processing: {agent['name']}")
            
            # Generate rationale
            rationale = generate_rationale(agent['synthesized_bio'])
            print(f"  Generated ({len(rationale)} chars): {rationale}")
            
            if not test_mode:
                # Update database
                update_agent_rationale(agent['id'], rationale)
                print(f"  ✓ Updated in database")
                success_count += 1
            else:
                print(f"  [TEST MODE - NOT SAVED]")
            
            # Rate limiting
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            error_count += 1
            continue
    
    # Summary
    print(f"\n--- Summary ---")
    print(f"Processed: {len(agents)}")
    print(f"Success: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Test mode: {test_mode}")
    print(f"Completed: {datetime.now()}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate selection rationale for agents")
    parser.add_argument("--limit", type=int, help="Limit number of agents to process")
    parser.add_argument("--test", action="store_true", help="Test mode (process 1 agent, don't save)")
    parser.add_argument("--all", action="store_true", help="Process all agents needing rationale")
    
    args = parser.parse_args()
    
    if args.all:
        main(limit=None, test_mode=False)
    elif args.test:
        main(limit=1, test_mode=True)
    elif args.limit:
        main(limit=args.limit, test_mode=False)
    else:
        print("Usage: python3 generate_selection_rationale.py --limit 10 --test")
        print("   or: python3 generate_selection_rationale.py --all")
