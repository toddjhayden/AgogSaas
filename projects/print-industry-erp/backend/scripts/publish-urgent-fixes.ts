import { connect } from 'nats';

async function publishRequirements() {
  const natsPassword = process.env.NATS_PASSWORD;
  if (!natsPassword) {
    throw new Error('NATS_PASSWORD environment variable is required');
  }
  const nc = await connect({
    servers: 'nats://localhost:4223',
    user: process.env.NATS_USER || 'agents',
    pass: natsPassword
  });

  const timestamp = new Date().toISOString();
  const now = Date.now();

  const requirements = [
    {
      reqId: 'REQ-DATABASE-WMS-' + now,
      timestamp,
      title: 'Fix Missing WMS Database Tables',
      priority: 'P0',
      status: 'PENDING',
      category: 'DATABASE_SCHEMA',
      assignedTo: 'AUTO',
      description: 'WMS pages failing: inventory_locations table missing. Fix migrations V0.0.4-V0.0.35'
    },
    {
      reqId: 'REQ-PO-COLUMN-' + (now + 1),
      timestamp,
      title: 'Fix Purchase Order Column Mismatch',
      priority: 'P1',
      status: 'PENDING',
      category: 'GRAPHQL',
      assignedTo: 'AUTO',
      description: 'Change purchase_order_date to po_date in GraphQL schema/resolvers'
    },
    {
      reqId: 'REQ-I18N-CHINESE-' + (now + 2),
      timestamp,
      title: 'Complete Chinese Translations KPIs',
      priority: 'P2',
      status: 'PENDING',
      category: 'I18N',
      assignedTo: 'AUTO',
      description: 'KPIs page mixed English/Chinese. Complete zh-CN.json translations'
    },
    {
      reqId: 'REQ-TENANT-CTX-' + (now + 3),
      timestamp,
      title: 'Add Tenant Context to WMS',
      priority: 'P1',
      status: 'PENDING',
      category: 'GRAPHQL',
      assignedTo: 'AUTO',
      description: 'WMS needs tenant_id in GraphQL context. Fix JWT middleware'
    }
  ];

  for (const req of requirements) {
    await nc.publish('agog.recommendations.strategic', JSON.stringify(req));
    console.log('Published: ' + req.reqId);
  }

  await nc.close();
}

publishRequirements().catch(console.error);
