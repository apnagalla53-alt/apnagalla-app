import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested, ArrayMinSize, ArrayMaxSize, MaxLength, MinLength, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseDimensionsDto } from './retail-purchase.dto';
export class QuickBillItemDto {
  @IsUUID() client_id: string;
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,19}$/) unit_code: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) unit_name?: string;
  @IsIn(['PIECE','WEIGHT','LENGTH']) selling_mode: string;
}
export class RetailBillLineDto {
  @IsOptional() @IsUUID() item_id?: string;
  @IsOptional() @ValidateNested() @Type(()=>QuickBillItemDto) new_item?: QuickBillItemDto;
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
