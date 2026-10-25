# AMA new-question notifications via Ripper

## Why
Cloudflare Workers/Pages egress to the shared ntfy.sh service may be blocked or time
out. Ripper's home IP has already successfully delivered a push.

## Architecture and privacy
- Cloudflare D1 stores submitted questions unchanged.
- Ripper makes outbound-only GET requests every minute to
  `/api/ama/alerts` with a dedicated bearer token.
- The endpoint discloses ONLY random question IDs + creation timestamps for
  submissions from the last 14 days; it never returns names, text, answers,
  or other visitor details.
- Ripper sends a single generic ntfy push for new submissions. No inbound ports,
  public model endpoints or modifications to the existing Cloudflare Access admin
  whitelist.
- A 64-character random hex token is mandatory. Never commit it or paste it in chat.

## Setup
1. On Ripper generate a random key:
   `openssl rand -hex 32`
   Keep the result secret.
2. In Cloudflare Pages `drogo-site`, add encrypted **Production** secret
   `AMA_ALERT_READ_TOKEN` using that key. Redeploy Production if Pages
   requires it for the secret to take effect.
3. In a working copy of this repository on Ripper:
   ```bash
   sudo install -d -m 755 /opt/drogo-ama-alerts
   sudo install -m 755 automation/ama_alert_poller.py /opt/drogo-ama-alerts/
   sudo install -m 600 automation/drogo-ama-alerts.env.example /etc/drogo-ama-alerts.env
   sudoedit /etc/drogo-ama-alerts.env
   sudo install -m 644 automation/drogo-ama-alerts.service /etc/systemd/system/
   sudo install -m 644 automation/drogo-ama-alerts.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   ```
   Enter the same token and subscribed ntfy.sh topic URL in the Ripper env file.
4. Optional direct ntfy test from Ripper, with no Cloudflare access:
   ```bash
   sudo sh -c 'set -a; . /etc/drogo-ama-alerts.env; set +a; /usr/bin/python3 /opt/drogo-ama-alerts/ama_alert_poller.py --test'
   ```
5. Start the service ONCE. Its first run creates an initial baseline without
   alerting for historical questions:
   ```bash
   sudo systemctl start drogo-ama-alerts.service
   sudo journalctl -u drogo-ama-alerts.service -n 15 --no-pager
   ```
   Expect `Initial baseline: N existing submissions; no alerts sent`.
6. Enable the scheduled poll:
   ```bash
   sudo systemctl enable --now drogo-ama-alerts.timer
   systemctl list-timers --all drogo-ama-alerts.timer
   ```
7. When a NEW public AMA submission succeeds, expect a push within approximately
   one to two minutes and a journal entry saying ntfy accepted it.

## Reliability
- If ntfy fails, the poller does not mark submissions as delivered. The next
  scheduled run retries, usually combining multiple submissions into one alert.
- On first run, existing submissions are intentionally baselined.
- The last 14 days are available for catching up after temporary outages.
- Hard cap of 500 events in the 14-day window avoids silently truncating data.
- Poller state lives in the systemd-managed StateDirectory, not Ripper's home.
- Keep the Cloudflare token and ntfy URL private. If the bearer token is lost or
  exposed, rotate it on both sides.
- Cloudflare Access still protects moderation and admin HTML; this isolated
  read-only endpoint has its own token and returns **no private submissions**.
