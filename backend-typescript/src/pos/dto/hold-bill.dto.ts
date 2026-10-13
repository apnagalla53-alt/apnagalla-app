import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID, ArrayMaxSize, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class HoldBillLineDto {
  @IsOptional() @IsString() variant_id?: string;
  @IsOptional() @IsString() batch_id?: string;
  @IsOptional() @IsArray() serial_ids?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) modifier_option_ids?: string[];
  @IsOptional() dimensions?: any;
  @IsString()
  item_id: string;

  @IsString()
  godown_id: string;

  @IsString()
  unit_id: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  rate: number;

  @IsNumber()
  @IsOptional()
  discount_amount?: number;
}

export class HoldBillDto {
  @IsOptional() @IsNumber() @Min(0) bill_discount?: number;
  @IsOptional() @IsString() customer_id?: string;
  @IsOptional() @IsString() notes?: string;
  @IsString()
  branch_id: string;

  @IsString()
  @IsOptional()
  reference_name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HoldBillLineDto)
  lines: HoldBillLineDto[];
}
