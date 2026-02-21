#!/usr/bin/env python3
"""Create the knowledge Gist via GitHub API using ai full access token. Updates PROJECT-KNOWLEDGE.md with the new Gist ID."""
import json
import os
import re
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
SECRETS_FILE = os.path.join(REPO_ROOT, '.secrets', 'github-knowledge-token.txt')
DOC_PATH = os.path.join(REPO_ROOT, 'docs', 'PROJECT-KNOWLEDGE.md')

def get_token():
    with open(SECRETS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                return line
    raise SystemExit('No token in .secrets/github-knowledge-token.txt')

def read_doc():
    with open(DOC_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def redact_for_gist(content):
    """Redact any raw API keys before putting in public/secret Gist."""
    # Redact DeepSeek key if present
    content = re.sub(r'sk-[a-zA-Z0-9]{20,}', '[STORED IN ENVIRONMENT - Ask Robert]', content)
    return content

def get_existing_gist_id():
    """If doc already has a Gist ID, return it so we can PATCH instead of creating new."""
    with open(DOC_PATH, 'r', encoding='utf-8') as f:
        doc = f.read()
    m = re.search(r'\*\*Gist ID:\*\* `([a-f0-9]{32})`\.', doc)
    return m.group(1) if m else None

def create_gist(token, content):
    url = 'https://api.github.com/gists'
    payload = {
        'description': 'Top10Lists.us Project Knowledge - Secrets Removed (Ask Claude for tokens)',
        'public': False,
        'files': {
            'PROJECT-KNOWLEDGE.md': {
                'content': content
            }
        }
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Authorization', f'token {token}')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.loads(r.read().decode())
    return res['id'], res.get('html_url', '')

def update_gist(token, gist_id, content):
    url = f'https://api.github.com/gists/{gist_id}'
    payload = {
        'description': 'Top10Lists.us Project Knowledge - Secrets Removed (Ask Claude for tokens)',
        'files': {
            'PROJECT-KNOWLEDGE.md': {
                'content': content
            }
        }
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, method='PATCH')
    req.add_header('Authorization', f'token {token}')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.loads(r.read().decode())
    return res.get('html_url', '')

def update_doc_with_gist_id(gist_id):
    with open(DOC_PATH, 'r', encoding='utf-8') as f:
        doc = f.read()
    # Update the Gist ID in the Knowledge Gist bullet (regex: existing id might be placeholder or real)
    doc = re.sub(
        r'\*\*Gist ID:\*\* `[a-f0-9]+`\. URL: https://gist\.github\.com/rjmjr1962831/[a-f0-9]+\.',
        f'**Gist ID:** `{gist_id}`. URL: https://gist.github.com/rjmjr1962831/{gist_id}.',
        doc,
        count=1
    )
    if f'`{gist_id}`' not in doc:
        doc = re.sub(
            r'\*\*Gist ID:\*\* \(run the script to create the Gist and fill this in\)\.',
            f'**Gist ID:** `{gist_id}`. URL: https://gist.github.com/rjmjr1962831/{gist_id}.',
            doc,
            count=1
        )
    with open(DOC_PATH, 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'Updated PROJECT-KNOWLEDGE.md with Gist ID {gist_id}')

def main():
    token = get_token()
    content = read_doc()
    content = redact_for_gist(content)
    existing = get_existing_gist_id()
    if existing:
        update_gist(token, existing, content)
        gist_id = existing
        print(f'Updated existing Gist: {gist_id}')
    else:
        gist_id, url = create_gist(token, content)
        print(f'Created Gist: {gist_id}')
        print(f'URL: {url}')
    update_doc_with_gist_id(gist_id)

if __name__ == '__main__':
    main()
