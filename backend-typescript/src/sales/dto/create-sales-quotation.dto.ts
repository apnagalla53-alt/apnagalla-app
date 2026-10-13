import { IsString, IsNotEmpty, IsDateString, IsOptional, ValidateNested, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SalesQuotationLineDto {
  @IsString()
  @IsNotEmpty()
  item_id: string;

  @IsString()
  @IsNotEmpty()
  unit_id: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  rate: number;

  @IsOptional()
  @IsNumber()
  discount?: number;
}

export class CreateSalesQuotationDto {
  @IsString()
  @IsNotEmpty()
  branch_id: string;

  @IsString()
  @IsNotEmpty()
  party_id: string;

  @IsString()
  @IsNotEmpty()
  document_number: string;

  @IsDateString()
  document_date: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesQuotationLineDto)
  lines: SalesQuotationLineDto[];
}
