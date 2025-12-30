import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowResolver } from '../../graphql/resolvers/workflow.resolver';

@Module({
  providers: [WorkflowEngineService, WorkflowResolver],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}
