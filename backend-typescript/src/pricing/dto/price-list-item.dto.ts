import { IsUUID, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreatePriceListItemDto {
  @IsUUID()
  item_id: string;

  @IsOptional()
  @IsUUID()
  unit_id?: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_qty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_qty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePriceListItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_qty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_qty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_percent?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
