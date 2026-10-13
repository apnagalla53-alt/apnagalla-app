import { IsUUID, IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluatePricingLineDto {
  @IsUUID()
  item_id: string;

  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @IsOptional()
  @IsUUID()
  unit_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  override_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  override_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  override_discount_percent?: number;
}

export class EvaluatePricingDto {
  @IsOptional()
  @IsUUID()
  party_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  document_date?: string;

  @IsOptional()
  @IsString()
  customer_type?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluatePricingLineDto)
  lines: EvaluatePricingLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  bill_discount_percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bill_discount_amount?: number;
}
