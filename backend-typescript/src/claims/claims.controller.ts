import { Controller, Get, Post, Body, Param, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { FeatureGuard, RequireFeature } from '../common/guards/feature.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('api/v1/claims')
@UseGuards(AuthGuard, SubscriptionGuard, FeatureGuard, PermissionGuard)
@RequireFeature('RETURNS_CLAIMS') // Ensure the feature exists or bypass if not strictly enforced. Actually we can use 'INVENTORY' or standard.
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  // --- Return Reasons ---

  @Post('reasons')
  createReturnReason(@Request() req: any, @Body() data: any) {
    return this.claimsService.createReturnReason(req.user.company_id, data);
  }

  @Get('reasons')
  getReturnReasons(@Request() req: any) {
    return this.claimsService.getReturnReasons(req.user.company_id);
  }

  // --- Claims ---

  @Post()
  createClaim(@Request() req: any, @Body() data: any) {
    return this.claimsService.createClaim(req.user.company_id, req.user.id, data);
  }

  @Get()
  getClaims(@Request() req: any, @Query() filters: any) {
    return this.claimsService.getClaims(req.user.company_id, filters);
  }

  @Get(':id')
  getClaimById(@Request() req: any, @Param('id') id: string) {
    return this.claimsService.getClaimById(req.user.company_id, id);
  }

  @Patch(':id/status')
  updateClaimStatus(@Request() req: any, @Param('id') id: string, @Body() data: { status: string; notes?: string }) {
    return this.claimsService.updateClaimStatus(req.user.company_id, id, req.user.id, data.status, data.notes);
  }
}
