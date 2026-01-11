import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowResolver } from '../../graphql/resolvers/workflow.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [WorkflowEngineService, WorkflowResolver],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}
