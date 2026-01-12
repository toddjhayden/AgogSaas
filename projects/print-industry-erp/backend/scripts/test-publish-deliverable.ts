import { connect, StringCodec } from 'nats';

(async () => {
  try {
    const nc = await connect({ servers: 'nats://localhost:4223' });
    const js = nc.jetstream();
    const sc = StringCodec();

    const deliverable = {
      agent: 'cynthia',
      req_number: 'REQ-ITEM-MASTER-001',
      status: 'COMPLETE',
      deliverable: 'nats://agog.features.research.REQ-ITEM-MASTER-001',
      summary: 'Manual test - verifying deliverable receipt'
    };

    console.log('Publishing deliverable to agog.features.research.REQ-ITEM-MASTER-001...');
    const ack = await js.publish('agog.features.research.REQ-ITEM-MASTER-001', sc.encode(JSON.stringify(deliverable)));
    console.log('✅ Published test deliverable, seq:', ack.seq);

    await nc.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
