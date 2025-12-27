/**
 * Quality Module
 *
 * Handles cross-functional operations including:
 * - Quality management with ISO standards and CAPA
 * - HR/Labor tracking with timecards and approvals
 * - IoT sensor data and equipment events
 * - 5-tier security with chain of custody
 * - Print buyer boards marketplace
 * - Imposition layout calculation engine
 *
 * Related Resolver:
 * - FinalModulesResolver (quality-hr-iot-security-marketplace-imposition)
 */

import { Module } from '@nestjs/common';
import { FinalModulesResolver } from '../../graphql/resolvers/quality-hr-iot-security-marketplace-imposition.resolver';

@Module({
  providers: [FinalModulesResolver],
  exports: [],
})
export class QualityModule {}
