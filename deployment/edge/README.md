# AgogSaaS Edge Deployment

Production data capture at manufacturing facilities - offline-capable and auto-syncing.

## Overview

The Edge deployment runs on facility-level hardware ($600-$3000 edge computers) and provides:

- **Offline-capable production data capture** - Continues working without internet
- **Auto-sync to regional cloud** - Syncs data when connection is available
- **Lightweight footprint** - Optimized for edge hardware
- **Health monitoring** - Reports status to cloud every 30 seconds

## Architecture

```
┌─────────────────────────────────────────┐
│         Edge Computer (Facility)        │
├─────────────────────────────────────────┤
│  PostgreSQL (Edge DB)                   │
│  Backend API (Production Data Capture)  │
│  NATS (Message Queue)                   │
│  Sync Agent (Cloud Sync)                │
│  Health Monitor                          │
│  Ollama (Optional - Phase 4 Memory)     │
└─────────────────────────────────────────┘
           ↕ (Auto-sync when online)
┌─────────────────────────────────────────┐
│      Regional Cloud (US/EU/APAC)        │
└─────────────────────────────────────────┘
```

## Hardware Requirements

### Minimum (Budget: $600-$1000)
- **CPU:** Intel i3/i5 or AMD Ryzen 3/5
- **RAM:** 8GB DDR4
- **Storage:** 256GB SSD
- **Network:** Ethernet (WiFi backup optional)
- **Example:** Intel NUC, Dell OptiPlex Micro

### Recommended (Budget: $1500-$2000)
- **CPU:** Intel i5/i7 or AMD Ryzen 5/7
- **RAM:** 16GB DDR4
- **Storage:** 512GB SSD
- **Network:** Gigabit Ethernet + WiFi
- **Example:** HP ProDesk, Lenovo ThinkCentre

### With Ollama AI (Budget: $2500-$3000)
- **CPU:** Intel i7/i9 or AMD Ryzen 7/9
- **RAM:** 32GB DDR4
- **Storage:** 1TB NVMe SSD
- **Network:** Gigabit Ethernet
- **Example:** High-end Intel NUC, Custom build

## Quick Start

### One-Command Provisioning

```bash
# Download and run provisioning script
curl -fsSL https://agogsaas.com/provision-edge.sh | bash -s facility-la-001 acme-corp US-EAST
```

This will:
1. Install Docker & Docker Compose
2. Download edge configuration
3. Generate secure passwords
4. Pull Docker images
5. Start all services
6. Register with regional cloud
7. Setup auto-start

### Manual Deployment

```bash
# 1. Clone repository
git clone https://github.com/yourusername/agogsaas.git
cd agogsaas/deployment/edge

# 2. Create .env file
cp .env.edge.example .env
nano .env  # Edit configuration

# 3. Start services
docker-compose -f docker-compose.edge.yml up -d

# 4. Verify health
curl http://localhost:4000/health
```

## Configuration

Edit `.env` file:

```bash
# Facility Information
FACILITY_ID=facility-la-001
TENANT_ID=acme-corp
REGION=US-EAST

# Database
EDGE_DB_NAME=agog_edge
EDGE_DB_USER=edge_user
EDGE_DB_PASSWORD=changeme_secure_password
EDGE_DB_PORT=5432

# Regional Cloud Connection
REGIONAL_CLOUD_URL=https://us-east.agogsaas.com
REGIONAL_CLOUD_API_KEY=your_api_key_here

# Sync Configuration
SYNC_INTERVAL=30          # Seconds between sync attempts
SYNC_BATCH_SIZE=1000      # Records per sync batch

# Ollama (disable for low-end hardware)
OLLAMA_ENABLED=false
```

## Services

### Backend API (Port 4000)
Production data capture, inventory transactions, quality inspections

**Health Check:**
```bash
curl http://localhost:4000/health
```

### PostgreSQL (Port 5432)
Local edge database - persists all production data

**Connect:**
```bash
psql -h localhost -U edge_user -d agog_edge
```

### NATS (Port 4222, Monitoring 8222)
Message queue for cloud sync

**Monitoring:**
```bash
curl http://localhost:8222
```

### Sync Agent
Automatically syncs data to regional cloud when online

### Health Monitor
Reports edge status to cloud every 30 seconds

## Management

### View Logs
```bash
# All services
docker-compose -f docker-compose.edge.yml logs -f

# Specific service
docker-compose -f docker-compose.edge.yml logs -f backend-edge
```

### Stop Services
```bash
docker-compose -f docker-compose.edge.yml down
```

### Restart Services
```bash
docker-compose -f docker-compose.edge.yml restart
```

### Check Status
```bash
docker-compose -f docker-compose.edge.yml ps
```

### Update to Latest Version
```bash
# Pull latest images
docker-compose -f docker-compose.edge.yml pull

# Restart services
docker-compose -f docker-compose.edge.yml up -d
```

## Offline Operation

The edge deployment is designed to work fully offline:

1. **Production continues** - All data capture works without internet
2. **Local database** - Data persists on local SSD
3. **Queue for sync** - Changes queued for upload when online
4. **Auto-reconnect** - Syncs automatically when connection restored

## Monitoring

### Health Endpoints

```bash
# Backend health
curl http://localhost:4000/health

# NATS monitoring
curl http://localhost:8222/varz
```

### Resource Usage

```bash
# CPU and memory
docker stats

# Disk space
df -h
```

### Logs

```bash
# Backend logs
docker logs edge-backend -f

# Sync agent logs
docker logs edge-sync-agent -f

# Database logs
docker logs edge-postgres -f
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend-edge

# Verify database is healthy
docker-compose exec postgres-edge pg_isready

# Restart services
docker-compose restart
```

### Sync not working
```bash
# Check sync agent logs
docker-compose logs sync-agent

# Test regional cloud connectivity
curl https://us-east.agogsaas.com/health

# Verify API key in .env
```

### Out of disk space
```bash
# Clean old logs
docker system prune -a

# Check PostgreSQL size
docker exec edge-postgres psql -U edge_user -c "SELECT pg_size_pretty(pg_database_size('agog_edge'));"
```

## Security

- **Non-root containers** - All services run as unprivileged users
- **Network isolation** - Internal Docker network
- **Encrypted sync** - TLS for cloud communication
- **VPN recommended** - For secure cloud connection
- **Firewall** - Only expose necessary ports

## Backup

### Manual Backup
```bash
# Backup database
docker exec edge-postgres pg_dump -U edge_user agog_edge > backup_$(date +%Y%m%d).sql

# Backup .env
cp .env .env.backup_$(date +%Y%m%d)
```

### Restore
```bash
# Restore database
docker exec -i edge-postgres psql -U edge_user agog_edge < backup_20241216.sql
```

## Support

- **Documentation:** https://docs.agogsaas.com/edge
- **Support Email:** support@agogsaas.com
- **Emergency:** Call regional support center

## License

Copyright 2024 AgogSaaS. All rights reserved.
