/**
 * Smoke Test Module
 * Automated smoke tests for critical system workflows
 * REQ: REQ-STRATEGIC-AUTO-1767045901874 - Deployment Health Verification & Smoke Tests
 */

import { Module } from '@nestjs/common';
import { SmokeTestService } from './smoke-test.service';
import { SmokeTestResolver } from './smoke-test.resolver';

// Import feature modules needed for testing
import { WmsModule } from '../modules/wms/wms.module';
import { ForecastingModule } from '../modules/forecasting/forecasting.module';
import { SalesModule } from '../modules/sales/sales.module';
import { ProcurementModule } from '../modules/procurement/procurement.module';

@Module({
  imports: [
    WmsModule,
    ForecastingModule,
    SalesModule,
    ProcurementModule,
  ],
  providers: [SmokeTestService, SmokeTestResolver],
  exports: [SmokeTestService],
})
export class SmokeTestModule {}
