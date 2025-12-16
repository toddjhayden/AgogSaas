# PostgreSQL Replication Strategy - Multi-Directional Sync

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → PostgreSQL Replication Strategy

## Overview

**PostgreSQL is the perfect choice** for AgogSaaS because it "distributes very well" and "talks to itself very well." We use **PostgreSQL logical replication** to sync data in multiple directions:

1. **Edge → Regional** (LA → US-EAST) - Operational data flows up
2. **Regional → Edge** (US-EAST → LA) - Master data flows down
3. **Region ↔ Region** (US-EAST ↔ EU-CENTRAL ↔ APAC) - Global visibility

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  GLOBAL SYNC TOPOLOGY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   US-EAST ←────────────→ EU-CENTRAL ←────────────→ APAC        │
│      ↑                        ↑                        ↑         │
│      ↓                        ↓                        ↓         │
│   LA Edge              Frankfurt Edge           Shanghai Edge   │
│   NYC Edge             Berlin Edge              Tokyo Edge      │
│   ...                  ...                      ...             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Properties:**
- **Bidirectional** - Data flows both ways (Edge ↔ Regional, Region ↔ Region)
- **Buffered** - If connection lost, changes queue and sync when restored
- **Selective** - Only sync relevant data (tenant-scoped, not everything)
- **Conflict-Free** - Edge wins for operational data, regional wins for master data

---

## Replication Layer 1: Edge ↔ Regional (Bidirectional)

### Edge → Regional (Operational Data Flows UP)

**What syncs UP from edge:**
- Orders created at facility
- Inventory transactions (picks, receipts, adjustments)
- Production logs
- Quality inspections

**Setup: LA Edge → US-EAST Regional**

```sql
-- On LA Edge (Source)
-- Create publication for operational data
CREATE PUBLICATION edge_to_regional FOR TABLE
    orders,
    inventory_transactions,
    production_logs,
    quality_inspections
WHERE (facility_id = 'facility-la-001');  -- Only LA data

-- On US-EAST Regional (Subscriber)
-- Create subscription from LA edge
CREATE SUBSCRIPTION regional_from_la_edge
CONNECTION 'host=edge-la-001.vpn.agog.com port=5432 dbname=agog_edge_la user=replication_user password=...'
PUBLICATION edge_to_regional
WITH (
    copy_data = true,           -- Initial sync
    enabled = true,
    create_slot = true,
    slot_name = 'regional_from_la_edge_slot',
    synchronous_commit = off    -- Async for performance
);
```

**Buffering when offline:**

```sql
-- PostgreSQL automatically buffers changes in WAL
-- Check replication lag
SELECT
    slot_name,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag_size,
    active
FROM pg_replication_slots
WHERE slot_name = 'regional_from_la_edge_slot';

-- If edge offline for 2 hours, WAL accumulates
-- When edge reconnects, WAL replays automatically
```

### Regional → Edge (Master Data Flows DOWN)

**What syncs DOWN from regional:**
- Customer master data (new customers added by sales team)
- Product catalog updates
- Pricing changes
- Configuration updates

**Setup: US-EAST Regional → LA Edge**

```sql
-- On US-EAST Regional (Source)
-- Create publication for master data
CREATE PUBLICATION regional_to_edge FOR TABLE
    customers,
    products,
    product_prices,
    system_configuration
WHERE (tenant_id = 'tenant-foo-inc');  -- Only Foo Inc data

-- On LA Edge (Subscriber)
-- Create subscription from US-EAST regional
CREATE SUBSCRIPTION edge_from_regional
CONNECTION 'host=postgres-blue.us-east.agog.com port=5432 dbname=agogsaas user=replication_user password=...'
PUBLICATION regional_to_edge
WITH (
    copy_data = true,
    enabled = true,
    create_slot = true,
    slot_name = 'la_edge_from_regional_slot'
);
```

**Use Case Example:**

```
9:00 AM - Sales rep (remote, connected to US-EAST cloud) adds new customer "Acme Packaging"
9:00:05 AM - Customer syncs to LA edge via regional → edge replication
9:00:10 AM - LA facility worker sees new customer in dropdown, can create order immediately
```

---

## Replication Layer 2: Region ↔ Region (Global Visibility)

### Why Region-to-Region Sync?

**Problem:** Philippines worker (connected to US-EAST) needs to see LA facility inventory to answer customer questions.

**Solution:** US-EAST syncs inventory snapshot from EU-CENTRAL and APAC regions.

### Selective Cross-Region Replication

**What syncs region-to-region:**
- ✅ Inventory levels (read-only snapshot)
- ✅ Order status (for global visibility)
- ✅ Facility online/offline status
- ❌ NOT full operational data (too much traffic)

**Setup: US-EAST ↔ EU-CENTRAL**

```sql
-- On US-EAST (Source)
-- Publish inventory snapshot
CREATE PUBLICATION us_east_to_eu_central FOR TABLE
    inventory_levels,
    facility_status
WHERE (region = 'us-east');

-- On EU-CENTRAL (Subscriber)
-- Subscribe to US-EAST inventory
CREATE SUBSCRIPTION eu_central_from_us_east
CONNECTION 'host=postgres-blue.us-east.agog.com port=5432 dbname=agogsaas user=replication_user password=...'
PUBLICATION us_east_to_eu_central
WITH (copy_data = true, enabled = true);

-- REVERSE: EU-CENTRAL → US-EAST (bidirectional)
-- On EU-CENTRAL (Source)
CREATE PUBLICATION eu_central_to_us_east FOR TABLE
    inventory_levels,
    facility_status
WHERE (region = 'eu-central');

-- On US-EAST (Subscriber)
CREATE SUBSCRIPTION us_east_from_eu_central
CONNECTION 'host=postgres-blue.eu-central.agog.com port=5432 dbname=agogsaas user=replication_user password=...'
PUBLICATION eu_central_to_us_east
WITH (copy_data = true, enabled = true);
```

**Result:** Philippines worker in US-EAST can query:

```sql
-- See LA facility inventory (local to US-EAST)
SELECT * FROM inventory_levels
WHERE facility_id = 'facility-la-001'
  AND tenant_id = 'tenant-foo-inc';

-- See Frankfurt facility inventory (replicated from EU-CENTRAL)
SELECT * FROM inventory_levels
WHERE facility_id = 'facility-frankfurt-001'
  AND tenant_id = 'tenant-foo-inc';

-- Check if Frankfurt is online
SELECT online, last_sync
FROM facility_status
WHERE facility_id = 'facility-frankfurt-001';
```

---

## Cross-Region Query Pattern (Philippines Sees LA Inventory)

### Backend GraphQL Resolver

```typescript
// backend/src/modules/inventory/resolvers/inventory-levels.resolver.ts

export class InventoryLevelsResolver {
  async getInventoryLevels(
    parent: any,
    args: { facilityId: string },
    context: GraphQLContext
  ) {
    const { tenant_id } = context.user;

    // Query inventory (works for local AND remote facilities)
    const inventory = await context.pool.query(`
      SELECT
        il.product_id,
        il.quantity,
        il.last_updated,
        fs.online AS facility_online,
        fs.last_sync AS facility_last_sync,
        fs.region AS facility_region
      FROM inventory_levels il
      LEFT JOIN facility_status fs ON fs.facility_id = il.facility_id
      WHERE il.facility_id = $1
        AND il.tenant_id = $2
    `, [args.facilityId, tenant_id]);

    // Calculate data freshness
    const results = inventory.rows.map(row => {
      const lastSync = new Date(row.facility_last_sync);
      const ageSeconds = (Date.now() - lastSync.getTime()) / 1000;

      return {
        ...row,
        data_freshness: {
          is_stale: ageSeconds > 60,  // Stale if > 1 minute old
          age_seconds: ageSeconds,
          facility_online: row.facility_online,
          warning: !row.facility_online
            ? `${args.facilityId} is OFFLINE. Data is cached from ${lastSync.toISOString()}.`
            : null
        }
      };
    });

    return results;
  }
}
```

### Frontend React Component (Warning Banner)

```tsx
// frontend/src/components/InventoryView.tsx

export function InventoryView({ facilityId }: { facilityId: string }) {
  const { data, loading } = useQuery(GET_INVENTORY_LEVELS, {
    variables: { facilityId }
  });

  if (loading) return <CircularProgress />;

  const inventory = data.inventoryLevels;
  const isStale = inventory[0]?.data_freshness?.is_stale;
  const warning = inventory[0]?.data_freshness?.warning;

  return (
    <div>
      {warning && (
        <Alert severity="warning" icon={<WarningIcon />}>
          <AlertTitle>Stale Data - Facility Offline</AlertTitle>
          {warning}
          <br />
          <strong>Cannot place orders to this facility until it comes back online.</strong>
        </Alert>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Product</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Last Updated</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {inventory.map(item => (
            <TableRow key={item.product_id}>
              <TableCell>{item.product_id}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(item.last_updated))} ago
              </TableCell>
              <TableCell>
                {item.data_freshness.is_stale ? (
                  <Chip label="STALE" color="warning" size="small" />
                ) : (
                  <Chip label="LIVE" color="success" size="small" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Result for Philippines Worker:**

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Stale Data - Facility Offline                           │
│ facility-la-001 is OFFLINE. Data is cached from             │
│ 2025-12-10T14:30:00Z.                                       │
│ Cannot place orders to this facility until it comes back    │
│ online.                                                      │
└─────────────────────────────────────────────────────────────┘

Product              Quantity   Last Updated      Status
────────────────────────────────────────────────────────
Corrugated Box 12x9     1,247   2 hours ago       STALE
Bubble Wrap Roll         583    2 hours ago       STALE
Packing Tape             892    2 hours ago       STALE
```

---

## Proactive Monitoring & Multi-Channel Alerts

### "WE Tell THEM They're Down" (Not Other Way Around)

**Architecture:**

```
┌──────────────────────────────────────────────────────────┐
│         Edge Health Monitoring Service                   │
│  (Runs in Regional Cloud - Checks Every 30 Seconds)     │
└──────────────────────────────────────────────────────────┘
         │
         ├─ LA Edge Health Check (HTTP /health)
         ├─ Frankfurt Edge Health Check
         └─ Shanghai Edge Health Check
         │
    [Edge Timeout > 60 seconds]
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│              Alert Orchestration Service                 │
│   (PagerDuty / Twilio / Teams / Slack / Email)          │
└──────────────────────────────────────────────────────────┘
         │
         ├─ SMS to Facility IT Manager: "LA facility offline since 2:45 PM"
         ├─ Phone Call (Twilio): "AgogSaaS alert: LA facility down"
         ├─ Teams Message: "@channel LA facility offline - investigating"
         ├─ Slack: "#incidents LA facility health check failed"
         └─ Email: Facility IT team + Customer Success
```

### Implementation: Edge Health Monitoring Service

```typescript
// backend/src/services/edge-health-monitor.service.ts

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class EdgeHealthMonitorService {
  // Run every 30 seconds
  @Cron('*/30 * * * * *')
  async checkAllEdgeFacilities() {
    const facilities = await this.getFacilities();

    for (const facility of facilities) {
      const isHealthy = await this.checkFacilityHealth(facility);

      if (!isHealthy) {
        await this.handleFacilityOffline(facility);
      } else {
        await this.handleFacilityOnline(facility);
      }
    }
  }

  async checkFacilityHealth(facility: Facility): Promise<boolean> {
    try {
      const response = await axios.get(
        `http://${facility.edge_vpn_hostname}:4010/health`,
        { timeout: 5000 }  // 5-second timeout
      );

      return response.status === 200 && response.data.status === 'healthy';
    } catch (err) {
      console.error(`Facility ${facility.id} health check failed:`, err.message);
      return false;
    }
  }

  async handleFacilityOffline(facility: Facility) {
    // Check if already marked offline
    const status = await this.getFacilityStatus(facility.id);

    if (status.online) {
      // JUST went offline - trigger alerts
      await this.markFacilityOffline(facility.id);

      console.log(`🚨 FACILITY OFFLINE: ${facility.name} (${facility.id})`);

      // Send multi-channel alerts
      await this.sendAlerts(facility, {
        severity: 'critical',
        message: `${facility.name} is OFFLINE since ${new Date().toISOString()}`,
        actions: [
          'Check internet connectivity',
          'Verify edge computer powered on',
          'Check VPN tunnel status',
          'Contact AgogSaaS support if issue persists'
        ]
      });
    } else {
      // Already offline - check if we should escalate
      const offlineDuration = Date.now() - status.offline_since.getTime();
      const offlineMinutes = offlineDuration / 1000 / 60;

      if (offlineMinutes > 60 && !status.escalated) {
        // Offline for > 1 hour - escalate
        await this.escalateAlert(facility);
      }
    }
  }

  async handleFacilityOnline(facility: Facility) {
    const status = await this.getFacilityStatus(facility.id);

    if (!status.online) {
      // JUST came back online
      const offlineDuration = Date.now() - status.offline_since.getTime();
      const offlineMinutes = Math.floor(offlineDuration / 1000 / 60);

      await this.markFacilityOnline(facility.id);

      console.log(`✅ FACILITY ONLINE: ${facility.name} (was offline ${offlineMinutes} min)`);

      // Send recovery notification
      await this.sendRecoveryNotification(facility, offlineMinutes);
    }
  }

  async sendAlerts(facility: Facility, alert: Alert) {
    // Get notification preferences for facility
    const contacts = await this.getFacilityContacts(facility.id);

    // Send to multiple channels in parallel
    await Promise.all([
      this.sendSMS(contacts, alert),
      this.sendPhoneCall(contacts, alert),
      this.sendTeamsMessage(facility.teams_webhook, alert),
      this.sendSlackMessage(facility.slack_webhook, alert),
      this.sendEmail(contacts, alert),
      this.sendPagerDuty(facility, alert)
    ]);
  }

  async sendSMS(contacts: Contact[], alert: Alert) {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

    for (const contact of contacts.filter(c => c.sms_enabled)) {
      await twilio.messages.create({
        to: contact.phone,
        from: process.env.TWILIO_FROM_NUMBER,
        body: `🚨 AgogSaaS Alert\n\n${alert.message}\n\nActions:\n${alert.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
      });

      console.log(`📱 SMS sent to ${contact.name} (${contact.phone})`);
    }
  }

  async sendPhoneCall(contacts: Contact[], alert: Alert) {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

    // Only call primary contact (not everyone)
    const primary = contacts.find(c => c.is_primary && c.phone_call_enabled);

    if (primary) {
      await twilio.calls.create({
        to: primary.phone,
        from: process.env.TWILIO_FROM_NUMBER,
        url: `${process.env.API_URL}/twilio/voice/facility-offline?facility=${alert.facility_id}`
        // TwiML at this URL will say: "This is an AgogSaaS alert. LA facility is offline..."
      });

      console.log(`📞 Phone call to ${primary.name} (${primary.phone})`);
    }
  }

  async sendTeamsMessage(webhook: string, alert: Alert) {
    if (!webhook) return;

    await axios.post(webhook, {
      "@type": "MessageCard",
      "themeColor": "FF0000",
      "title": "🚨 Facility Offline Alert",
      "text": alert.message,
      "sections": [{
        "activityTitle": "Recommended Actions",
        "facts": alert.actions.map((action, i) => ({
          "name": `${i + 1}.`,
          "value": action
        }))
      }]
    });

    console.log(`💬 Teams message sent`);
  }

  async sendSlackMessage(webhook: string, alert: Alert) {
    if (!webhook) return;

    await axios.post(webhook, {
      "text": "🚨 *Facility Offline Alert*",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": alert.message
          }
        },
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "*Recommended Actions:*\n" + alert.actions.map((a, i) => `${i + 1}. ${a}`).join('\n')
          }
        }
      ]
    });

    console.log(`💬 Slack message sent`);
  }
}
```

---

## Cloud Fallback Mode (Disaster Workspace)

### "If LA Burns to the Ground, They Work from Cloud"

**Scenario:** LA facility destroyed (fire, flood, earthquake). Workers need to continue operations IMMEDIATELY.

**Solution:** Temporary cloud workspace mode.

### Activation Process

**Step 1: Facility Manager Activates Cloud Fallback**

```
┌──────────────────────────────────────────────────────────┐
│         🚨 DISASTER RECOVERY ACTIVATION                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Facility: LA (facility-la-001)                         │
│  Reason: [Fire - building destroyed]                    │
│  Expected Duration: [3-6 months rebuild]                │
│                                                          │
│  ✅ Enable Cloud Fallback Mode                          │
│     Workers access cloud directly (no edge)             │
│                                                          │
│  ✅ Provision Temporary Workstations                    │
│     Remote access from home/temporary office            │
│                                                          │
│  ✅ Restore Latest Edge Data to Cloud                   │
│     Last sync: 2 hours ago (minimal data loss)          │
│                                                          │
│  [Cancel]  [ACTIVATE CLOUD FALLBACK]                    │
└──────────────────────────────────────────────────────────┘
```

**Step 2: System Provisions Cloud Workspace**

```typescript
// backend/src/services/cloud-fallback.service.ts

export class CloudFallbackService {
  async activateCloudFallback(facilityId: string, reason: string) {
    console.log(`🚨 Activating cloud fallback for ${facilityId}: ${reason}`);

    // 1. Mark facility as "disaster mode"
    await this.db.query(`
      UPDATE facilities
      SET
        mode = 'cloud_fallback',
        fallback_reason = $2,
        fallback_activated_at = NOW()
      WHERE id = $1
    `, [facilityId, reason]);

    // 2. Restore latest edge data to cloud
    // (Edge was syncing every 5 seconds, so cloud already has ~99% of data)
    const edgeBackup = await this.getLatestEdgeBackup(facilityId);
    console.log(`📦 Latest edge backup: ${edgeBackup.timestamp} (${edgeBackup.transactions} transactions)`);

    // 3. Create temporary cloud workspace
    await this.provisionCloudWorkspace(facilityId);

    // 4. Notify all workers
    await this.notifyWorkers(facilityId, {
      message: `LA facility is in disaster recovery mode. Access the system at: https://cloud.agog.com/workspace/${facilityId}`,
      instructions: [
        'Use your normal login credentials',
        'All data is current as of 2 hours ago',
        'New orders will be saved to cloud',
        'When facility rebuilds, data will sync back to new edge'
      ]
    });

    console.log(`✅ Cloud fallback activated for ${facilityId}`);
  }

  async provisionCloudWorkspace(facilityId: string) {
    // Create isolated cloud workspace for this facility
    // Think of it as "edge database running in cloud temporarily"

    await this.db.query(`
      -- Create workspace schema
      CREATE SCHEMA IF NOT EXISTS workspace_${facilityId.replace(/-/g, '_')};

      -- Copy facility data to workspace
      INSERT INTO workspace_${facilityId.replace(/-/g, '_')}.orders
      SELECT * FROM orders WHERE facility_id = $1;

      INSERT INTO workspace_${facilityId.replace(/-/g, '_')}.inventory
      SELECT * FROM inventory WHERE facility_id = $1;

      -- Workers access workspace schema (isolated from other facilities)
    `, [facilityId]);
  }
}
```

**Step 3: Workers Access Cloud Workspace**

```
Philippines Worker Login:
  Normal: https://app.agog.com → US-EAST cloud (as usual)

LA Worker Login (During Disaster):
  Disaster Mode: https://cloud.agog.com/workspace/facility-la-001
  → Isolated cloud workspace (acts like temporary edge)
  → All operations work normally
  → Data saved to cloud (no edge to sync to)
```

**Step 4: Rebuild Facility & Restore**

When new facility ready (3-6 months later):

```typescript
async restoreFacilityFromCloud(facilityId: string, newEdgeConfig: EdgeConfig) {
  console.log(`🔧 Restoring ${facilityId} from cloud workspace`);

  // 1. Provision new edge computer
  await this.provisionEdge(facilityId, newEdgeConfig);

  // 2. Sync workspace data to new edge
  await this.syncCloudToEdge(facilityId);

  // 3. Switch mode from cloud_fallback → normal
  await this.db.query(`
    UPDATE facilities
    SET mode = 'normal'
    WHERE id = $1
  `, [facilityId]);

  // 4. Notify workers
  await this.notifyWorkers(facilityId, {
    message: 'LA facility restored! Edge computer online.',
    instructions: [
      'Access system at normal URL: https://app.agog.com',
      'All cloud workspace data has been synced to new edge',
      'Operations resume as normal'
    ]
  });
}
```

---

## Automated Edge Provisioning (Self-Service)

### Customer Self-Service Form

```html
<!DOCTYPE html>
<html>
<head>
  <title>Edge Computer Provisioning - AgogSaaS</title>
</head>
<body>
  <h1>🖥️ Request New Edge Computer</h1>

  <form action="/api/edge/provision" method="POST">
    <h2>Facility Information</h2>
    <label>Facility Name: <input name="facility_name" required /></label><br>
    <label>Facility Address: <textarea name="facility_address" required></textarea></label><br>
    <label>Shipping Address (if different): <textarea name="shipping_address"></textarea></label><br>

    <h2>Network Configuration</h2>
    <label>Public IP Address: <input name="public_ip" placeholder="203.0.113.45" /></label><br>
    <label>Subnet Mask: <input name="subnet_mask" value="255.255.255.0" /></label><br>
    <label>Gateway: <input name="gateway" placeholder="203.0.113.1" /></label><br>
    <label>DNS Servers: <input name="dns_servers" placeholder="8.8.8.8, 8.8.4.4" /></label><br>

    <h2>VPN Configuration</h2>
    <label>
      VPN Type:
      <select name="vpn_type" required>
        <option value="wireguard">WireGuard (Recommended)</option>
        <option value="ipsec">IPsec</option>
        <option value="openvpn">OpenVPN</option>
      </select>
    </label><br>
    <label>VPN Endpoint: <input name="vpn_endpoint" placeholder="vpn.customer-corp.com" /></label><br>

    <h2>Hardware Selection</h2>
    <label>
      Edge Computer Size:
      <select name="hardware_size" required>
        <option value="small">Small (Raspberry Pi 4) - $600</option>
        <option value="medium">Medium (Intel NUC) - $1,200 (Recommended)</option>
        <option value="large">Large (Server) - $3,000</option>
      </select>
    </label><br>

    <h2>IT Contact</h2>
    <label>IT Manager Name: <input name="it_contact_name" required /></label><br>
    <label>IT Manager Email: <input name="it_contact_email" type="email" required /></label><br>
    <label>IT Manager Phone: <input name="it_contact_phone" type="tel" required /></label><br>

    <button type="submit">🚀 Provision Edge Computer</button>
  </form>
</body>
</html>
```

### Automated Provisioning Workflow

```typescript
// backend/src/services/edge-provisioning.service.ts

export class EdgeProvisioningService {
  async provisionNewEdge(config: EdgeProvisionRequest) {
    console.log(`🖥️ Provisioning new edge: ${config.facility_name}`);

    // 1. Generate edge configuration
    const edgeId = `facility-${slugify(config.facility_name)}-${Date.now()}`;
    const edgeConfig = await this.generateEdgeConfig(edgeId, config);

    // 2. Order hardware (automatic)
    await this.orderHardware(config.hardware_size, config.shipping_address);
    console.log(`📦 Hardware ordered: ${config.hardware_size} to ${config.shipping_address}`);

    // 3. Pre-configure edge image
    const imageUrl = await this.buildEdgeImage(edgeConfig);
    console.log(`💿 Edge image built: ${imageUrl}`);

    // 4. Email IT contact with setup instructions
    await this.sendSetupInstructions(config.it_contact_email, {
      edgeId,
      imageUrl,
      vpnConfig: edgeConfig.vpn,
      networkConfig: edgeConfig.network
    });

    // 5. Monitor for first connection
    this.monitorEdgeActivation(edgeId);

    return { edgeId, estimatedDelivery: '3-5 business days' };
  }

  async buildEdgeImage(config: EdgeConfig): Promise<string> {
    // Build custom Ubuntu image with:
    // - Docker + docker-compose
    // - PostgreSQL 16 + pgvector
    // - AgogSaaS edge agent (pre-configured)
    // - VPN client (pre-configured)
    // - Auto-sync scripts

    const dockerfile = `
FROM ubuntu:22.04

# Install PostgreSQL 16
RUN apt-get update && apt-get install -y postgresql-16 postgresql-16-pgvector

# Install Docker
RUN curl -fsSL https://get.docker.com | sh

# Copy edge agent
COPY edge-agent /usr/local/bin/edge-agent
COPY edge-config.json /etc/agog/edge-config.json

# Copy VPN config
COPY vpn/${config.vpn.type} /etc/vpn/

# Auto-start script
COPY start-edge.sh /usr/local/bin/start-edge.sh
RUN chmod +x /usr/local/bin/start-edge.sh

CMD ["/usr/local/bin/start-edge.sh"]
    `;

    // Build image, upload to S3
    const imageUrl = await this.buildAndUploadImage(dockerfile, config.edgeId);

    return imageUrl;
  }

  async sendSetupInstructions(email: string, setup: EdgeSetup) {
    await this.emailService.send({
      to: email,
      subject: 'AgogSaaS Edge Computer Setup Instructions',
      html: `
        <h1>Your Edge Computer is Ready!</h1>

        <p><strong>Edge ID:</strong> ${setup.edgeId}</p>

        <h2>Setup Steps:</h2>
        <ol>
          <li>
            <strong>Download Edge Image:</strong><br>
            <a href="${setup.imageUrl}">Click here to download</a> (Ubuntu 22.04 with AgogSaaS pre-installed)
          </li>
          <li>
            <strong>Flash to USB Drive:</strong><br>
            Use <a href="https://etcher.io">Balena Etcher</a> to write image to USB drive
          </li>
          <li>
            <strong>Install on Edge Computer:</strong><br>
            Boot from USB, follow installation wizard (5 minutes)
          </li>
          <li>
            <strong>Connect to Network:</strong><br>
            Ethernet cable to your facility network<br>
            Static IP: ${setup.networkConfig.static_ip} (or DHCP if preferred)
          </li>
          <li>
            <strong>Automatic Configuration:</strong><br>
            Edge will auto-connect to VPN: ${setup.vpnConfig.endpoint}<br>
            First sync starts automatically (10-15 minutes)
          </li>
        </ol>

        <h2>Monitoring Dashboard:</h2>
        <p>Track setup progress: <a href="https://app.agog.com/edge/${setup.edgeId}/setup">Edge Setup Dashboard</a></p>

        <p>Questions? Reply to this email or call support: 1-800-AGOG-HELP</p>
      `
    });
  }
}
```

---

## References

- [ADR 003: 3-Tier Database](../project-spirit/adr/003-3-tier-database-offline-resilience.md)
- [ADR 004: Disaster Recovery Plan](../project-spirit/adr/004-disaster-recovery-plan.md)
- [Conflict Resolution Strategy](./CONFLICT_RESOLUTION_STRATEGY.md)
- [PostgreSQL Logical Replication Docs](https://www.postgresql.org/docs/current/logical-replication.html)

---

[⬆ Back to top](#postgresql-replication-strategy---multi-directional-sync) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
