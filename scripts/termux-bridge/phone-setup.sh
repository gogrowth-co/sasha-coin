#!/data/data/com.termux/files/usr/bin/bash
# Sasha Phone Bridge — one-time setup
# Run this inside Termux on the Android phone

set -e

echo "=== Sasha Phone Bridge Setup ==="
echo ""

# 1. Update and install deps
pkg update -y
pkg install -y python adb android-tools

# 2. Create home dir
mkdir -p ~/termux-bridge
cp termux-listener.py ~/termux-bridge/termux-listener.py
chmod +x ~/termux-bridge/termux-listener.py

# 3. Create .env file (fill in values)
cat > ~/termux-bridge/.env <<'ENVEOF'
# Bridge bot token from @BotFather (NOT Sasha's main bot)
TERMUX_BRIDGE_TOKEN=

# Gabriel's Telegram user ID (get from @userinfobot)
COMMANDER_CHAT_ID=

# Shared secret — paste same value into VPS .env as BRIDGE_SECRET
BRIDGE_SECRET=
ENVEOF

echo ""
echo "=== Fill in ~/termux-bridge/.env with your values, then run: ==="
echo "  source ~/termux-bridge/.env && python3 ~/termux-bridge/termux-listener.py"
echo ""
echo "=== ADB Setup (wireless) ==="
echo "  On phone: Settings → Developer Options → Wireless Debugging → ON"
echo "  Then in Termux: adb pair localhost:<pairing-port> <pin>"
echo "  Then: adb connect localhost:5555"
echo "  Verify: adb devices"
echo ""
echo "=== Auto-start on Termux launch ==="
echo "  Add to ~/.bashrc:"
echo '  source ~/termux-bridge/.env && nohup python3 ~/termux-bridge/termux-listener.py >> ~/termux-bridge/listener.log 2>&1 &'
