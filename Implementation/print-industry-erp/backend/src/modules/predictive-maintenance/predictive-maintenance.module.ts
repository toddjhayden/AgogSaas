/**
 * Predictive Maintenance Module
 * REQ: REQ-STRATEGIC-AUTO-1767108044310
 *
 * NestJS module for Predictive Maintenance AI for Press Equipment
 */

import { Module } from '@nestjs/common';
import { EquipmentHealthScoreService } from './services/equipment-health-score.service';
import { PredictiveAlertService } from './services/predictive-alert.service';
import { ModelManagementService } from './services/model-management.service';
import { MaintenanceRecommendationService } from './services/maintenance-recommendation.service';
import { PredictiveMaintenanceResolver } from '../../graphql/resolvers/predictive-maintenance.resolver';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    EquipmentHealthScoreService,
    PredictiveAlertService,
    ModelManagementService,
    MaintenanceRecommendationService,
    PredictiveMaintenanceResolver,
  ],
  exports: [
    EquipmentHealthScoreService,
    PredictiveAlertService,
    ModelManagementService,
    MaintenanceRecommendationService,
  ],
})
export class PredictiveMaintenanceModule {}
