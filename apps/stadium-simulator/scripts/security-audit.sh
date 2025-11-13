#!/bin/bash
echo "🔍 Running security audit..."
echo ""

echo "1. Checking for exposed API keys in bundle..."
npm run build
if grep -r "sk-ant" dist/ 2>/dev/null; then
  echo "❌ FAIL: API key found in bundle!"
  exit 1
else
  echo "✅ PASS: No API keys in bundle"
fi

echo ""
echo "2. Checking for API URLs in bundle..."
if grep -r "api.anthropic.com" dist/ 2>/dev/null; then
  echo "❌ FAIL: API URL found in bundle!"
  exit 1
else
  echo "✅ PASS: No API URLs in bundle"
fi

echo ""
echo "3. Running API security tests..."
npm run test:api -- api/__tests__/announcer.test.ts

echo ""
echo "✅ Security audit complete!"
