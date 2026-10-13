import { IsUUID, IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesOrderLineDto {
  @IsUUID()
  item_id: string;

  @IsUUID()
  unit_id: string;

  @IsNumber()
  @Min(0)
  ordered_quantity: number;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  branch_id: string;

  @IsUUID()
  party_id: string;

  @IsString()
  document_number: string;

  @IsDateString()
  document_date: string;

  @IsOptional()
  @IsDateString()
  expected_delivery_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderLineDto)
  lines: CreateSalesOrderLineDto[];
}
