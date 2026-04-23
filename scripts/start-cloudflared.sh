#!/bin/bash
set -e

# Kill existing cloudflared session if running
tmux kill-session -t cloudflared 2>/dev/null || true

# Start cloudflared in a detached tmux session
tmux new-session -d -s cloudflared "$(dirname "$0")/../bin/cloudflared tunnel --url http://192.168.200.60:3000 > /home/emie/cloudflared.log 2>&1"

# Wait for tunnel to be created
sleep 8

# Fetch public URL
URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' /home/emie/cloudflared.log | head -1)

if [ -z "$URL" ]; then
  echo "Failed to get cloudflared URL"
  exit 1
fi

echo "NGROK_URL=$URL"
