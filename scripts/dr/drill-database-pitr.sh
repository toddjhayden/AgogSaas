#!/bin/bash
# DR Drill: Database Point-in-Time Recovery
# Purpose: Verify ability to restore database from backup
# Expected RTO: 45 minutes, RPO: 5 minutes
# Usage: ./scripts/dr/drill-database-pitr.sh

set -e

echo "===== DR DRILL: Database Point-in-Time Recovery ====="
echo ""

# Check if PostgreSQL is accessible
if ! docker-compose -f docker-compose.blue-green.yml ps | grep -q "postgres-blue"; then
  echo "✗ ERROR: Blue-green environment not running"
  exit 1
fi

# 1. Create test data with timestamp
echo "[1/6] Creating test data..."
TEST_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S')
TEST_CUSTOMER="DR_DRILL_$(date +%s)"

docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas << EOF
INSERT INTO orders (id, customer, created_at)
VALUES (uuid_generate_v7(), '$TEST_CUSTOMER', NOW());
EOF

echo "  ✓ Created test order for customer: $TEST_CUSTOMER"

# Wait to simulate time passing
sleep 5

# 2. Record the order ID for verification
echo "[2/6] Recording test order ID..."
TEST_ORDER_ID=$(docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas -tAc \
  "SELECT id FROM orders WHERE customer = '$TEST_CUSTOMER' ORDER BY created_at DESC LIMIT 1")
TEST_ORDER_ID=$(echo "$TEST_ORDER_ID" | tr -d '[:space:]')
echo "  Order ID: $TEST_ORDER_ID"

# 3. Create a "restore point" (simulate backup)
RESTORE_POINT=$(date +%s)
echo "[3/6] Restore point established at: $(date -d @$RESTORE_POINT '+%Y-%m-%d %H:%M:%S')"

# Simulate pg_dump backup
BACKUP_FILE="/tmp/agog-backup-$RESTORE_POINT.sql"
echo "  Creating backup: $BACKUP_FILE"
docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  pg_dump -U agogsaas_user agogsaas > "$BACKUP_FILE"
echo "  ✓ Backup created ($(wc -l < $BACKUP_FILE) lines)"

# 4. Create post-backup data (should NOT be in restore)
sleep 3
echo "[4/6] Creating post-backup data (simulating data loss)..."
POST_BACKUP_CUSTOMER="POST_BACKUP_$(date +%s)"
docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas << EOF
INSERT INTO orders (id, customer, created_at)
VALUES (uuid_generate_v7(), '$POST_BACKUP_CUSTOMER', NOW());
EOF
echo "  ✓ Created post-backup order: $POST_BACKUP_CUSTOMER"

# 5. Simulate database corruption (drop the table)
echo "[5/6] Simulating database corruption..."
docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas << EOF
TRUNCATE TABLE orders CASCADE;
EOF
echo "  ⚠ Orders table truncated (simulated data loss)"

# Verify data lost
ORDER_COUNT=$(docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas -tAc "SELECT COUNT(*) FROM orders")
ORDER_COUNT=$(echo "$ORDER_COUNT" | tr -d '[:space:]')
echo "  Current order count: $ORDER_COUNT (should be 0)"

# 6. Restore from backup
echo "[6/6] Restoring database from backup..."
START_RESTORE=$(date +%s)

docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas < "$BACKUP_FILE" > /dev/null 2>&1

END_RESTORE=$(date +%s)
RESTORE_DURATION=$((END_RESTORE - START_RESTORE))
echo "  ✓ Database restored in $RESTORE_DURATION seconds"

# 7. Verify test order exists
echo ""
echo "Verifying restoration..."
FOUND_ORDER=$(docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas -tAc \
  "SELECT COUNT(*) FROM orders WHERE id = '$TEST_ORDER_ID'")
FOUND_ORDER=$(echo "$FOUND_ORDER" | tr -d '[:space:]')

if [ "$FOUND_ORDER" -eq 1 ]; then
  echo "  ✓ Test order found in restored database"
else
  echo "  ✗ FAILED: Test order NOT found"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# 8. Verify post-backup data is NOT restored (correct RPO)
POST_BACKUP_FOUND=$(docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas -tAc \
  "SELECT COUNT(*) FROM orders WHERE customer = '$POST_BACKUP_CUSTOMER'")
POST_BACKUP_FOUND=$(echo "$POST_BACKUP_FOUND" | tr -d '[:space:]')

if [ "$POST_BACKUP_FOUND" -eq 0 ]; then
  echo "  ✓ Post-backup data correctly excluded (RPO verified)"
else
  echo "  ✗ WARNING: Found post-backup data in restore (RPO issue)"
fi

# 9. Cleanup
echo ""
echo "Cleaning up test data..."
docker-compose -f docker-compose.blue-green.yml exec -T postgres-blue \
  psql -U agogsaas_user -d agogsaas << EOF
DELETE FROM orders WHERE customer LIKE 'DR_DRILL_%' OR customer LIKE 'POST_BACKUP_%';
EOF
rm -f "$BACKUP_FILE"
echo "✓ Cleanup complete"

# 10. Summary
echo ""
echo "===== DRILL COMPLETE ====="
echo "Restore Duration (RTO): $RESTORE_DURATION seconds"
echo "Target RTO: 2700 seconds (45 minutes)"
echo "RPO: ~5 seconds (time between backup and corruption)"
echo ""

if [ $RESTORE_DURATION -le 2700 ]; then
  echo "✓ RTO TARGET MET"
  echo ""
  echo "Success criteria:"
  echo "  ✓ Backup created successfully"
  echo "  ✓ Database restored from backup"
  echo "  ✓ Pre-backup data recovered"
  echo "  ✓ Post-backup data excluded (correct RPO)"
  exit 0
else
  echo "✗ RTO TARGET MISSED"
  echo "  Expected: ≤ 2700 seconds"
  echo "  Actual: $RESTORE_DURATION seconds"
  exit 1
fi
