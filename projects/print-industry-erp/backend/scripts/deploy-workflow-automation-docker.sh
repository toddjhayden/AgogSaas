#!/bin/bash
# Docker-based Deployment Script for Workflow Automation Engine
# REQ: REQ-STRATEGIC-AUTO-1767108044309

set -e

echo "=========================================="
echo "Workflow Automation Engine Deployment"
echo "Container-based Deployment"
echo "REQ: REQ-STRATEGIC-AUTO-1767108044309"
echo "=========================================="
echo ""

# Check if running in Docker
if [ -f /.dockerenv ]; then
  echo "✓ Running inside Docker container"
else
  echo "⚠ Not running in Docker container"
  echo "  Consider using deploy-workflow-automation.sh for native deployment"
fi

# Database connection check
echo ""
echo "Step 1: Checking database connection..."
if command -v psql &> /dev/null; then
  psql "${DATABASE_URL}" -c "SELECT version();" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ Database connection successful"
  else
    echo "✗ Database connection failed"
    echo "  Check DATABASE_URL environment variable"
    exit 1
  fi
else
  echo "⚠ psql client not available in container"
  echo "  Skipping direct database check"
fi

# Check for migration file
echo ""
echo "Step 2: Verifying migration file..."
if [ -f "migrations/V0.0.61__create_workflow_automation_engine.sql" ]; then
  echo "✓ Migration file found"
else
  echo "✗ Migration file not found"
  echo "  Expected: migrations/V0.0.61__create_workflow_automation_engine.sql"
  exit 1
fi

# Run migration via NestJS CLI or direct psql
echo ""
echo "Step 3: Applying database migration..."
if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
  psql "${DATABASE_URL}" -f migrations/V0.0.61__create_workflow_automation_engine.sql
  if [ $? -eq 0 ]; then
    echo "✓ Migration applied successfully"
  else
    echo "✗ Migration failed"
    exit 1
  fi
else
  echo "⚠ psql not available - migration should be run via Flyway or manual process"
  echo "  Manual command: docker exec -i <db-container> psql -U <user> -d <database> < migrations/V0.0.61__create_workflow_automation_engine.sql"
fi

# Verify backend files
echo ""
echo "Step 4: Verifying backend implementation files..."
FILES=(
  "src/modules/workflow/services/workflow-engine.service.ts"
  "src/graphql/resolvers/workflow.resolver.ts"
  "src/modules/workflow/workflow.module.ts"
  "src/graphql/schema/workflow.graphql"
)

ALL_FILES_PRESENT=true
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "  ✓ $FILE"
  else
    echo "  ✗ $FILE (missing)"
    ALL_FILES_PRESENT=false
  fi
done

if [ "$ALL_FILES_PRESENT" = true ]; then
  echo "✓ All implementation files present"
else
  echo "✗ Some implementation files are missing"
  exit 1
fi

# Build backend (if in dev container with build tools)
echo ""
echo "Step 5: Building backend application..."
if command -v npm &> /dev/null; then
  if [ -f "package.json" ]; then
    echo "  Installing dependencies..."
    npm install --production=false

    echo "  Building application..."
    npm run build

    if [ $? -eq 0 ]; then
      echo "✓ Backend build successful"
    else
      echo "✗ Backend build failed"
      exit 1
    fi
  else
    echo "⚠ package.json not found"
  fi
else
  echo "⚠ npm not available - build step skipped"
  echo "  Build should occur in CI/CD pipeline"
fi

# Verify Docker Compose configuration
echo ""
echo "Step 6: Checking Docker Compose configuration..."
if [ -f "../docker-compose.app.yml" ]; then
  echo "✓ docker-compose.app.yml found"

  # Check if backend service is configured
  if grep -q "backend:" ../docker-compose.app.yml; then
    echo "  ✓ Backend service configured"
  else
    echo "  ⚠ Backend service not found in docker-compose.app.yml"
  fi
else
  echo "⚠ docker-compose.app.yml not found"
fi

# Summary
echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo "✓ Migration file verified"
echo "✓ Implementation files verified"
echo "✓ Backend build completed (if applicable)"
echo ""
echo "Next Steps for Docker Deployment:"
echo "1. Ensure database container is running:"
echo "   docker-compose -f docker-compose.app.yml up -d postgres"
echo ""
echo "2. Apply migration (if not done automatically):"
echo "   docker exec backend-container npm run migration:run"
echo ""
echo "3. Restart backend container to load new module:"
echo "   docker-compose -f docker-compose.app.yml restart backend"
echo ""
echo "4. Run health check:"
echo "   docker exec backend-container ./scripts/health-check-workflow-automation.sh"
echo ""
echo "5. View logs:"
echo "   docker-compose -f docker-compose.app.yml logs -f backend"
echo ""
echo "6. Test GraphQL endpoint:"
echo "   curl http://localhost:4000/graphql -H 'Content-Type: application/json' -d '{\"query\": \"{ workflowDefinitions { id name } }\" }'"
echo ""
echo "=========================================="
echo "Docker Deployment Complete!"
echo "=========================================="
