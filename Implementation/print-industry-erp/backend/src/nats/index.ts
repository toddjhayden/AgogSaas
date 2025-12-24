/**
 * NATS Module Exports
 * Layer 3: Orchestration - Agent Deliverable Communication
 */

export { NATSClient, AgentCompletionNotice, NATSPublishOptions, NATSSubscribeOptions } from './nats-client.service';
export {
  NATSDeliverableService,
  PublishReportOptions,
  FetchReportOptions,
  AgentReport,
} from './nats-deliverable.service';
