import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService } from './intelligence.service';
import { IntentResolverService } from './intent-resolver.service';

@Module({
  controllers: [IntelligenceController],
  providers: [IntelligenceService, IntentResolverService],
  exports: [IntelligenceService]
})
export class IntelligenceModule {}
