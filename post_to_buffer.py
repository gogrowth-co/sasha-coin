"""POC: Python equivalent of post_to_buffer.js. Not in production cron.
Env: BUFFER_ACCESS_TOKEN, BUFFER_ORGANIZATION_ID, BUFFER_CHANNEL_ID
Usage: python post_to_buffer.py --text "tweet text"
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

import requests

ACCESS_TOKEN = os.environ.get("BUFFER_ACCESS_TOKEN")
ORGANIZATION_ID = os.environ.get("BUFFER_ORGANIZATION_ID")
CHANNEL_ID = os.environ.get("BUFFER_CHANNEL_ID")

if not ACCESS_TOKEN or not CHANNEL_ID:
    print("ERROR: Missing BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID", file=sys.stderr)
    sys.exit(1)

parser = argparse.ArgumentParser()
parser.add_argument("--text", required=True)
parser.add_argument("--minutes", type=int, default=5)
args = parser.parse_args()

API_ENDPOINT = "https://api.buffer.com"
scheduled_time = (datetime.utcnow() + timedelta(minutes=args.minutes)).isoformat(timespec="seconds") + "Z"

QUERY = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    id
    status
    text
    scheduledAt
  }
}
"""

variables = {
    "input": {
        "channelId": CHANNEL_ID,
        "content": {"text": args.text},
        "scheduledAt": scheduled_time,
    }
}
if ORGANIZATION_ID:
    variables["input"]["organizationId"] = ORGANIZATION_ID

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {ACCESS_TOKEN}",
}

response = requests.post(API_ENDPOINT, headers=headers, json={"query": QUERY, "variables": variables})
response.raise_for_status()
print(json.dumps(response.json(), indent=2))