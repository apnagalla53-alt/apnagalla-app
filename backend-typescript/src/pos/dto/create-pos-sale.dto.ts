import { Matches, IsBoolean, IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsDateString, IsEnum, Min, IsIn, IsUUID, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePosSaleLineDto {
  @IsString()
  item_id: string;

  @IsString()
  godown_id: string;

  @IsString()
  unit_id: string;

  @IsString()
  @IsOptional()
  variant_id?: string;

  @IsString()
  @IsOptional()
  batch_id?: string;

  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  dimensions?: any;

  @IsString()
  @IsOptional()
  original_line_id?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) serial_ids?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) modifier_option_ids?: string[];
}

export class CreatePosPaymentDto {
  @IsOptional() @IsString() @Matches(/^(primary|[a-f0-9-]{36})$/) receiving_profile_id?:string;
  @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) received_on_mobile?:string;
  @IsOptional() @IsBoolean() receipt_confirmed?:boolean;
  @IsNumber()
  amount: number;

  @IsString()
  @IsIn(['CASH', 'UPI', 'CARD', 'BANK'])
  payment_method: 'CASH' | 'UPI' | 'CARD' | 'BANK';
}

export class CreatePosSaleDto {
  @IsOptional() @IsNumber() @Min(0) bill_discount?:number;
  @IsString()
  branch_id: string;

  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  walkin_name?: string;

  @IsString()
  @IsOptional()
  walkin_phone?: string;

  @IsDateString()
  document_date: string;
  @IsOptional() @IsDateString() due_date?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsIn(['COUNTER','PHONE','WHATSAPP','ONLINE','OTHER','QUICK']) sales_channel?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePosSaleLineDto)
  lines: CreatePosSaleLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePosPaymentDto)
  payments: CreatePosPaymentDto[];
}
