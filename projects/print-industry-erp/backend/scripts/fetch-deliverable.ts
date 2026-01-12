#!/usr/bin/env ts-node
import { NATSDeliverableService } from '../src/nats/nats-deliverable.service';
import dotenv from 'dotenv';

dotenv.config();

async function fetchDeliverable() {
  const [agent, taskType, reqNumber] = process.argv.slice(2);

  if (!agent || !taskType || !reqNumber) {
    console.error('Usage: ts-node fetch-deliverable.ts <agent> <taskType> <reqNumber>');
    process.exit(1);
  }

  const natsService = new NATSDeliverableService();

  try {
    await natsService.initialize();

    const report = await natsService.fetchReport({
      agent: agent as any,
      taskType: taskType as any,
      featureName: reqNumber,
    });

    if (!report) {
      console.error('No report found');
      process.exit(1);
    }

    console.log(report.content);

    await natsService.close();
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    await natsService.close();
    process.exit(1);
  }
}

fetchDeliverable();
