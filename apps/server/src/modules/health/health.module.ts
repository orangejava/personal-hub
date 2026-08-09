import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { InfrastructureHealthIndicator } from './health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [InfrastructureHealthIndicator],
})
export class HealthModule {}
