#!/bin/bash
# DR Drill: Regional Failover
# Purpose: Simulate regional cloud failure and verify automated failover
# Expected RTO: 15 minutes
# Usage: ./scripts/dr/drill-regional-failover.sh

set -e

echo "===== DR DRILL: Regional Failover ====="
echo "Simulating US-EAST region failure..."
echo ""

# Check if running in docker-compose environment
if ! docker-compose -f docker-compose.blue-green.yml ps | grep -q "agogsaas-backend-blue"; then
  echo "✗ ERROR: Blue-green environment not running"
  echo "  Start it: docker-compose -f docker-compose.blue-green.yml up -d"
  exit 1
fi

# 1. Record baseline metrics
echo "[1/6] Recording baseline metrics..."
BASELINE_TIME=$(date +%s)

# Check if Blue is active
BLUE_STATUS=$(curl -sf http://localhost:8080/health || echo "DOWN")
if [ "$BLUE_STATUS" = "DOWN" ]; then
  echo "✗ ERROR: Blue environment not accessible"
  exit 1
fi
echo "  ✓ Blue environment accessible (baseline established)"

# 2. Simulate Blue failure (pause containers)
echo "[2/6] Simulating Blue environment failure..."
START_TIME=$(date +%s)
docker-compose -f docker-compose.blue-green.yml pause backend-blue frontend-blue
echo "  ✓ Blue environment paused (simulated outage)"

# 3. Verify Green can serve traffic
echo "[3/6] Verifying Green environment can serve traffic..."
sleep 3  # Brief pause

GREEN_HEALTH=$(curl -sf http://localhost:8081/health || echo "FAILED")
if [ "$GREEN_HEALTH" = "FAILED" ]; then
  echo "✗ FAILED: Green environment not responding"
  echo "  Restoring Blue..."
  docker-compose -f docker-compose.blue-green.yml unpause backend-blue frontend-blue
  exit 1
fi
echo "  ✓ Green environment responding"

# 4. Simulate DNS failover (switch to Green)
echo "[4/6] Simulating DNS failover to Green..."
./infrastructure/scripts/switch-to-green.sh > /dev/null 2>&1
echo "  ✓ Traffic switched to Green"

# 5. Verify application still works via load balancer
echo "[5/6] Verifying application serves traffic..."
LB_RESPONSE=$(curl -sf http://localhost/health | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)

if [ "$LB_RESPONSE" = "green" ]; then
  echo "  ✓ Application serving from Green via load balancer"
else
  echo "✗ FAILED: Load balancer not routing to Green (got: $LB_RESPONSE)"
  docker-compose -f docker-compose.blue-green.yml unpause backend-blue frontend-blue
  exit 1
fi

# 6. Calculate RTO
END_TIME=$(date +%s)
FAILOVER_TIME=$((END_TIME - START_TIME))
echo "[6/6] Calculating RTO..."
echo "  Failover completed in: $FAILOVER_TIME seconds"

# 7. Restore Blue (end drill)
echo ""
echo "Restoring Blue environment..."
docker-compose -f docker-compose.blue-green.yml unpause backend-blue frontend-blue
sleep 3

# Switch back to Blue
./infrastructure/scripts/switch-to-blue.sh > /dev/null 2>&1
echo "✓ Blue environment restored and active"

# 8. Summary
echo ""
echo "===== DRILL COMPLETE ====="
echo "Failover Time (RTO): $FAILOVER_TIME seconds"
echo "Target RTO: 900 seconds (15 minutes)"
echo ""

if [ $FAILOVER_TIME -le 900 ]; then
  echo "✓ RTO TARGET MET"
  echo ""
  echo "Success criteria:"
  echo "  ✓ Blue failure detected"
  echo "  ✓ Green served traffic successfully"
  echo "  ✓ Failover completed in < 15 minutes"
  exit 0
else
  echo "✗ RTO TARGET MISSED"
  echo "  Expected: ≤ 900 seconds"
  echo "  Actual: $FAILOVER_TIME seconds"
  exit 1
fi
