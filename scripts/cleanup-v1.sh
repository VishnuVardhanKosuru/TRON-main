#!/usr/bin/env bash
#
# One-time cleanup after the TRON V1 migration.
#
# Removes the dead Firebase/Gemini files and tidies the loose design mockups
# into docs/ so the repository root is just the application.
#
# Run once from the project root:   bash scripts/cleanup-v1.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "Cleaning up the TRON V1 migration…"
echo

# ── Dead code. These MUST go — src/lib/firebase.ts still imports the firebase
#    package, which is no longer a dependency, so the build fails while it exists.
DEAD=(
  "src/lib/firebase.ts"
  "src/lib/gemini.ts"
  "test-gemini.mjs"
  "test.ts"
  "public/lily-avatar.jpg"
)

for f in "${DEAD[@]}"; do
  if [ -e "$f" ]; then
    rm -f "$f"
    echo "  removed  $f"
  fi
done

# ── Design references belong in docs/, not at the root.
mkdir -p docs

MOVE=(
  "second_brain_calendar_day_timeline.html"
  "second_brain_capture_popup.html"
  "second_brain_home_v2.html"
  "second_brain_menu_screen.html"
  "second_brain_navbar_v2.html"
  "second-brain-content-types.md"
  "second-brain-ui-design.md"
  "ui_stack.txt"
)

for f in "${MOVE[@]}"; do
  if [ -e "$f" ]; then
    mv "$f" "docs/$f"
    echo "  moved    $f -> docs/$f"
  fi
done

if [ -d "Plans" ] && [ ! -d "docs/Plans" ]; then
  mv Plans docs/Plans
  echo "  moved    Plans/ -> docs/Plans/"
fi

echo
echo "Done. Now verify the build:"
echo
echo "  npm install"
echo "  npm run build"
echo
