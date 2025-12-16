# Conflict Resolution Strategy: Edge-Priority with Forward-Only Changes

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Conflict Resolution Strategy

## Overview

AgogSaaS uses **Edge-Priority Conflict Resolution** to handle data conflicts when edge computers go offline and reconnect. This strategy ensures manufacturing facilities can continue operations during internet outages while maintaining data consistency when connectivity returns.

## Core Principle: Edge Wins

**Rule:** When an edge computer reconnects after being offline, **edge data takes priority over cloud changes** for the same records.

**Rationale:**
- Local workers at the facility have physical context (machines running, materials on hand, orders in production)
- Remote workers (cloud) lack this physical awareness
- Physical reality is the source of truth

---

## How It Works

### Scenario: Internet Outage at LA Facility

**Timeline:**

| Time | Event | LA Edge (Offline) | Cloud (Online) | Philippines Worker (Remote, Cloud) |
|------|-------|-------------------|----------------|-----------------------------------|
| 9:00 AM | Internet down | Can still work | Stale data | Can see data, **BLOCKED from editing** |
| 9:30 AM | LA worker edits Order #12345 | Status: "In Production" | Status: "Pending" (old) | Sees "Pending" (stale), editing disabled |
| 10:15 AM | Internet restored | Syncs changes to cloud | Receives edge updates | - |
| 10:16 AM | Sync complete | - | Status: "In Production" (from edge) | Now sees "In Production", can edit again |
| 10:30 AM | Philippines worker needs change | - | - | Creates forward change (new event) |

### Key Behaviors

1. **During Outage:**
   - **Edge:** Continues normal operations, buffers changes locally
   - **Cloud:** Shows last known state, marks data as "stale" (edge offline)
   - **Remote Workers:** **BLOCKED** from editing edge-owned records (read-only mode)

2. **On Reconnection:**
   - **Edge → Cloud:** Edge changes sync immediately, overwrite cloud state
   - **Cloud → Edge:** Cloud DOES NOT send changes made during outage (edge priority)
   - **Remote Workers:** Can now see fresh data, editing re-enabled

3. **After Sync:**
   - All users (edge + cloud) see consistent state (edge version)
   - Remote workers can make new changes (forward only)

---

## Rollback Strategy: Forward Changes, Not Reversions

### Problem: Traditional Rollback Breaks Edge-Priority

❌ **BAD:** Philippines worker hits "Undo" button → reverts Order #12345 to old state

**Why bad?** LA facility already has materials allocated, machine running, labels printed. Physical reality contradicts system.

### Solution: Forward Changes That Feel Like Rollback

✅ **GOOD:** Philippines worker creates **NEW change** that achieves desired outcome

**Example:**

```
Original State (Before LA Edit):
  Order #12345
  Status: Pending
  Due Date: 2025-12-15
  Priority: Normal

LA Offline Edit (9:30 AM):
  Order #12345
  Status: In Production  ← Changed
  Priority: High         ← Changed
  (Event ID: evt-001, Timestamp: 2025-12-10T09:30:00Z)

Philippines "Rollback" (10:30 AM):
  Order #12345
  Status: In Production  ← Keep (can't undo physical work)
  Priority: Normal       ← NEW CHANGE (forward event)
  (Event ID: evt-002, Timestamp: 2025-12-10T10:30:00Z, Reason: "Priority correction")
```

**Result for Philippines User:**
- UI shows: "Priority changed: High → Normal ✓"
- Feels like rollback, but it's a NEW forward event
- LA gets notification: "Order #12345 priority updated by Maria (Philippines)"

**Result for LA User:**
- Notification pops up: "Order #12345 priority changed to Normal by Maria"
- Can accept change or discuss with Maria
- Physical work continues (Status stays "In Production")

---

## Technical Implementation

### 1. Stale Data Detection

**Backend (Cloud):**

```typescript
// Check if edge is online
const edgeStatus = await checkEdgeHealth('facility-la-001');

if (!edgeStatus.online) {
  // Mark records as stale
  return {
    order: orderData,
    metadata: {
      stale: true,
      lastSync: edgeStatus.lastSeen, // "2025-12-10T09:00:00Z"
      edgeFacility: 'LA',
      readOnly: true  // Block editing
    }
  };
}
```

**Frontend (React):**

```tsx
{order.metadata.stale && (
  <Alert severity="warning">
    <strong>Stale Data:</strong> LA facility offline since {formatTime(order.metadata.lastSync)}.
    Data may be outdated. Editing disabled until facility reconnects.
  </Alert>
)}

<Button
  disabled={order.metadata.readOnly}
  onClick={handleEdit}
>
  Edit Order
</Button>
```

### 2. Edge Priority Sync

**Edge Replication Agent:**

```typescript
// When internet reconnects
async function syncToCloud() {
  const bufferedChanges = await getBufferedChanges(); // Changes made offline

  for (const change of bufferedChanges) {
    // Send to cloud with EDGE_PRIORITY flag
    await cloudAPI.applyChange({
      ...change,
      source: 'edge',
      facilityId: 'facility-la-001',
      priority: 'EDGE_OVERWRITE',  // Cloud must accept
      offlineBuffer: true
    });
  }

  console.log(`Synced ${bufferedChanges.length} offline changes to cloud`);
}
```

**Cloud API (Conflict Handler):**

```typescript
// Receive change from edge
async function applyChange(change: Change) {
  if (change.priority === 'EDGE_OVERWRITE') {
    // Edge wins - overwrite cloud version
    await db.query(`
      UPDATE orders
      SET
        status = $1,
        priority = $2,
        updated_at = $3,
        updated_by_edge = true
      WHERE id = $4
    `, [change.status, change.priority, change.timestamp, change.orderId]);

    // Notify cloud users of change
    await notifyUsers({
      message: `Order ${change.orderId} updated by ${change.facilityName} (was offline)`,
      type: 'edge-sync',
      affectedUsers: await getWatchingUsers(change.orderId)
    });
  }
}
```

### 3. Forward-Only "Rollback"

**Frontend (React):**

```tsx
function RollbackButton({ order, field, oldValue, newValue }) {
  const [reason, setReason] = useState('');

  const handleRollback = async () => {
    // Create NEW change event (not a reversion)
    await createChange({
      orderId: order.id,
      field: field,
      newValue: oldValue,  // Looks like rollback
      previousValue: newValue,
      eventType: 'FORWARD_CORRECTION',  // Not a revert
      reason: reason,
      userId: currentUser.id,
      timestamp: new Date().toISOString()
    });

    // Notify edge users
    await notifyFacility(order.facilityId, {
      message: `${currentUser.name} changed ${field}: ${newValue} → ${oldValue}`,
      reason: reason,
      orderId: order.id
    });
  };

  return (
    <>
      <Button onClick={() => setShowDialog(true)}>
        Revert {field} to {oldValue}
      </Button>

      <Dialog open={showDialog}>
        <DialogTitle>Create Correction</DialogTitle>
        <DialogContent>
          <Alert severity="info">
            This creates a <strong>new change</strong> (not a rollback).
            LA facility will be notified.
          </Alert>

          <TextField
            label="Reason for change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <Typography variant="caption">
            {field}: {newValue} → {oldValue}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRollback} disabled={!reason}>
            Create Change
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
```

---

## Edge Cases & Special Scenarios

### 1. Multiple Facilities Editing Same Record

**Scenario:** LA offline, Frankfurt online, both edit Order #12345

**Resolution:**
- Last-write-wins WITHIN each facility
- Edge-priority for edge vs cloud conflict
- If BOTH facilities offline and edit: timestamp + facility priority (configurable)

**Example:**

```
09:00 - LA goes offline
09:15 - Frankfurt (online) edits Order #12345: Priority = High
09:30 - LA (offline) edits Order #12345: Priority = Urgent
10:00 - LA reconnects

Result: LA wins (edge priority) → Priority = Urgent
Frankfurt gets notification: "Order #12345 updated by LA facility"
```

### 2. Cloud User Starts Edit, Edge Reconnects Mid-Edit

**Scenario:** Philippines worker opens edit form at 9:00 AM, LA reconnects at 9:05 AM, Philippines saves at 9:10 AM

**Resolution:**
- When Philippines clicks "Save", backend detects record changed since form opened
- Show conflict dialog: "LA facility updated this order while you were editing. Review changes?"
- Philippines can:
  - **Accept LA changes** (discard their edits)
  - **Create new change** (forward correction on top of LA version)

**UI:**

```tsx
<Dialog>
  <DialogTitle>Conflict Detected</DialogTitle>
  <DialogContent>
    <Alert severity="warning">
      LA facility updated this order at 9:05 AM while you were editing.
    </Alert>

    <Typography variant="h6">Your Changes:</Typography>
    <DiffView changes={yourChanges} />

    <Typography variant="h6">LA Facility Changes:</Typography>
    <DiffView changes={edgeChanges} />
  </DialogContent>
  <DialogActions>
    <Button onClick={discardMyChanges}>Accept LA Version</Button>
    <Button onClick={createForwardChange} color="primary">
      Apply My Changes On Top
    </Button>
  </DialogActions>
</Dialog>
```

### 3. Edge Offline for Extended Period (Days)

**Scenario:** LA offline Friday 5 PM → Monday 9 AM (weekend internet outage)

**Resolution:**
- Edge buffers all weekend changes (Friday 5 PM - Monday 9 AM)
- Cloud users see "Last sync: Friday 5:00 PM" warning
- Cloud users BLOCKED from editing LA-owned records
- Monday 9 AM: Edge syncs 100+ buffered changes in order
- Cloud users get batch notification: "LA facility back online. 127 changes synced."

**Performance Optimization:**

```typescript
// Batch sync instead of 127 individual API calls
async function syncBatch(changes: Change[]) {
  // Group by entity
  const grouped = groupBy(changes, 'entityId');

  // Send as batch
  await cloudAPI.applyBatch({
    facilityId: 'facility-la-001',
    changes: grouped,
    offlineDuration: '3 days 16 hours',
    changeCount: changes.length
  });
}
```

---

## Monitoring & Alerts

### Edge Health Dashboard

**Real-Time Status:**

```
┌─────────────────────────────────────────────────────────┐
│ Edge Facility Health                                    │
├─────────────────────────────────────────────────────────┤
│ LA Facility         ● ONLINE    Last sync: 2 sec ago   │
│ Frankfurt Facility  ● ONLINE    Last sync: 1 sec ago   │
│ Shanghai Facility   ● OFFLINE   Last sync: 15 min ago  │
│   └─ Buffered changes: 23                               │
│   └─ Remote users blocked: 2                            │
└─────────────────────────────────────────────────────────┘
```

### Conflict Resolution Metrics

**Grafana Dashboard:**

- **Edge reconnection events:** Count per day
- **Buffered changes synced:** Avg per reconnection
- **Blocked remote users:** Count when edge offline
- **Forward corrections created:** Count (Philippines "rollbacks")
- **Sync latency:** Time from edge reconnect to cloud consistent

---

## Testing Strategy

### Unit Tests

```typescript
describe('Edge Priority Conflict Resolution', () => {
  it('should block cloud edits when edge offline', async () => {
    await markEdgeOffline('facility-la-001');

    const result = await cloudAPI.updateOrder({
      orderId: 'order-12345',
      facilityId: 'facility-la-001',
      status: 'Cancelled'
    });

    expect(result.error).toBe('EDGE_OFFLINE_READ_ONLY');
  });

  it('should apply edge changes on reconnect', async () => {
    const edgeChanges = [
      { orderId: 'order-12345', status: 'In Production', timestamp: '9:30 AM' }
    ];

    await edgeAPI.sync(edgeChanges);

    const order = await cloudDB.getOrder('order-12345');
    expect(order.status).toBe('In Production'); // Edge wins
  });

  it('should create forward change not rollback', async () => {
    await cloudAPI.rollback({
      orderId: 'order-12345',
      field: 'priority',
      oldValue: 'Normal',
      newValue: 'High',
      reason: 'Incorrect priority'
    });

    const events = await cloudDB.getOrderEvents('order-12345');
    expect(events[events.length - 1].type).toBe('FORWARD_CORRECTION');
    expect(events[events.length - 1].type).not.toBe('REVERT');
  });
});
```

### Integration Tests

```bash
# Simulate edge offline
./tests/integration/test-edge-offline.sh

# Expected:
# 1. Edge continues working
# 2. Cloud shows "stale data" warning
# 3. Cloud users cannot edit
# 4. Edge reconnects
# 5. Edge changes sync
# 6. Cloud users can edit again
```

### DR Drill: Internet Outage

**Monthly Test:**

```bash
# 1. Disconnect LA edge from internet
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  sh -c "iptables -A OUTPUT -d backend-blue -j DROP && iptables -A OUTPUT -d backend-green -j DROP"

# 2. Create 10 orders at LA edge
for i in {1..10}; do
  curl http://localhost:4010/graphql \
    -d "{\"query\":\"mutation { createOrder(input: {customer: \\\"Offline Test $i\\\"}) { id } }\"}"
done

# 3. Verify cloud shows "offline" warning
curl http://localhost/api/facilities/facility-la-001/status
# Expected: { "online": false, "lastSync": "...", "bufferedChanges": 10 }

# 4. Reconnect internet
docker-compose -f docker-compose.blue-green.yml exec edge-api-la \
  sh -c "iptables -F OUTPUT"

# 5. Verify changes sync
sleep 10
curl http://localhost/api/orders?facility=facility-la-001 | jq '.[] | select(.customer | contains("Offline Test"))'
# Expected: 10 orders from edge
```

---

## User Experience

### For Edge Workers (LA Facility)

**Normal Day:**
- Edit orders, update inventory, run production
- Changes sync to cloud instantly (1-5 second lag)
- No awareness of "edge priority" (transparent)

**Internet Outage:**
- Yellow banner: "Cloud connection lost. Working offline. Changes will sync when internet returns."
- Everything works normally (no blocked features)
- When internet returns: "Syncing 47 changes... ✓ Done"

### For Remote Workers (Philippines)

**Normal Day:**
- View LA facility orders
- Edit as needed
- Changes sync to LA instantly

**LA Offline:**
- Red banner: "LA facility offline since 9:00 AM. Data may be outdated."
- Can view, cannot edit
- "Edit" button disabled with tooltip: "Cannot edit while facility offline"

**LA Reconnects:**
- Green notification: "LA facility back online. 47 changes synced."
- Data refreshes automatically
- "Edit" button enabled

### For Executives (CEO Dashboard)

**Global View:**

```
┌──────────────────────────────────────────────────────┐
│ Real-Time Production Status                          │
├──────────────────────────────────────────────────────┤
│ LA Facility      ● 23 orders in production  (Online) │
│ Frankfurt        ● 18 orders in production  (Online) │
│ Shanghai         ⚠ 12 orders (OFFLINE 15 min)       │
│                                                       │
│ Note: Shanghai data is 15 minutes stale              │
└──────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [ADR 003: 3-Tier Database Architecture](../project-spirit/adr/003-3-tier-database-offline-resilience.md)
- [Architecture: 3-Tier Database](./ARCHITECTURE_3_TIER_DATABASE.md)
- [Blue-Green Deployment Guide](../README_BLUE_GREEN_DEPLOYMENT.md)
- [Disaster Recovery Plan](../project-spirit/adr/004-disaster-recovery-plan.md) (coming soon)

---

[⬆ Back to top](#conflict-resolution-strategy-edge-priority-with-forward-only-changes) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
