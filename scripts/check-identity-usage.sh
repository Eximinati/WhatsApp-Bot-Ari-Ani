#!/bin/bash
# scripts/check-identity-usage.sh

set -e

echo "--- Checking identity usage patterns ---"

# 1. Forbid message.sender in services (logic layer)
echo "Checking for raw message.sender in service files (logic layer)..."
if grep -r -n "message\.sender[^I]" src/services/*.js 2>/dev/null | grep -v "message\.senderId"; then
  echo "ERROR: Raw message.sender found in service files (logic layer):"
  grep -r -n "message\.sender[^I]" src/services/*.js 2>/dev/null | grep -v "message\.senderId" | while read line; do
    echo "  $line"
  done
  exit 1
fi

# 2. Check that senderId is used in service files
echo "Checking for proper senderId usage in service files..."
if ! grep -q "senderId" src/services/*.js 2>/dev/null; then
  echo "WARNING: senderId not found in any service file"
fi

# 3. Check no stale extractUserId imports from jid.js
echo "Checking for stale extractUserId imports from jid.js..."
if grep -r -n "extractUserId.*from.*jid" src/services/*.js 2>/dev/null; then
  echo "ERROR: Stale extractUserId import from jid.js found:"
  grep -r -n "extractUserId.*from.*jid" src/services/*.js
  exit 1
fi

# 4. Check identity-resolver.js exports are consistent
echo "Checking identity-resolver.js exports..."
if ! grep -q "extractUserId.*extract" src/utils/identity-resolver.js 2>/dev/null; then
  echo "ERROR: identity-resolver.js does not export extractUserId as alias"
  exit 1
fi

echo "--- Identity usage check PASSED ---"
