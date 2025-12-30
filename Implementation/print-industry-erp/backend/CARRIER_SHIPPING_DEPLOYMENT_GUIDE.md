# Carrier Shipping Integrations - Quick Deployment Guide
## REQ-STRATEGIC-AUTO-1767066329941

---

## Pre-Deployment Checklist

- [ ] PostgreSQL 12+ installed and accessible
- [ ] Node.js 18+ installed
- [ ] Database backup completed
- [ ] Git tag created for rollback
- [ ] Environment variables configured
- [ ] Outbound HTTPS access to carrier APIs enabled

---

## Deployment Steps (5 minutes)

### Step 1: Navigate to Scripts Directory
```bash
cd print-industry-erp/backend/scripts
```

### Step 2: Run Deployment Script
```bash
# For production
./deploy-carrier-shipping.sh production

# For staging
./deploy-carrier-shipping.sh staging

# For development
./deploy-carrier-shipping.sh
```

**Expected Output:**
- ✅ Prerequisites check passed
- ✅ Environment file loaded
- ✅ Database migration V0.0.4 applied
- ✅ 8 database tables verified
- ✅ Backend build completed
- ✅ 7 backend services verified
- ✅ Frontend build completed
- ✅ Deployment complete

**Duration:** ~3-5 minutes (depending on npm install speed)

---

### Step 3: Run Health Check
```bash
./health-check-carrier-shipping.sh
```

**Expected Output:**
- ✅ All database tables exist
- ✅ All backend services exist
- ✅ GraphQL schema and resolvers verified
- ✅ Frontend components verified
- ✅ System Status: HEALTHY

**Success Criteria:** Zero failures, <5 warnings

---

### Step 4: Configure Carrier Integration (Admin UI)

1. Navigate to **Settings > Carrier Integrations**
2. Click **Configure** on FedEx carrier
3. Enter credentials:
   - API Key: `<your_fedex_api_key>`
   - Secret Key: `<your_fedex_secret>`
   - Account Number: `<your_account_number>`
4. Click **Save** and **Activate**
5. Click **Test Connection** to verify

---

### Step 5: Test Shipment Creation

1. Navigate to **Warehouse > Shipments**
2. Click **Create Shipment**
3. Fill in shipment details:
   - Facility: Select facility
   - Carrier: FedEx
   - Service: FedEx Ground
   - Ship To: Enter address
   - Packages: 1
4. Click **Save**
5. Click **Manifest Shipment**
6. Verify tracking number generated

**Success Criteria:** Tracking number appears, status changes to "MANIFESTED"

---

## Post-Deployment Monitoring

### Monitor for 24 Hours

Check these metrics every 4 hours:

```bash
# Check manifest success rate
psql $DATABASE_URL -c "
SELECT
  COUNT(*) FILTER (WHERE status = 'MANIFESTED') * 100.0 / COUNT(*) as success_rate
FROM shipment_manifest_attempts
WHERE created_at > NOW() - INTERVAL '1 hour';
"

# Check error rate
psql $DATABASE_URL -c "
SELECT carrier_code, COUNT(*) as error_count
FROM carrier_api_errors
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY carrier_code;
"

# Check retry queue
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM shipment_retry_queue
WHERE processed_at IS NULL;
"
```

**Alert Thresholds:**
- Success rate <90%: CRITICAL
- Error count >10/hour: WARNING
- Retry queue >50: WARNING

---

## Rollback (If Needed)

### Quick Rollback
```bash
# Disable all carrier integrations
psql $DATABASE_URL -c "UPDATE carrier_integrations SET is_active = false;"
```

### Full Rollback
```bash
# Restore database backup
psql $DATABASE_URL < carrier_shipping_pre_deployment_backup.sql

# Revert code
git revert <deployment-commit-hash>

# Rebuild
npm run build
pm2 restart all
```

---

## Troubleshooting

### Issue: "Migration V0.0.4 already applied"
**Solution:** This is normal. Migration is idempotent and won't be re-applied.

### Issue: "Table does not exist"
**Solution:**
```bash
# Manually run migration
psql $DATABASE_URL -f backend/migrations/V0.0.4__create_wms_module.sql
```

### Issue: "Carrier unavailable" when manifesting
**Solution:**
1. Check carrier API credentials
2. Check circuit breaker status
3. Verify network access to carrier API endpoint

### Issue: "Rate limit exceeded"
**Solution:**
1. Wait for token bucket refill (~10 seconds for FedEx)
2. Check rate limiter queue: `rateLimiter.getQueueLength('FEDEX')`
3. Consider upgrading carrier API plan

---

## Support Resources

**DevOps Deliverable:** `backend/BERRY_DEVOPS_DELIVERABLE_REQ-STRATEGIC-AUTO-1767066329941.md`

**Deployment Script:** `backend/scripts/deploy-carrier-shipping.sh`

**Health Check Script:** `backend/scripts/health-check-carrier-shipping.sh`

**Documentation:**
- Carrier Client Interface: `backend/src/modules/wms/interfaces/carrier-client.interface.ts`
- Saga Orchestrator: `backend/src/modules/wms/services/shipment-manifest-orchestrator.service.ts`
- Error Mapper: `backend/src/modules/wms/services/carrier-error-mapper.service.ts`

---

## Contact

**DevOps Engineer:** Berry
**Feature:** REQ-STRATEGIC-AUTO-1767066329941 - Carrier Shipping Integrations
**Status:** READY FOR DEPLOYMENT ✅
