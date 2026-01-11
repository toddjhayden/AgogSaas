import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SagaOrchestratorService } from './services/saga-orchestrator.service';
import { DemandToCashSagaService } from './services/demand-to-cash-saga.service';
import { SagaResolver } from '../../graphql/resolvers/saga.resolver';

// Import finance services needed for saga execution
import { InvoiceService } from '../finance/services/invoice.service';
import { PaymentService } from '../finance/services/payment.service';
import { JournalEntryService } from '../finance/services/journal-entry.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    SagaOrchestratorService,
    DemandToCashSagaService,
    SagaResolver,
    // Finance services
    InvoiceService,
    PaymentService,
    JournalEntryService,
  ],
  exports: [SagaOrchestratorService, DemandToCashSagaService],
})
export class SagaModule {}
