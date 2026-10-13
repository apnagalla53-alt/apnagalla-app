import { Controller, Post, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceQuery } from './interfaces';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';

@Controller('intelligence')
@UseGuards(AuthGuard, SubscriptionGuard)
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Post('ask')
  async ask(@Body() query: IntelligenceQuery, @Req() request: any) {
    const user = request.user;
    if(!user)throw new UnauthorizedException('A shop session is required');
    const context = {
      // Legacy handlers call this field organizationId but scope their rows by company_id.
      organizationId: user.company_id,
      branchId: user.branch_id,
      userId: user.id
    };

    return this.intelligenceService.ask(query, context);
  }
}
