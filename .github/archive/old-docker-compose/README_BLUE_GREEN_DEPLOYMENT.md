# Blue-Green Deployment Guide

**📍 Navigation Path:** [AGOG Home](./README.md) → Blue-Green Deployment Guide

## Quick Start

### 1. Start the Blue-Green Environment

```bash
# Copy environment file
cp .env.example .env

# Start all services (Blue and Green)
docker-compose -f docker-compose.blue-green.yml up -d

# Wait for services to be healthy (~60 seconds)
docker-compose -f docker-compose.blue-green.yml ps
```

### 2. Access the Environments

| Environment | Frontend | Backend API | Database | Purpose |
|-------------|----------|-------------|----------|---------|
| **Blue (Live)** | http://localhost:3000 | http://localhost:4001/graphql | localhost:5433 | Currently serving traffic |
| **Green (Deploy)** | http://localhost:3001 | http://localhost:4002/graphql | localhost:5434 | Deployment target |
| **Load Balancer** | http://localhost | http://localhost/graphql | - | Routes to active (Blue) |
| **Blue Direct** | http://localhost:8080 | http://localhost:8080/graphql | - | Test Blue directly |
| **Green Direct** | http://localhost:8081 | http://localhost:8081/graphql | - | Test Green directly |
| **Edge LA** | - | http://localhost:4010 | localhost:5436 | Simulated edge facility |
| **Global Analytics** | - | - | localhost:5435 | Executive dashboards |
| **Monitoring** | http://localhost:3002 (Grafana) | http://localhost:9090 (Prometheus) | - | Observability |

### 3. Simulate a Deployment

#### Step 1: Deploy to Green

```bash
# Green already running with current code
# Make changes to your code (simulate new version)

# Restart Green to pick up changes
docker-compose -f docker-compose.blue-green.yml restart backend-green frontend-green

# Or rebuild if Dockerfile changed
docker-compose -f docker-compose.blue-green.yml up -d --build backend-green frontend-green
```

#### Step 2: Run Smoke Tests on Green

```bash
# Test Green environment directly
./tests/smoke/smoke-test.sh http://localhost:8081

# Or use direct ports
curl http://localhost:4002/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

#### Step 3: Switch Traffic to Green

```bash
# METHOD 1: Update docker-compose.blue-green.yml
# Change: ACTIVE_ENVIRONMENT: blue → green
# Then reload nginx:
docker-compose -f docker-compose.blue-green.yml exec nginx nginx -s reload

# METHOD 2: Use deployment script (recommended)
./infrastructure/scripts/switch-to-green.sh
```

#### Step 4: Monitor Green

```bash
# Watch metrics in Grafana
open http://localhost:3002

# Check logs
docker-compose -f docker-compose.blue-green.yml logs -f backend-green
```

#### Step 5: Rollback if Needed

```bash
# Switch back to Blue
./infrastructure/scripts/switch-to-blue.sh

# Or manually:
# Change ACTIVE_ENVIRONMENT back to "blue" and reload nginx
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                  NGINX Load Balancer                     │
│                  (localhost:80)                          │
│                                                          │
│  ACTIVE_ENVIRONMENT = blue → Routes to Blue             │
│  ACTIVE_ENVIRONMENT = green → Routes to Green           │
└──────────────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    ┌───▼─────┐           ┌─────▼──┐
    │  BLUE   │           │ GREEN  │
    │  (Live) │           │ (Deploy)│
    │ v1.2.0  │           │ v1.3.0  │
    └───┬─────┘           └─────┬──┘
        │                       │
    ┌───▼────────┐       ┌──────▼───┐
    │ Postgres   │       │ Postgres │
    │ Blue       │◄──────┤ Green    │
    │ :5433      │ Repl  │ :5434    │
    └────────────┘       └──────────┘
```

---

## Database Replication (During Deployment)

### Enable Bidirectional Replication

When deploying to Green, enable replication so Blue can rollback with zero data loss:

```bash
# Set up logical replication Green → Blue
docker-compose -f docker-compose.blue-green.yml exec postgres-green psql -U agogsaas_user -d agogsaas << 'EOF'
CREATE PUBLICATION green_to_blue_pub FOR ALL TABLES;
EOF

docker-compose -f docker-compose.blue-green.yml exec postgres-blue psql -U agogsaas_user -d agogsaas << 'EOF'
CREATE SUBSCRIPTION blue_from_green_sub
CONNECTION 'host=postgres-green port=5432 dbname=agogsaas user=agogsaas_user password=${DB_PASSWORD}'
PUBLICATION green_to_blue_pub
WITH (copy_data = false, enabled = true);
EOF
```

### Stop Replication After Stabilization

```bash
# After Green is stable (24-48 hours), stop replication
docker-compose -f docker-compose.blue-green.yml exec postgres-blue psql -U agogsaas_user -d agogsaas << 'EOF'
DROP SUBSCRIPTION IF EXISTS blue_from_green_sub;
EOF
```

---

## Edge Simulation

### Simulated LA Facility (Edge Tier 1)

```bash
# Edge database (local to facility)
localhost:5436 → postgres-edge-la

# Edge API (local to facility workers)
localhost:4010 → edge-api-la

# Test offline capability
docker-compose -f docker-compose.blue-green.yml pause backend-blue backend-green

# Edge should still work (offline mode)
curl http://localhost:4010/graphql \
  -d '{"query":"mutation { createOrder(input: {customer: \"Offline Test\"}) { id } }"}'

# Unpause cloud (internet back)
docker-compose -f docker-compose.blue-green.yml unpause backend-blue backend-green

# Edge should sync to cloud
```

### Enable Edge Dual-Write (During Deployment)

```bash
# Tell edge to write to BOTH Blue and Green
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  sh -c "echo 'DUAL_WRITE_ENABLED=true' >> /app/.env && pm2 restart all"

# Edge now sends data to Blue AND Green
# Zero data loss during cutover
```

---

## Monitoring & Observability

### Grafana Dashboards

```bash
# Open Grafana
open http://localhost:3002

# Default credentials
Username: admin
Password: (check GRAFANA_PASSWORD in .env)

# Pre-configured dashboards:
# - Blue-Green Environment Comparison
# - Database Performance (Blue vs Green)
# - Edge Connectivity Status
# - Deployment Health Metrics
```

### Prometheus Metrics

```bash
# Open Prometheus
open http://localhost:9090

# Query examples:
# - Blue backend requests: http_requests_total{environment="blue"}
# - Green backend requests: http_requests_total{environment="green"}
# - Database connections: pg_connections{environment="blue"}
```

---

## Smoke Tests

### Run Full Smoke Test Suite

```bash
# Test Blue environment
./tests/smoke/smoke-test.sh http://localhost:8080

# Test Green environment
./tests/smoke/smoke-test.sh http://localhost:8081

# Test via load balancer (active environment)
./tests/smoke/smoke-test.sh http://localhost
```

### Individual Tests

```bash
# Test GraphQL
curl http://localhost:8081/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Test database
docker-compose -f docker-compose.blue-green.yml exec postgres-green \
  psql -U agogsaas_user -d agogsaas -c "SELECT 1"

# Test edge connectivity
curl http://localhost:4010/health
```

---

## Disaster Recovery Testing

### Simulate Database Failure

```bash
# Kill Blue database
docker-compose -f docker-compose.blue-green.yml stop postgres-blue

# Traffic should fail over to Green
# Test recovery procedures
./infrastructure/scripts/dr-test-database-failure.sh
```

### Simulate Region Failure

```bash
# Stop entire Blue environment
docker-compose -f docker-compose.blue-green.yml stop backend-blue frontend-blue postgres-blue

# Green should handle all traffic
# Test that edge agents reconnect to Green
```

### Simulate Edge Offline

```bash
# Disconnect edge from network
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  sh -c "iptables -A OUTPUT -d backend-blue -j DROP && iptables -A OUTPUT -d backend-green -j DROP"

# Edge should buffer transactions
curl http://localhost:4010/graphql \
  -d '{"query":"mutation { createOrder(input: {customer: \"Offline\"}) { id } }"}'

# Reconnect
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  sh -c "iptables -F OUTPUT"

# Should sync buffered transactions
```

---

## Troubleshooting

### Blue and Green Both Down

```bash
# Check all services
docker-compose -f docker-compose.blue-green.yml ps

# Check logs
docker-compose -f docker-compose.blue-green.yml logs backend-blue backend-green
```

### Database Replication Issues

```bash
# Check replication status
docker-compose -f docker-compose.blue-green.yml exec postgres-blue \
  psql -U agogsaas_user -d agogsaas -c "SELECT * FROM pg_stat_subscription"

# Check replication lag
docker-compose -f docker-compose.blue-green.yml exec postgres-blue \
  psql -U agogsaas_user -d agogsaas -c "SELECT NOW() - last_msg_receipt_time FROM pg_stat_subscription"
```

### Edge Not Connecting

```bash
# Check edge logs
docker-compose -f docker-compose.blue-green.yml logs edge-api-la

# Test connectivity to cloud
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  curl http://backend-blue:4000/health
```

---

## Cleanup

```bash
# Stop all services
docker-compose -f docker-compose.blue-green.yml down

# Remove volumes (WARNING: Deletes all data)
docker-compose -f docker-compose.blue-green.yml down -v
```

---

## Customer Demonstration

### Scenario: Show Blue-Green Deployment to Prospective Customer

**Purpose:** Build confidence in zero-downtime deployments

**Script:**

1. **Show Blue Running:**
   ```bash
   open http://localhost
   # Show it says "Environment: Blue"
   ```

2. **Deploy to Green:**
   ```bash
   # Make a visible change (add banner "NEW VERSION")
   # Restart Green
   docker-compose -f docker-compose.blue-green.yml restart backend-green frontend-green
   ```

3. **Show Green Running (Not Live Yet):**
   ```bash
   open http://localhost:8081
   # Show "NEW VERSION" banner
   # Explain: "This is our new version, being tested"
   ```

4. **Switch Traffic to Green:**
   ```bash
   ./infrastructure/scripts/switch-to-green.sh
   open http://localhost
   # Show "NEW VERSION" banner now on main site
   # Explain: "Zero downtime. Seamless cutover."
   ```

5. **Rollback (If Issue Found):**
   ```bash
   ./infrastructure/scripts/switch-to-blue.sh
   open http://localhost
   # Show back to old version
   # Explain: "Instant rollback if needed"
   ```

6. **Show Edge Resilience:**
   ```bash
   # Pause cloud
   docker-compose -f docker-compose.blue-green.yml pause backend-blue backend-green

   # Show edge still works
   curl http://localhost:4010/graphql

   # Explain: "Facilities keep working even if internet down"
   ```

---

[⬆ Back to top](#blue-green-deployment-guide) | [🏠 AGOG Home](./README.md) | [📚 Docs](./docs/README.md)
