#!/bin/bash
# Blue-Green Deployment: Rollback to Blue
# Purpose: Emergency rollback from Green to Blue environment
# Usage: ./switch-to-blue.sh

set -e

echo "===== ROLLING BACK TO BLUE ENVIRONMENT ====="
echo ""

# 1. Verify Blue is healthy
echo "[1/4] Verifying Blue environment health..."
BLUE_HEALTH=$(curl -sf http://localhost:8080/health || echo "FAILED")

if [ "$BLUE_HEALTH" = "FAILED" ]; then
  echo "✗ ERROR: Blue environment is not healthy"
  echo "  This is a critical situation - both environments may be down"
  echo "  Check: docker-compose -f docker-compose.blue-green.yml logs backend-blue"
  exit 1
fi

echo "  ✓ Blue environment healthy"

# 2. Update NGINX configuration to route to Blue
echo "[2/4] Updating load balancer to route to Blue..."
docker-compose -f docker-compose.blue-green.yml exec -T nginx sh -c "sed -i 's/set \$active_env \"green\"/set \$active_env \"blue\"/' /etc/nginx/conf.d/blue-green.conf"

# 3. Reload NGINX
echo "[3/4] Reloading NGINX..."
docker-compose -f docker-compose.blue-green.yml exec -T nginx nginx -s reload
echo "  ✓ NGINX reloaded"

# 4. Verify traffic routing to Blue
echo "[4/4] Verifying traffic routes to Blue..."
sleep 2

for i in {1..10}; do
  ENV=$(curl -sf http://localhost/health | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
  if [ "$ENV" = "blue" ]; then
    echo "  ✓ Traffic successfully routed to Blue"
    echo ""
    echo "===== ROLLBACK COMPLETE ====="
    echo "Production traffic now serving from BLUE environment"
    echo ""
    echo "Green environment still running for investigation:"
    echo "  - Access at: http://localhost:8081"
    echo "  - Logs: docker-compose -f docker-compose.blue-green.yml logs backend-green"
    echo ""
    exit 0
  fi
  sleep 1
done

echo "✗ FAILED: Traffic not routing to Blue after 10 seconds"
exit 1
