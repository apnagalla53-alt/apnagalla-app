import { IsUUID, IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeliveryChallanLineDto {
  @IsUUID()
  item_id: string;

  @IsUUID()
  godown_id: string;

  @IsUUID()
  unit_id: string;

  @IsNumber()
  @Min(0)
  dispatched_quantity: number;

  @IsOptional()
  @IsUUID()
  sales_order_line_id?: string;
}

export class CreateDeliveryChallanDto {
  @IsUUID()
  branch_id: string;

  @IsUUID()
  party_id: string;

  @IsString()
  document_number: string;

  @IsDateString()
  document_date: string;

  @IsOptional()
  @IsUUID()
  sales_order_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryChallanLineDto)
  lines: CreateDeliveryChallanLineDto[];
}
