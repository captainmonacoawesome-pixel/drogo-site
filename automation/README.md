# The Weekly Mush: Ripper edition

Unattended local-first newsletter publisher. Pure Python stdlib; no external dependencies.
Reads only already-public content from the production Gallery and AMA APIs.
Never touches Cloudflare D1/R2 credentials, pending questions or subscriber emails.

## Safety
- Sends nothing unless both --send and MUSH_SEND_ENABLED=1 are set.
- Dry run creates a preview.html file in ~/.local/state/weekly-mush.
- No new published photos or AMA answers in past week means no email.
- Maximum three new photos and two published AMA answers per issue.
- Local llama.cpp OpenAI-compatible chat endpoint on localhost only. Fallback copy on model failure.
- Escapes HTML and neutralises Brevo template interpolation in all generated/user text.
- Brevo handles confirmed mailing-list membership and unsubscribe links.
- Refuses mailing lists larger than 300 contacts (Brevo Free limit).
- Stores an ISO-week state before network sends; failed attempts cannot silently resend.
- Optional ntfy HTTPS alert on success/failure.

## Installation on Ubuntu Ripper
Check out the feature/weekly-mush-automation branch or copy this automation directory.
sudo install -d -m 755 /opt/weekly-mush
sudo install -m 755 automation/weekly_mush.py /opt/weekly-mush/weekly_mush.py
sudo install -m 600 automation/weekly-mush.env.example /etc/weekly-mush.env
sudoedit /etc/weekly-mush.env

Generate a fresh Brevo API key and save it only in /etc/weekly-mush.env.
Confirm the local model URL/port and model name before testing.
Do not paste API keys into GitHub or chat.

### Dry-run
MUSH_LLM_URL=http://127.0.0.1:8081/v1/chat/completions MUSH_LLM_MODEL=glm-4.7-flash python3 automation/weekly_mush.py
Open ~/.local/state/weekly-mush/preview.html in your browser.

### Systemd weekly timer
sudo install -m 644 automation/weekly-mush.service /etc/systemd/system/
sudo install -m 644 automation/weekly-mush.timer /etc/systemd/system/
sudo systemctl daemon-reload
systemd-analyze calendar 'Sun *-*-* 19:00:00 Australia/Melbourne'

Keep MUSH_SEND_ENABLED=0 while testing. Once the preview and Brevo API permissions are verified, set it to 1.
sudo systemctl enable --now weekly-mush.timer
journalctl -u weekly-mush.service --since '14 days ago'

Timer runs Sundays at 7pm Melbourne time. No incoming port forwarding is required.
If a send fails after a campaign was created, inspect the campaign in Brevo and the local state before resetting anything.
