import { IsUUID, IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesInvoiceLineDto {
  @IsUUID()
  item_id: string;

  @IsUUID()
  godown_id: string;

  @IsUUID()
  unit_id: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount?: number;

  @IsOptional()
  @IsUUID()
  delivery_challan_line_id?: string;

  @IsOptional()
  @IsUUID()
  sales_order_line_id?: string;
}

export class CreateSalesInvoiceDto {
  @IsUUID()
  branch_id: string;

  @IsUUID()
  party_id: string;

  @IsUUID()
  financial_year_id: string;

  @IsString()
  document_number: string;

  @IsDateString()
  document_date: string;

  @IsOptional()
  @IsNumber()
  payment_terms_days?: number;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesInvoiceLineDto)
  lines: CreateSalesInvoiceLineDto[];
}
