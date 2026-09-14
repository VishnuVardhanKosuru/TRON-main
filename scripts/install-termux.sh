#!/data/data/com.termux/files/usr/bin/bash
#
# TRON — one-time setup on the Redmi (Termux).
#
# Installs the `tron` command, and wires TRON to start automatically when the
# phone boots so you never have to open Termux by hand.
#
# Run from the project root:   bash scripts/install-termux.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX_BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin"
BOOT_DIR="$HOME/.termux/boot"

echo "TRON setup"
echo "  project: $PROJECT_DIR"
echo

# ── 1. Node ───────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "→ Installing Node…"
  pkg install -y nodejs-lts
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "  Node $NODE_MAJOR found. TRON needs Node 22+ for built-in SQLite."
  echo "  Run: pkg install nodejs-lts"
  exit 1
fi
echo "→ Node $(node -v) ok"

# ── 2. Keep the phone from sleeping the server ────────────────────────────────
if ! command -v termux-wake-lock >/dev/null 2>&1; then
  echo "→ Installing termux-api (for wake lock)…"
  pkg install -y termux-api || echo "  (optional) termux-api not installed"
fi

# ── 3. Config ─────────────────────────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env.local"
  echo
  echo "→ Created .env.local"
  echo "  EDIT IT NOW and set TRON_PASSPHRASE before starting:"
  echo "     nano $PROJECT_DIR/.env.local"
  echo
fi

# ── 4. Build ──────────────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
if [ ! -f ".next/BUILD_ID" ]; then
  echo "→ Installing dependencies (this takes a few minutes on a phone)…"
  npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund
  echo "→ Building…"
  npm run build
fi

# ── 5. The `tron` command ─────────────────────────────────────────────────────
echo "→ Installing the tron command…"
cat > "$PREFIX_BIN/tron" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
exec node "$PROJECT_DIR/scripts/tron.mjs" "\$@"
EOF
chmod +x "$PREFIX_BIN/tron"

# ── 6. Start on boot ──────────────────────────────────────────────────────────
echo "→ Installing boot script…"
mkdir -p "$BOOT_DIR"
cat > "$BOOT_DIR/start-tron.sh" <<EOF
#!/data/data/com.termux/files/usr/bin/bash
# Started automatically by Termux:Boot when the Redmi powers on.
termux-wake-lock 2>/dev/null || true
cd "$PROJECT_DIR"
exec node "$PROJECT_DIR/scripts/tron.mjs" start >> "$PROJECT_DIR/logs/boot.log" 2>&1
EOF
chmod +x "$BOOT_DIR/start-tron.sh"

echo
echo "Done."
echo
echo "  tron start     start TRON now"
echo "  tron status    check it"
echo "  tron stop      stop it"
echo
echo "For it to start on boot you also need:"
echo "  1. Install the Termux:Boot app (F-Droid)"
echo "  2. Open Termux:Boot once so Android grants it permission"
echo "  3. Disable battery optimisation for Termux and Termux:Boot"
echo
