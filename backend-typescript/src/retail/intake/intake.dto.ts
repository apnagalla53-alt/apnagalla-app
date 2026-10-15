import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { intakeFields } from './intake.types';
export class IntakeMappingDto {
  @IsObject() mapping: Record<string, string>;
}
export class VoiceIntakeDto {
  @IsString() @MaxLength(16000) transcript: string;
}
export class EditIntakeRowDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsIn(intakeFields, { each: true })
  clear_fields?: string[];
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(255) sku?: string;
  @IsOptional() @IsString() @MaxLength(100) barcode?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) quantity?: number;
  @IsOptional() @IsString() @MaxLength(20) unit_code?: string;
  @IsOptional() @IsString() @MaxLength(20) sale_unit?: string;
  @IsOptional() @IsNumber() @Min(0.000001) conversion?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) purchase_price?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) selling_price?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) mrp?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gst_rate?: number;
  @IsOptional() @IsString() @MaxLength(20) hsn_sac?: string;
  @IsOptional() @IsString() @MaxLength(100) batch_number?: string;
  @IsOptional() @IsString() @MaxLength(10) expiry_date?: string;
  @IsOptional() @IsString() @MaxLength(10) manufacturing_date?: string;
  @IsOptional() @IsUUID() matched_item_id?: string;
  @IsOptional() @IsBoolean() create_new?: boolean;
  @IsOptional() @IsBoolean() confirmed?: boolean;
  @IsOptional() @IsBoolean() use_quantity_as_stock?: boolean;
  @IsOptional() @IsBoolean() ignore?: boolean;
}
export class ConfirmIntakeDto {
  @IsBoolean() acknowledge_effects: boolean;
  @IsOptional() @IsBoolean() accept_unmapped?: boolean;
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsString() @MaxLength(100) invoice_number?: string;
  @IsOptional() @IsString() @MaxLength(10) invoice_date?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) invoice_total?: number;
  @IsOptional() @IsIn(['PAID', 'CREDIT', 'PARTIAL']) payment_status?: string;
  @IsOptional() @IsIn(['CASH', 'UPI', 'CARD', 'BANK']) payment_method?: string;
  @IsOptional() @IsNumber() @Min(0) paid_amount?: number;
}
export class ConfirmRowsDto {
  @IsArray() @ArrayMaxSize(100) @IsUUID('4', { each: true }) row_ids: string[];
}
