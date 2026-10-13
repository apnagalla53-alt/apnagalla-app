import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested, ArrayMinSize, ArrayMaxSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseDimensionsDto } from './retail-purchase.dto';
export class RetailBillLineDto {
  @IsUUID() item_id: string;
  @IsNumber() @Min(0.000001) quantity: number;
  @IsNumber() @Min(0) rate: number;
  @IsOptional() @IsNumber() @Min(0) discount_amount?: number;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsUUID() variant_id?: string;
  @IsOptional() @IsUUID() batch_id?: string;
  @IsOptional() @IsUUID() original_line_id?: string;
  @IsOptional() @ValidateNested() @Type(() => PurchaseDimensionsDto) dimensions?: PurchaseDimensionsDto;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) serial_ids?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) modifier_option_ids?: string[];
}
export class RetailPaymentSplitDto {
  @IsIn(['CASH','UPI','CARD','BANK']) method: string;
  @IsNumber() @Min(0) amount: number;
}
export class RetailBillDto {
  @IsOptional() @IsNumber() @Min(0) bill_discount?:number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => RetailBillLineDto) items: RetailBillLineDto[];
  @IsOptional() @IsUUID() customer_id?: string;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => RetailPaymentSplitDto) payment_splits: RetailPaymentSplitDto[];
  @IsOptional() @IsNumber() @Min(0) total_amount?: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() due_date?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @IsIn(['COUNTER','PHONE','WHATSAPP','ONLINE','OTHER','QUICK']) sales_channel?: string;
}
export class RetailHoldDto {
  @IsOptional() @IsNumber() @Min(0) bill_discount?: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => RetailBillLineDto) items: RetailBillLineDto[];
  @IsOptional() @IsUUID() customer_id?: string;
  @IsOptional() @IsString() @MaxLength(100) reference_name?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
}
export class RetailReturnDto {
  @IsUUID() original_invoice_id: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => RetailBillLineDto) lines: RetailBillLineDto[];
  @IsIn(['CASH','KHATA']) refund_method: string;
}
export class RetailAmountSaleDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsIn(['CASH','UPI','CARD','BANK','UDHAR']) payment_method: string;
  @IsOptional() @IsUUID() customer_id?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() due_date?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @IsIn(['COUNTER','PHONE','WHATSAPP','ONLINE','OTHER']) sales_channel?: string;
}
