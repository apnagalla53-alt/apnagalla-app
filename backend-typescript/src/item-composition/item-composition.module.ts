import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ItemCompositionService } from './item-composition.service';
import { ItemCompositionController } from './item-composition.controller';
import { EntitlementService } from '../common/entitlement.service';

@Module({ imports: [PrismaModule, InventoryModule], controllers: [ItemCompositionController], providers: [ItemCompositionService, EntitlementService], exports: [ItemCompositionService] })
export class ItemCompositionModule {}
