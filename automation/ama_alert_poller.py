#!/usr/bin/env python3
"""Outbound-only Ripper AMA alerts poller. Python standard library only."""
import argparse
import json
import logging
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

LOG = logging.getLogger("drogo-ama-alerts")
API = "https://drogo.carmensandiego666.xyz/api/ama/alerts"
MODERATE = "https://drogo.carmensandiego666.xyz/admin/ama/"


def request_json(url, token):
    req = Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "User-Agent": "Drogo-Ripper-AMA-Alert-Poller/1"
    })
    with urlopen(req, timeout=20) as res:
        if res.status != 200:
            raise RuntimeError("Unexpected alert feed HTTP " + str(res.status))
        payload = json.load(res)
    entries = payload.get("events")
    if not isinstance(entries, list) or len(entries) > 500:
        raise RuntimeError("Alert feed returned invalid or excessive events")
    ids = set()
    for event in entries:
        if not isinstance(event, dict):
            raise RuntimeError("Unexpected alert record")
        event_id = event.get("id")
        if (not isinstance(event_id, str) or len(event_id) != 36
                or not all(c in "0123456789abcdef-" for c in event_id)):
            raise RuntimeError("Unexpected alert record ID")
        ids.add(event_id)
    return ids


def publish(topic_url, message):
    url = urlsplit(topic_url)
    if (url.scheme != "https" or url.hostname != "ntfy.sh" or
            url.username or url.password or url.query or url.fragment or
            len(url.path) < 17 or len(url.path) > 65 or
            not all(c.isalnum() and c.isascii() or c in "-_" for c in url.path[1:])):
        raise RuntimeError("Invalid ntfy topic URL")
    req = Request(topic_url, method="POST", data=message.encode("utf-8"), headers={
        "Content-Type": "text/plain; charset=utf-8",
        "Title": "Drogo Protocol - AMA",
        "Click": MODERATE,
        "Priority": "3",
        "Tags": "envelope"
    })
    with urlopen(req, timeout=20) as res:
        if res.status not in (200, 201, 202):
            raise RuntimeError("Unexpected ntfy HTTP " + str(res.status))


def save_state(path, ids):
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8") as f:
        json.dump({"seen_ids": sorted(ids)}, f)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true",
                        help="Test direct Ripper-to-ntfy delivery without calling Cloudflare")
    args = parser.parse_args()

    topic = os.environ.get("AMA_NTFY_URL", "").strip()
    if not topic:
        raise RuntimeError("Missing AMA_NTFY_URL")
    if args.test:
        publish(topic, "TEST: The Drogo AMA alert relay on Ripper is operational.")
        LOG.info("Local ntfy test accepted")
        return

    token = os.environ.get("AMA_ALERT_READ_TOKEN", "").strip()
    if len(token) != 64 or any(c not in "0123456789abcdef" for c in token):
        raise RuntimeError("AMA_ALERT_READ_TOKEN must be a 64-character lowercase hex token")

    directory = Path(os.environ.get(
        "AMA_ALERT_STATE_DIR", str(Path.home()/".local/state/drogo-ama-alerts")))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    state = directory/"state.json"

    try:
        fresh_ids = request_json(API, token)
    except HTTPError as e:
        LOG.error("Cloudflare alert feed returned HTTP %s", e.code)
        raise SystemExit(1)
    except URLError as e:
        LOG.error("Cloudflare alert feed unreachable: %s", type(e.reason).__name__)
        raise SystemExit(1)

    if not state.exists():
        # First run must NOT retroactively notify every historical submission.
        save_state(state, fresh_ids)
        LOG.info("Initial baseline: %d existing submissions; no alerts sent", len(fresh_ids))
        return

    prior = json.loads(state.read_text(encoding="utf-8"))
    seen = set(prior.get("seen_ids") or [])
    added = fresh_ids - seen
    if not added:
        # Prune IDs that have fallen outside the rolling 14-day server window.
        if seen != fresh_ids:
            save_state(state, fresh_ids)
        LOG.info("No new AMA submissions")
        return

    n = len(added)
    text = (
        "A new question awaits His Lordship's approval."
        if n == 1 else f"{n} new AMA questions have been received for royal review."
    )
    # Mark as delivered ONLY after ntfy confirms it accepted the push.
    # On failure the next run retries the same count, without losing submissions.
    try:
        publish(topic, text)
    except HTTPError as e:
        LOG.error("ntfy delivery returned HTTP %s; will retry next run", e.code)
        raise SystemExit(1)
    except URLError as e:
        LOG.error("ntfy delivery failed (%s); will retry next run", type(e.reason).__name__)
        raise SystemExit(1)
    save_state(state, fresh_ids)
    LOG.info("ntfy accepted notification for %d new AMA submission(s)", n)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    try:
        main()
    except (ValueError, RuntimeError, OSError, json.JSONDecodeError) as err:
        LOG.error("Stopped: %s", err)
        raise SystemExit(1)
