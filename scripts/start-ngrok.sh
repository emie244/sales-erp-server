#!/bin/bash
set -e

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "ngrok not found. Installing..."
  curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
    sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
    sudo tee /etc/apt/sources.list.d/ngrok.list && \
    sudo apt-get update && sudo apt-get install -y ngrok
fi

# Kill existing ngrok if running
pkill -f "ngrok http" || true

# Start ngrok in background
nohup ngrok http 192.168.200.60:3000 --region ap > /dev/null 2>&1 &

# Wait for ngrok to start
sleep 5

# Fetch public URL
URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*' | head -1)

if [ -z "$URL" ]; then
  echo "Failed to get ngrok URL"
  exit 1
fi

echo "NGROK_URL=$URL"
