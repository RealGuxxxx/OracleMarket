#!/bin/bash

# Deploy OracleMarketplace contract

set -e

echo "🚀 Deploying OracleMarketplace contract"
echo ""
echo "📋 Configuration:"
echo "  Min Collateral: 0.01 SUI (10,000,000 MIST)"
echo "  Platform Fee: 3%"
echo ""

# Check if already built
if [ ! -d "build/OracleMarketplace" ]; then
    echo "📦 Building contract..."
    sui move build 2>&1 | tail -10
    echo ""
fi

# Check gas balance
echo "💰 Checking gas balance..."
sui client gas 2>&1 | head -5
echo ""

# Publish contract
echo "📝 Publishing contract..."
echo "  Note: Sufficient gas required (recommended at least 0.5 SUI)"
echo ""

PUBLISH_OUTPUT=$(sui client publish --gas-budget 100000000 --json 2>&1)

# Extract package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for change in data.get('objectChanges', []):
        if change.get('type') == 'published':
            print(change.get('packageId', ''))
            break
except Exception as e:
    print('')
" 2>/dev/null)

if [ -z "$PACKAGE_ID" ]; then
    # Fallback method
    PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | grep -oE '0x[0-9a-f]{64}' | head -1)
fi

if [ -z "$PACKAGE_ID" ] || [ ${#PACKAGE_ID} -ne 66 ]; then
    echo "⚠️  Unable to automatically extract package ID"
    echo ""
    echo "Please manually find the package ID:"
    echo "$PUBLISH_OUTPUT" | grep -A 5 "Published Objects" || echo "$PUBLISH_OUTPUT" | tail -30
    echo ""
    read -p "Please enter package ID: " PACKAGE_ID
fi

echo "✅ Contract published!"
echo ""
echo "📋 Deployment information:"
echo "  Package ID: $PACKAGE_ID"
echo ""

# Save deployment information
cat > .deployment.json <<EOF
{
  "packageId": "$PACKAGE_ID",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "minCollateral": "0.01",
  "platformFeeBps": 300
}
EOF

echo "📝 Deployment information saved to .deployment.json"
echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Update package ID in frontend config: $PACKAGE_ID"
echo "  2. Create collateral pool and treasury"
echo "  3. Start creating services"

