cat <<'EOF' > /usr/local/bin/cleanup-comfyui.sh
#!/usr/bin/env bash
set -e

INPUT_DIR="/workspace/ComfyUI/input"
OUTPUT_DIR="/workspace/ComfyUI/output"
LOG_FILE="/var/log/comfyui-cleanup.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "===== Cleanup run $(date) =====" >> "$LOG_FILE"

if [ -d "$INPUT_DIR" ]; then
find "$INPUT_DIR" -type f -mtime +2 -print -delete >> "$LOG_FILE" 2>&1
find "$INPUT_DIR" -type d -empty -delete >> "$LOG_FILE" 2>&1
else
echo "Input dir missing: $INPUT_DIR" >> "$LOG_FILE"
fi

if [ -d "$OUTPUT_DIR" ]; then
find "$OUTPUT_DIR" -type f -mtime +2 -print -delete >> "$LOG_FILE" 2>&1
find "$OUTPUT_DIR" -type d -empty -delete >> "$LOG_FILE" 2>&1
else
echo "Output dir missing: $OUTPUT_DIR" >> "$LOG_FILE"
fi

echo "Cleanup done" >> "$LOG_FILE"
EOF

run this Then
chmod +x /usr/local/bin/cleanup-comfyui.sh

then to set cronjob

apt update
apt install -y cron
crontab -e
0 _/6 _ \* \* /usr/local/bin/cleanup-comfyui.sh
crontab -l to check and then
cron
