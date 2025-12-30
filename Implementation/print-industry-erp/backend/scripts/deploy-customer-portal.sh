#!/bin/bash
# ============================================
# Customer Portal Deployment Script
# ============================================
# REQ: REQ-STRATEGIC-AUTO-1767048328659
# Purpose: Deploy customer portal infrastructure
# Usage: ./scripts/deploy-customer-portal.sh

set -e  # Exit on error

echo "=========================================="
echo "Customer Portal Deployment"
echo "REQ-STRATEGIC-AUTO-1767048328659"
echo "=========================================="
echo ""

# Check environment variables
echo "1. Checking environment configuration..."
if [ -z "$CUSTOMER_JWT_SECRET" ]; then
    echo "ERROR: CUSTOMER_JWT_SECRET not set"
    echo "Generate with: openssl rand -base64 64"
    exit 1
fi

echo "✓ JWT secret configured"

# Run migration
echo ""
echo "2. Running database migration..."
docker-compose exec postgres psql -U agog -d agog -f /docker-entrypoint-initdb.d/V0.0.43__create_customer_portal_tables.sql

if [ $? -eq 0 ]; then
    echo "✓ Migration V0.0.43 applied successfully"
else
    echo "✗ Migration failed"
    exit 1
fi

# Verify tables exist
echo ""
echo "3. Verifying table creation..."
TABLES=$(docker-compose exec postgres psql -U agog -d agog -t -c "
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_name IN (
        'customer_users',
        'refresh_tokens',
        'artwork_files',
        'proofs',
        'customer_activity_log'
    )
")

if [ "$TABLES" -eq 5 ]; then
    echo "✓ All 5 customer portal tables created"
else
    echo "✗ Expected 5 tables, found $TABLES"
    exit 1
fi

# Install NPM packages (if not already installed)
echo ""
echo "4. Installing authentication dependencies..."
cd backend
npm install --save \
    @nestjs/passport \
    @nestjs/jwt \
    passport \
    passport-jwt \
    passport-local \
    bcrypt \
    class-validator \
    class-transformer \
    helmet \
    express-rate-limit \
    graphql-query-complexity

npm install --save-dev \
    @types/passport-jwt \
    @types/passport-local \
    @types/bcrypt

echo "✓ Dependencies installed"

# Build backend
echo ""
echo "5. Building backend..."
npm run build

if [ $? -eq 0 ]; then
    echo "✓ Backend build successful"
else
    echo "✗ Build failed"
    exit 1
fi

# Restart backend service
echo ""
echo "6. Restarting backend service..."
cd ..
docker-compose restart backend

echo ""
echo "=========================================="
echo "Customer Portal Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run health check: ./scripts/health-check-customer-portal.sh"
echo "2. Enable portal for test customer: UPDATE customers SET portal_enabled = TRUE WHERE customer_code = 'TEST01'"
echo "3. Test registration: GraphQL mutation customerRegister"
echo ""
