#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ $EUID == 0 ]] || { echo "Run with sudo."; exit 1; }
config=/etc/drogo-ama-answer.env
if [[ ! -f $config ]]; then
    tags=$(curl -fsS --max-time 10 http://127.0.0.1:11434/api/tags | python3 -c 'import json,sys; print("\n".join(x["name"] for x in json.load(sys.stdin)["models"]))')
    echo "Installed Ollama models:"
    echo "$tags"
    read -rp 'Exact local chat model tag: ' model
    grep -Fxq -- "$model" <<<"$tags" && [[ "$model" =~ ^[a-zA-Z0-9._:/-]+$ ]] || { echo 'Unknown model tag'; exit 1; }
    read -rp 'Cloudflare Access service token client ID: ' client
    read -rsp 'Cloudflare Access service token secret: ' secret
    echo
    [[ "$client" =~ ^[a-zA-Z0-9._-]+$ && "$secret" =~ ^[a-zA-Z0-9._-]+$ ]] || { echo 'Invalid token characters'; exit 1; }
    umask 077
    tmp=$(mktemp /etc/.drogo-ama-answer.XXXXXX)
    trap 'rm -f "$tmp"' EXIT
    printf 'OLLAMA_MODEL=%s\nCF_CLIENT_ID=%s\nCF_CLIENT_SECRET=%s\nAMA_SINCE=%s\n' "$model" "$client" "$secret" "$(date -u +%FT%T.000Z)" >"$tmp"
    mv "$tmp" "$config"
fi
install -Dm755 ama_answer.py /opt/drogo-ama-answer/ama_answer.py
install -m644 drogo-ama-answer.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl start drogo-ama-answer.service
systemctl enable --now drogo-ama-answer.timer
systemctl list-timers --all drogo-ama-answer.timer
