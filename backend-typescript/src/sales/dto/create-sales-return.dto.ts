import { IsUUID, IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnLineDto {
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
}

export class CreateSalesReturnDto {
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
  @IsUUID()
  original_invoice_id?: string;

  @IsOptional()
  @IsUUID()
  reason_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnLineDto)
  lines: CreateSalesReturnLineDto[];
}
