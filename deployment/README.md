# AgogSaaS Deployment Guide

Comprehensive containerization for edge computers and regional cloud infrastructure.

## Table of Contents

- [Overview](#overview)
- [Deployment Types](#deployment-types)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Scripts](#scripts)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Security](#security)

## Overview

AgogSaaS uses a 3-tier deployment architecture:

```
Edge (Facility) → Regional (US/EU/APAC) → Global (Analytics)
```

**Key Features:**
- ✅ **Offline-capable edge computers** - Production continues without internet
- ✅ **Blue-Green deployments** - Zero-downtime updates
- ✅ **Multi-region support** - Global scale with low latency
- ✅ **Auto-scaling** - Handle load spikes automatically
- ✅ **Full monitoring** - Prometheus + Grafana
- ✅ **Automated CI/CD** - GitHub Actions pipeline

## Deployment Types

### 1. Edge Deployment (Facility-Level)

**Purpose:** Production data capture at manufacturing facilities

**Hardware:** $600-$3000 edge computers

**Features:**
- Offline-capable
- Auto-sync to regional cloud
- PostgreSQL + Backend API + NATS
- Optional Ollama for AI

[Edge Deployment Guide →](edge/README.md)

```bash
# One-command deployment
curl -fsSL https://agogsaas.com/provision-edge.sh | bash -s facility-la-001 acme-corp US-EAST
```

### 2. Regional Cloud Deployment

**Purpose:** Multi-region cloud infrastructure

**Regions:** US-EAST, EU-CENTRAL, APAC

**Features:**
- Blue-Green environments
- Auto-scaling (3-10 replicas)
- Full monitoring stack
- Cross-region replication

[Regional Deployment Guide →](regional/README.md)

```bash
# Deploy regional infrastructure
./scripts/deploy-regional.sh US-EAST both
```

### 3. Kubernetes Production Deployment

**Purpose:** Production-grade orchestration

**Features:**
- StatefulSets for databases
- HorizontalPodAutoscaler
- Network policies (5-tier security)
- Ingress with TLS

[Kubernetes Manifests →](kubernetes/)

```bash
# Deploy to Kubernetes
kubectl apply -f kubernetes/
```

## Quick Start

### Prerequisites

```bash
# Required
- Docker 20.10+
- Docker Compose 2.0+

# Optional (for Kubernetes)
- kubectl 1.28+
- Helm 3.0+
```

### Deploy Edge Computer

```bash
# Option 1: Automated provisioning
cd deployment/edge
./provision-edge.sh facility-la-001 acme-corp US-EAST

# Option 2: Manual deployment
cp .env.edge.example .env
nano .env  # Edit configuration
docker-compose -f docker-compose.edge.yml up -d
```

### Deploy Regional Cloud

```bash
# Deploy Blue-Green environments
cd deployment/regional
cp .env.regional.example .env
nano .env  # Edit configuration
./scripts/deploy-regional.sh US-EAST both
```

### Deploy to Kubernetes

```bash
# Setup namespaces and secrets
kubectl apply -f kubernetes/postgres-statefulset.yml
kubectl apply -f kubernetes/secrets.yml
kubectl apply -f kubernetes/configmaps.yml

# Deploy applications
kubectl apply -f kubernetes/backend-deployment.yml
kubectl apply -f kubernetes/frontend-deployment.yml
kubectl apply -f kubernetes/ingress.yml

# Enable autoscaling
kubectl apply -f kubernetes/hpa.yml

# Apply security policies
kubectl apply -f kubernetes/network-policies.yml
```

## Architecture

### Edge Deployment

```
┌─────────────────────────────────┐
│   Edge Computer ($600-$3000)    │
├─────────────────────────────────┤
│ PostgreSQL (Offline DB)         │
│ Backend API (Data Capture)      │
│ NATS (Message Queue)            │
│ Sync Agent (Cloud Sync)         │
│ Health Monitor                  │
│ Ollama (Optional AI)            │
└─────────────────────────────────┘
```

### Regional Cloud

```
┌─────────────────────────────────────────┐
│          Regional Cloud                 │
├─────────────────────────────────────────┤
│ Blue Environment (Active)               │
│   - PostgreSQL + Redis + Ollama         │
│   - Backend (3 replicas)                │
│   - Frontend (2 replicas)               │
├─────────────────────────────────────────┤
│ Green Environment (Standby)             │
│   - PostgreSQL + Redis + Ollama         │
│   - Backend (3 replicas)                │
│   - Frontend (2 replicas)               │
├─────────────────────────────────────────┤
│ Shared                                  │
│   - Nginx Load Balancer                 │
│   - NATS Cluster                        │
│   - Prometheus + Grafana                │
└─────────────────────────────────────────┘
```

### Multi-Region Setup

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   US-EAST    │ ←→  │ EU-CENTRAL   │ ←→  │     APAC     │
│  (Virginia)  │     │  (Frankfurt) │     │ (Singapore)  │
└──────────────┘     └──────────────┘     └──────────────┘
      ↕                    ↕                     ↕
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Edge LA-001  │     │ Edge FR-001  │     │ Edge SG-001  │
│ Edge LA-002  │     │ Edge FR-002  │     │ Edge SG-002  │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Scripts

### Deployment Scripts

Located in `scripts/` directory:

#### deploy-edge.sh
Deploy edge computer with one command

```bash
./scripts/deploy-edge.sh [facility-id] [region]
```

**Example:**
```bash
./scripts/deploy-edge.sh facility-la-001 US-EAST
```

#### deploy-regional.sh
Deploy regional cloud infrastructure

```bash
./scripts/deploy-regional.sh [region] [environment]
```

**Example:**
```bash
./scripts/deploy-regional.sh US-EAST both
```

#### switch-blue-green.sh
Switch production traffic between Blue and Green

```bash
./scripts/switch-blue-green.sh [target]
```

**Example:**
```bash
# Deploy to Green
./scripts/deploy-regional.sh US-EAST green

# Test Green
curl http://localhost:4002/health

# Switch traffic
./scripts/switch-blue-green.sh green
```

#### setup-replication.sh
Configure PostgreSQL logical replication

```bash
./scripts/setup-replication.sh [type] [source] [target]
```

**Examples:**
```bash
# Edge to Regional
./scripts/setup-replication.sh edge-to-regional facility-la-001 US-EAST

# Regional to Edge (master data)
./scripts/setup-replication.sh regional-to-edge US-EAST facility-la-001

# Cross-region
./scripts/setup-replication.sh regional-to-regional US-EAST EU-CENTRAL
```

#### health-check.sh
Comprehensive health verification

```bash
./scripts/health-check.sh [deployment-type]
```

**Example:**
```bash
./scripts/health-check.sh regional
./scripts/health-check.sh edge
```

## CI/CD Pipeline

### GitHub Actions Workflow

Located at `.github/workflows/deploy.yml`

**Triggers:**
- Push to `master` → Production deployment (with approval)
- Push to `develop` → Staging deployment (auto)
- Pull requests → Build and test only
- Manual dispatch → Deploy to specific environment

**Pipeline Stages:**

1. **Build & Test**
   - Install dependencies
   - Lint code
   - Build TypeScript
   - Run tests
   - Run smoke tests

2. **Docker Build**
   - Build backend image (<200MB)
   - Build frontend image (<100MB)
   - Push to GitHub Container Registry
   - Tag with git SHA and branch

3. **Deploy Staging**
   - Auto-deploy from `develop` branch
   - Run smoke tests
   - Update staging environment

4. **Deploy Production**
   - Deploy to Blue or Green (manual approval)
   - Run comprehensive tests
   - Wait for approval to switch traffic

5. **Traffic Switch**
   - Switch nginx to new environment
   - Monitor for 5 minutes
   - Auto-rollback on failure

**Manual Deployment:**
```bash
# Via GitHub UI:
Actions → Build and Deploy → Run workflow → Select environment
```

## Monitoring

### Prometheus + Grafana Stack

**Access:**
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

**Dashboards:**
1. Regional Overview
2. Blue-Green Comparison
3. Database Performance
4. API Performance
5. Edge Health
6. Resource Utilization

**Key Metrics:**
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Database connections
- CPU/Memory usage
- Sync lag (edge)

**Alerts:**
- High error rate (>5%)
- High latency (>1s p95)
- Database connection pool exhausted
- Disk usage >90%
- Memory usage >85%
- Edge offline >5 minutes

### Health Checks

```bash
# Edge
curl http://localhost:4000/health

# Regional Blue
curl http://localhost:4001/health

# Regional Green
curl http://localhost:4002/health

# Load Balancer
curl http://localhost:80/health
```

## Security

### 5-Tier Security Zones

From `MASTER_BUILD_PLAN.md`:

1. **Standard** - Frontend (public access)
2. **Restricted** - Backend API (authenticated users)
3. **Secure** - Database (backend only)
4. **High-Security** - Redis/Session (backend only)
5. **Vault** - Ollama/AI Models (backend only, audit logged)

### Network Policies

Kubernetes NetworkPolicies enforce:
- Frontend can only access Backend
- Backend can only access Database, Redis, NATS, Ollama
- Database accepts connections only from Backend
- Cross-namespace isolation

### Secrets Management

**Development:**
- `.env` files (not committed to Git)

**Production:**
- Kubernetes Secrets
- External secret managers (Vault, AWS Secrets Manager)

**Best Practices:**
- Rotate secrets regularly
- Use strong passwords (32+ characters)
- Enable audit logging
- Principle of least privilege

## Docker Image Optimization

### Multi-Stage Builds

**Backend Dockerfile:**
- Stage 1: Build TypeScript (node:18-alpine + build tools)
- Stage 2: Production (node:18-alpine + runtime only)
- Final size: ~150-180MB

**Frontend Dockerfile:**
- Stage 1: Build React (node:18-alpine + Vite)
- Stage 2: Serve static files (nginx:alpine)
- Final size: ~40-80MB

### .dockerignore

Excludes:
- node_modules
- .git
- tests
- documentation
- build artifacts
- source maps

## Troubleshooting

### Common Issues

**Services won't start**
```bash
# Check logs
docker-compose logs [service-name]

# Verify dependencies
docker-compose ps

# Restart
docker-compose restart
```

**Sync not working (Edge)**
```bash
# Check sync agent logs
docker-compose logs sync-agent

# Test cloud connectivity
curl https://us-east.agogsaas.com/health

# Verify API key
cat .env | grep REGIONAL_CLOUD_API_KEY
```

**High database connections**
```bash
# Check active connections
docker exec postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Increase max_connections (in docker-compose.yml)
# Restart database
docker-compose restart postgres
```

**Out of disk space**
```bash
# Clean Docker
docker system prune -a

# Clean logs
docker-compose logs --tail=1000 > logs.txt
truncate -s 0 $(docker inspect --format='{{.LogPath}}' [container])
```

## Support

- **Documentation:** https://docs.agogsaas.com
- **Support Email:** support@agogsaas.com
- **Slack:** #agogsaas-devops
- **Emergency:** Call regional support center

## License

Copyright 2024 AgogSaaS. All rights reserved.

---

**Remember Todd's words:**
> "Containers, containers, containers. We want this easy to deploy. Easy to drop in the edge computers, easy to setup new geo centralizations. Better to work hard now and do less work after we deploy."

**Mission accomplished. Now let's fucking ship it.**
