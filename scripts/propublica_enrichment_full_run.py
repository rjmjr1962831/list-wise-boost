#!/usr/bin/env python3
"""
ProPublica 990 Enrichment - FULL RUN (AZ + CA)
Strict filtering: state location + state in org name + national RE bodies
Logs to propublica_full_run.log (project root)
"""

import urllib.request
import json
import time
import re
import sys
import os
import datetime

# Log to project root (works on Windows and Linux)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOG_FILE = os.path.join(PROJECT_ROOT, 'propublica_full_run.log')
SUMMARY_FILE = os.path.join(PROJECT_ROOT, 'propublica_summary.txt')

ENRICHMENT_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrichment-api'
ENRICHMENT_KEY = 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a'
PROPUBLICA_SEARCH = 'https://projects.propublica.org/nonprofits/name_search'
RATE_LIMIT_DELAY = 1.0

STATE_CONFIG = {
    'arizona': {
        'location_check': lambda loc: bool(re.search(r',\s*AZ\b', loc, re.IGNORECASE)) or 'arizona' in loc.lower(),
        'org_name_terms': ['arizona', 'maricopa county', 'pima county', 'pinal county',
                           'yavapai county', 'coconino county', 'mohave county'],
    },
    'california': {
        'location_check': lambda loc: bool(re.search(r',\s*CA\b', loc, re.IGNORECASE)) or 'california' in loc.lower(),
        'org_name_terms': ['california', 'los angeles county', 'san diego county',
                           'orange county', 'san francisco', 'sacramento county',
                           'riverside county', 'san bernardino county', 'alameda county',
                           'santa clara county', 'contra costa county', 'ventura county'],
    }
}

NATIONAL_RE_BODIES = [
    'national association of realtors',
    'national association of home builders',
    'national fair housing alliance',
    'habitat for humanity international',
    'urban land institute',
]

def log(msg):
    ts = datetime.datetime.now().strftime('%H:%M:%S')
    line = f'[{ts}] {msg}'
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')
        f.flush()

def classify_role(location, org_name, state_slug):
    loc = (location or '').strip()
    org_lower = (org_name or '').lower()
    cfg = STATE_CONFIG.get(state_slug, STATE_CONFIG['arizona'])
    if cfg['location_check'](loc):
        return True, 'State location'
    for term in cfg['org_name_terms']:
        if term in org_lower:
            return True, 'State in org name'
    for nb in NATIONAL_RE_BODIES:
        if nb in org_lower:
            return True, 'National RE body'
    return False, f'Rejected: {location}'

def api_request(url, method='GET', data=None, retries=3):
    headers = {'X-Enrichment-Key': ENRICHMENT_KEY, 'Content-Type': 'application/json'}
    body = json.dumps(data).encode() if data else None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except:
            if attempt < retries - 1:
                time.sleep(2)
    return None

def fetch_all_agents(state):
    all_agents = []
    offset = 0
    while True:
        data = {
            'table': 'professionals', 'select': 'id,name,community_roles,state_slug',
            'filters': [
                {'field': 'active', 'operator': 'eq', 'value': True},
                {'field': 'state_slug', 'operator': 'eq', 'value': state}
            ],
            'limit': 1000, 'offset': offset
        }
        result = api_request(f'{ENRICHMENT_URL}?action=query', method='POST', data=data)
        if not result or 'data' not in result:
            break
        rows = result['data']
        all_agents.extend(rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return all_agents

def update_agent(agent_id, community_roles):
    data = {'professional_id': agent_id, 'community_roles': community_roles}
    return api_request(f'{ENRICHMENT_URL}?action=update', method='POST', data=data) is not None

def normalize_name(name):
    name = name.lower().strip()
    for suffix in [' jr', ' sr', ' ii', ' iii', ' iv', ' esq', ' cpa', ' dds', ' md', ' phd']:
        name = name.replace(suffix, '')
    name = re.sub(r'\b[a-z]\b\.?', '', name)
    return re.sub(r'\s+', ' ', name).strip()

def names_match(agent_name, found_name):
    a_parts = set(normalize_name(agent_name).split())
    f_parts = set(normalize_name(found_name).split())
    return len(a_parts & f_parts) >= 2 if a_parts and f_parts else False

def search_propublica_people(name, retries=2):
    encoded = urllib.request.quote(name)
    url = f'{PROPUBLICA_SEARCH}?utf8=%E2%9C%93&q={encoded}'
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            with urllib.request.urlopen(req, timeout=15) as r:
                html = r.read().decode()
            results = []
            for block in html.split('result-row result-row-people">')[1:]:
                hed = re.search(r'result-item__hed">\s*([^<]+)', block)
                if not hed:
                    continue
                tb = re.search(r'<span class="margin-right">\s*(.*?)\s*at\s*<a', block, re.DOTALL)
                title = re.sub(r'<[^>]+>', '', tb.group(1)).strip() if tb else ''
                om = re.search(r'href="/nonprofits/organizations/(\d+)">\s*([^<]+)', block)
                if not om:
                    continue
                ym = re.search(r'•\s*<span[^>]*>(\d{4})</span>', block)
                lm = re.search(r'nowrap text-sub">\s*([^•<]+)', block)
                results.append({
                    'person_name': hed.group(1).strip(), 'title': title,
                    'organization': om.group(2).strip(), 'ein': om.group(1),
                    'year': ym.group(1) if ym else '', 'location': lm.group(1).strip() if lm else ''
                })
            return results
        except:
            if attempt < retries - 1:
                time.sleep(2)
    return []

def merge_roles(existing_roles, new_verified_roles):
    if not existing_roles:
        existing_roles = []
    elif isinstance(existing_roles, str):
        try:
            existing_roles = json.loads(existing_roles)
        except:
            existing_roles = []
    existing_orgs = set(r.get('organization', '').lower().strip() for r in existing_roles if r.get('organization'))
    added = 0
    for nr in new_verified_roles:
        org = nr.get('organization', '').lower().strip()
        if org not in existing_orgs:
            existing_roles.append(nr)
            existing_orgs.add(org)
            added += 1
    return existing_roles, added

def process_state(state_slug):
    log(f'=== {state_slug.upper()} START ===')
    agents = fetch_all_agents(state_slug)
    log(f'{state_slug}: {len(agents)} active agents fetched')

    hits = 0; updated = 0; total_new = 0; skipped = 0; errors = 0

    for i, agent in enumerate(agents):
        name = agent.get('name', '')
        words = name.split()
        if len(words) < 2 or any(biz in name.lower() for biz in ['realty', 'group', 'team', 'homes', 'properties', 'llc', 'inc']):
            skipped += 1
            continue

        results = search_propublica_people(name)
        time.sleep(RATE_LIMIT_DELAY)
        if not results:
            continue

        matched = [r for r in results if names_match(name, r['person_name'])]
        if not matched:
            continue

        accepted = [r for r in matched if classify_role(r['location'], r['organization'], state_slug)[0]]
        if not accepted:
            continue

        hits += 1
        seen_eins = set()
        verified = []
        for r in accepted:
            if r['ein'] in seen_eins:
                continue
            seen_eins.add(r['ein'])
            verified.append({
                'role': r['title'] or 'Officer/Director',
                'organization': r['organization'],
                'verification_source': 'ProPublica IRS Form 990',
                'ein': r['ein'], 'tax_year': r['year'],
                'location': r['location'],
                'filing_url': f'https://projects.propublica.org/nonprofits/organizations/{r["ein"]}'
            })

        merged, added = merge_roles(agent.get('community_roles', []), verified)
        total_new += added
        if added > 0:
            if update_agent(agent['id'], merged):
                updated += 1
                log(f'  {name}: +{added} roles')
            else:
                errors += 1

        if (i + 1) % 100 == 0:
            log(f'  PROGRESS {state_slug}: {i+1}/{len(agents)} | hits={hits} updated={updated} new_roles={total_new}')

    log(f'=== {state_slug.upper()} COMPLETE: {len(agents)} agents, {hits} hits, {updated} updated, {total_new} new roles, {errors} errors ===')
    return {'state': state_slug, 'total': len(agents), 'hits': hits, 'updated': updated, 'new_roles': total_new, 'errors': errors}

# ============================================================
# MAIN
# ============================================================
with open(LOG_FILE, 'w') as f:
    f.write(f'ProPublica Full Enrichment Started: {datetime.datetime.now()}\n\n')

log('ProPublica 990 Full Enrichment - AZ + CA')
log(f'Estimated: ~3,500 agents, ~60 min at 1 req/sec')

results = []
for state in ['arizona', 'california']:
    results.append(process_state(state))

log('')
log('=' * 60)
log('GRAND TOTAL')
for r in results:
    log(f'  {r["state"]}: {r["total"]} agents, {r["updated"]} updated, {r["new_roles"]} new roles')
log(f'  COMBINED: {sum(r["updated"] for r in results)} updated, {sum(r["new_roles"] for r in results)} new roles')
log(f'Completed: {datetime.datetime.now()}')

# Write summary file
with open(SUMMARY_FILE, 'w') as f:
    f.write('ProPublica 990 Enrichment Summary\n')
    f.write(f'Completed: {datetime.datetime.now()}\n\n')
    for r in results:
        f.write(f'{r["state"]}: {r["total"]} agents, {r["hits"]} hits, {r["updated"]} updated, {r["new_roles"]} new roles, {r["errors"]} errors\n')
    f.write(f'\nCOMBINED: {sum(r["updated"] for r in results)} updated, {sum(r["new_roles"] for r in results)} new roles\n')
