#!/bin/bash
# Blue-Green Deployment: Switch Traffic to Green
# Purpose: Cutover production traffic from Blue to Green environment
# Usage: ./switch-to-green.sh

set -e

echo "===== SWITCHING TO GREEN ENVIRONMENT ====="
echo ""

# 1. Verify Green is healthy
echo "[1/5] Verifying Green environment health..."
GREEN_HEALTH=$(curl -sf http://localhost:8081/health || echo "FAILED")

if [ "$GREEN_HEALTH" = "FAILED" ]; then
  echo "✗ ABORT: Green environment is not healthy"
  echo "  Check: docker-compose -f docker-compose.blue-green.yml logs backend-green"
  exit 1
fi

echo "  ✓ Green environment healthy"

# 2. Run smoke tests on Green
echo "[2/5] Running smoke tests on Green..."
if [ -f "./tests/smoke/smoke-test.sh" ]; then
  bash ./tests/smoke/smoke-test.sh http://localhost:8081
  if [ $? -ne 0 ]; then
    echo "✗ ABORT: Smoke tests failed on Green"
    exit 1
  fi
  echo "  ✓ Smoke tests passed"
else
  echo "  ⚠ WARNING: Smoke test script not found, skipping"
fi

# 3. Update NGINX configuration to route to Green
echo "[3/5] Updating load balancer to route to Green..."
docker-compose -f docker-compose.blue-green.yml exec -T nginx sh -c "sed -i 's/set \$active_env \"blue\"/set \$active_env \"green\"/' /etc/nginx/conf.d/blue-green.conf"

# 4. Reload NGINX
echo "[4/5] Reloading NGINX..."
docker-compose -f docker-compose.blue-green.yml exec -T nginx nginx -s reload
echo "  ✓ NGINX reloaded"

# 5. Verify traffic routing to Green
echo "[5/5] Verifying traffic routes to Green..."
sleep 2  # Give NGINX a moment to reload

for i in {1..10}; do
  ENV=$(curl -sf http://localhost/health | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
  if [ "$ENV" = "green" ]; then
    echo "  ✓ Traffic successfully routed to Green"
    echo ""
    echo "===== CUTOVER COMPLETE ====="
    echo "Production traffic now serving from GREEN environment"
    echo ""
    echo "Next steps:"
    echo "  1. Monitor Grafana dashboard: http://localhost:3002"
    echo "  2. Watch Green logs: docker-compose -f docker-compose.blue-green.yml logs -f backend-green"
    echo "  3. If issues occur, rollback: ./infrastructure/scripts/switch-to-blue.sh"
    echo ""
    exit 0
  fi
  sleep 1
done

echo "✗ FAILED: Traffic not routing to Green after 10 seconds"
echo "  Check NGINX logs: docker-compose -f docker-compose.blue-green.yml logs nginx"
exit 1
