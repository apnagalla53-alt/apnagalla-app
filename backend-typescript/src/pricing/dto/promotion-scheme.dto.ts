import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString, IsUUID, Min } from 'class-validator';

export class CreatePromotionSchemeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  scheme_type: string; // 'BUY_X_GET_Y' | 'FREE_QUANTITY' | 'ITEM_DISCOUNT' | 'BILL_DISCOUNT' | 'PROMOTIONAL'

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsString()
  customer_type?: string;

  @IsOptional()
  @IsUUID()
  party_id?: string;

  @IsOptional()
  @IsUUID()
  item_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buy_quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  get_quantity?: number;

  @IsOptional()
  @IsUUID()
  free_item_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_order_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_benefit?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePromotionSchemeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsString()
  customer_type?: string;

  @IsOptional()
  @IsUUID()
  party_id?: string;

  @IsOptional()
  @IsUUID()
  item_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buy_quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  get_quantity?: number;

  @IsOptional()
  @IsUUID()
  free_item_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_order_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_benefit?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
