import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsUUID, IsIn, IsDateString, Min, ArrayMaxSize, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseDimensionsDto {
  @IsNumber() @Min(0.000001) length: number;
  @IsOptional() @IsNumber() @Min(0.000001) width?: number;
  @IsOptional() @IsNumber() @Min(0.000001) height?: number;
}
export class PurchaseLineDto {
  @IsUUID() item_id: string;
  @IsNumber() @Min(0.000001) quantity: number;
  @IsNumber() @Min(0) purchase_rate: number;
  @IsOptional() @IsNumber() @Min(0) discount_amount?:number;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsUUID() variant_id?: string;
  @IsOptional() @IsUUID() batch_id?: string;
  @IsOptional() @IsString() @MaxLength(100) batch_number?: string;
  @IsOptional() @IsDateString() manufacturing_date?: string;
  @IsOptional() @IsDateString() expiry_date?: string;
  @IsOptional() @IsNumber() @Min(0) mrp?: number;
  @IsOptional() @IsNumber() @Min(0) selling_price?: number;
  @IsOptional() @ValidateNested() @Type(() => PurchaseDimensionsDto) dimensions?: PurchaseDimensionsDto;
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) serial_numbers?: string[];
}
export class CreateRetailPurchaseDto {
  @IsOptional() @IsNumber() @Min(0) landed_cost_amount?:number;
  @IsUUID() supplier_id: string;
  @IsOptional() @IsNumber() @Min(0.01) total_amount?: number;
  @IsOptional() @IsString() @MaxLength(100) bill_number?: string;
  @IsOptional() @IsDateString() purchase_date?: string;
  @IsOptional() @IsDateString() due_date?: string;
  @IsOptional() @IsIn(['REGULAR','GENERAL','ONLINE']) purchase_category?: string;
  @IsIn(['PAID','CREDIT','PARTIAL']) payment_status: string;
  @IsOptional() @IsNumber() @Min(0) paid_amount?: number;
  @IsOptional() @IsIn(['CASH','UPI','CARD','BANK']) payment_method?: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PurchaseLineDto) lines?: PurchaseLineDto[];
}
