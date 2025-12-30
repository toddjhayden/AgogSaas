#!/bin/bash
# ============================================
# Customer Portal Health Check Script
# ============================================
# REQ: REQ-STRATEGIC-AUTO-1767048328659
# Purpose: Verify customer portal infrastructure is operational

set -e

echo "=========================================="
echo "Customer Portal Health Check"
echo "REQ-STRATEGIC-AUTO-1767048328659"
echo "=========================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Helper function for checks
check() {
    local name="$1"
    local command="$2"
    local expected="$3"

    echo -n "Checking $name... "

    result=$(eval "$command" 2>/dev/null || echo "ERROR")

    if [[ "$result" == *"$expected"* ]]; then
        echo "✓ PASS"
        ((PASS_COUNT++))
    else
        echo "✗ FAIL (got: $result)"
        ((FAIL_COUNT++))
    fi
}

# 1. Database tables exist
echo "1. Database Tables"
echo "==================="
check "customer_users table" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT to_regclass('customer_users')\"" \
    "customer_users"

check "refresh_tokens table" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT to_regclass('refresh_tokens')\"" \
    "refresh_tokens"

check "artwork_files table" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT to_regclass('artwork_files')\"" \
    "artwork_files"

check "proofs table" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT to_regclass('proofs')\"" \
    "proofs"

check "customer_activity_log table" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT to_regclass('customer_activity_log')\"" \
    "customer_activity_log"

# 2. RLS policies
echo ""
echo "2. Row Level Security"
echo "====================="
check "customer_users RLS enabled" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT relrowsecurity FROM pg_class WHERE relname = 'customer_users'\"" \
    "t"

check "refresh_tokens RLS enabled" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT relrowsecurity FROM pg_class WHERE relname = 'refresh_tokens'\"" \
    "t"

# 3. Indexes
echo ""
echo "3. Database Indexes"
echo "==================="
check "customer_users email index" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT indexname FROM pg_indexes WHERE tablename = 'customer_users' AND indexname = 'idx_customer_users_email'\"" \
    "idx_customer_users_email"

check "refresh_tokens token_hash index" \
    "docker-compose exec -T postgres psql -U agog -d agog -t -c \"SELECT indexname FROM pg_indexes WHERE tablename = 'refresh_tokens' AND indexname = 'idx_refresh_tokens_token_hash'\"" \
    "idx_refresh_tokens_token_hash"

# 4. GraphQL schema
echo ""
echo "4. GraphQL Schema"
echo "================="
if [ -f "backend/src/graphql/schema/customer-portal.graphql" ]; then
    echo "✓ PASS: customer-portal.graphql exists"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: customer-portal.graphql missing"
    ((FAIL_COUNT++))
fi

# 5. Backend modules
echo ""
echo "5. Backend Modules"
echo "=================="
if [ -f "backend/src/modules/customer-auth/customer-auth.service.ts" ]; then
    echo "✓ PASS: customer-auth.service.ts exists"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: customer-auth.service.ts missing"
    ((FAIL_COUNT++))
fi

if [ -f "backend/src/modules/customer-portal/customer-portal.resolver.ts" ]; then
    echo "✓ PASS: customer-portal.resolver.ts exists"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: customer-portal.resolver.ts missing"
    ((FAIL_COUNT++))
fi

# 6. Environment variables
echo ""
echo "6. Environment Configuration"
echo "============================="
if [ -n "$CUSTOMER_JWT_SECRET" ]; then
    echo "✓ PASS: CUSTOMER_JWT_SECRET configured"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: CUSTOMER_JWT_SECRET not set"
    ((FAIL_COUNT++))
fi

# 7. Backend service health
echo ""
echo "7. Backend Service"
echo "=================="
BACKEND_HEALTH=$(curl -s http://localhost:4000/health/liveness 2>/dev/null || echo "ERROR")
if [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    echo "✓ PASS: Backend service healthy"
    ((PASS_COUNT++))
else
    echo "✗ FAIL: Backend service unhealthy"
    ((FAIL_COUNT++))
fi

# Summary
echo ""
echo "=========================================="
echo "Health Check Summary"
echo "=========================================="
echo "PASSED: $PASS_COUNT"
echo "FAILED: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "✓ ALL CHECKS PASSED - Customer Portal Ready"
    exit 0
else
    echo "✗ SOME CHECKS FAILED - Review errors above"
    exit 1
fi
