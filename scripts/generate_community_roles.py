#!/usr/bin/env python3
"""
Generate community_roles for agents (AZ, CA). Appends to existing roles; does not overwrite.
Uses DeepSeek for cost-effective generation.
Writes directly via Supabase REST API (service role key).
Secrets: DEEPSEEK_API_KEY, SUPABASE_SERVICE_ROLE_KEY (env or .env).
Usage: python generate_community_roles.py BATCH_SIZE OFFSET [STATE_SLUG]
  STATE_SLUG: arizona | california (default california).
"""

import requests
import json
import time
import sys
import re
import os
from pathlib import Path

# Load .env from project root if keys not in env
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

DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
SVC_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
BASE = "https://wiotrvoirdgzfacuuiem.supabase.co/rest/v1"
HEADERS_READ = {"apikey": SVC_KEY, "Authorization": f"Bearer {SVC_KEY}"}
HEADERS_WRITE = {"apikey": SVC_KEY, "Authorization": f"Bearer {SVC_KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

BATCH_SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 10
OFFSET = int(sys.argv[2]) if len(sys.argv) > 2 else 0
STATE_SLUG = (sys.argv[3] or "california").strip().lower()
if STATE_SLUG not in ("arizona", "california"):
    STATE_SLUG = "california"

STATE_LABEL = "Arizona" if STATE_SLUG == "arizona" else "California"

PROMPT_TEMPLATE = """You are analyzing a real estate professional's background to identify their likely community involvement.

Agent: {name}
Company: {company}
Location: {service_areas}
Years Experience: {years}
Sales: {sales}
Bio: {bio}

Existing roles (do NOT duplicate these; suggest ADDITIONAL roles only):
{existing_roles}

Based on this agent's profile, identify 2-4 ADDITIONAL realistic community involvement roles they may have. Focus on:
- Local real estate associations (board positions, committee roles)
- Charitable organizations related to housing, homelessness, or local causes
- Community organizations (school boards, civic groups, chambers of commerce)
- Industry mentorship or education roles

IMPORTANT RULES:
- Only suggest roles that are plausible and that are NOT already in the existing roles list
- Do NOT invent specific organization names unless the bio mentions them
- Use generic but realistic role descriptions when no specific org is mentioned
- Each role must have: role (title), organization (name), description (1 sentence)

Return ONLY a JSON array of NEW roles. No markdown, no explanation. If you cannot suggest any additional roles, return []."""


def fetch_agents(limit, offset, state_slug):
    r = requests.get(
        f"{BASE}/professionals?select=id,name,synthesized_bio,company,service_areas,sales_count_all_time,years_experience,community_roles"
        f"&active=eq.true&state_slug=eq.{state_slug}&limit={limit}&offset={offset}"
        f"&order=name.asc",
        headers=HEADERS_READ,
    )
    return r.json()


def role_key(r):
    return (str(r.get("role", "")).strip().lower(), str(r.get("organization", "")).strip().lower())


def merge_roles(existing, new_roles):
    seen = {role_key(r) for r in (existing or []) if isinstance(r, dict)}
    out = list(existing) if existing else []
    for r in (new_roles or []):
        if not isinstance(r, dict):
            continue
        k = role_key(r)
        if k not in seen:
            seen.add(k)
            out.append(r)
    return out


def generate_roles(agent):
    bio = (agent.get("synthesized_bio") or "")[:1500]
    bio = re.sub(r"<[^>]+>", "", bio)
    areas = agent.get("service_areas", []) or []
    areas_str = ", ".join(areas[:5]) if areas else STATE_LABEL
    existing = agent.get("community_roles") or []
    existing_roles_str = "None" if not existing else json.dumps(existing, indent=2)

    prompt = PROMPT_TEMPLATE.format(
        name=agent["name"],
        company=agent.get("company", "Unknown"),
        service_areas=areas_str,
        years=agent.get("years_experience", "Unknown"),
        sales=agent.get("sales_count_all_time", "Unknown"),
        bio=bio or "No bio available",
        existing_roles=existing_roles_str,
    )

    r = requests.post(
        DEEPSEEK_URL,
        headers={
            "Authorization": f"Bearer {DEEPSEEK_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.6,
            "max_tokens": 500,
        },
    )

    if r.status_code != 200:
        print(f"  DeepSeek error {r.status_code}: {r.text[:200]}")
        return None

    content = r.json()["choices"][0]["message"]["content"].strip()
    content = re.sub(r"^```json\s*", "", content)
    content = re.sub(r"\s*```$", "", content)

    try:
        roles = json.loads(content)
        if isinstance(roles, list):
            return [r for r in roles if isinstance(r, dict)]
    except json.JSONDecodeError:
        print(f"  JSON parse error: {content[:200]}")
    return None


def update_agent(agent_id, merged_roles):
    r = requests.patch(
        f"{BASE}/professionals?id=eq.{agent_id}",
        headers=HEADERS_WRITE,
        json={"community_roles": merged_roles},
    )
    return r.status_code in [200, 204]


def main():
    if not DEEPSEEK_KEY:
        print("Error: DEEPSEEK_API_KEY not set (env or .env)")
        sys.exit(1)
    if not SVC_KEY:
        print("Error: SUPABASE_SERVICE_ROLE_KEY not set (env or .env)")
        sys.exit(1)

    print(f"Fetching {BATCH_SIZE} {STATE_LABEL} agents (offset {OFFSET})...")
    agents = fetch_agents(BATCH_SIZE, OFFSET, STATE_SLUG)
    print(f"Got {len(agents)} agents.\n")

    if not agents:
        print("No agents to process.")
        sys.exit(0)

    success = 0
    errors = 0
    for i, agent in enumerate(agents):
        name = agent["name"]
        agent_id = agent["id"]
        existing = agent.get("community_roles") or []

        new_roles = generate_roles(agent)
        if new_roles is None:
            print(f"  [{i+1}] {name}: FAILED to generate")
            errors += 1
            continue

        merged = merge_roles(existing, new_roles)
        if len(merged) <= len(existing):
            print(f"  [{i+1}] {name}: no new roles (kept {len(existing)})")
            success += 1
            time.sleep(0.3)
            continue

        if update_agent(agent_id, merged):
            success += 1
            added = len(merged) - len(existing)
            print(f"  [{i+1}] {name}: +{added} roles (total {len(merged)})")
            for role in new_roles:
                print(f"       - {role.get('role', '?')} at {role.get('organization', '?')}")
        else:
            errors += 1
            print(f"  [{i+1}] {name}: UPDATE FAILED")

        time.sleep(0.5)

    print(f"\nDone. Success: {success}, Errors: {errors}")


if __name__ == "__main__":
    main()
