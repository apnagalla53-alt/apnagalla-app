import { IsUUID, IsNumber, IsOptional, IsBoolean, IsDateString, Min } from 'class-validator';

export class CreateCustomerRateDto {
  @IsUUID()
  party_id: string;

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
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCustomerRateDto {
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
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
