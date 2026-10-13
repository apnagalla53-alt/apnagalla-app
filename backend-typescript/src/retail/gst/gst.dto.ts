import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsDefined, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class GstBillsQueryDto {
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) offset = 0;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class GstProfileDto {
  @IsString() @MinLength(2) @MaxLength(255) legal_name: string;
  @IsOptional() @IsString() @MaxLength(255) trade_name?: string;
  @IsString() @MinLength(5) @MaxLength(1000) address: string;
  @IsString() @Matches(/^\d{2}$/) state_code: string;
  @IsString() @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[A-Z0-9]$/) gstin: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsString() @Matches(/^[A-Z0-9]{1,4}$/) invoice_prefix: string;
  @IsInt() @IsIn([4,6]) hsn_digits: number;
  @IsIn(['NOT_REQUIRED','REQUIRED','UNSURE']) electronic_reporting: string;
  @IsBoolean() regular_registration: boolean;
  @IsString() @MinLength(2) @MaxLength(255) signatory: string;
  @IsOptional() @IsString() @MaxLength(1000) terms?: string;
}
export class GstLineDto {
  @IsUUID() line_id: string;
  @IsString() @Matches(/^(?:\d{4}|\d{6}|\d{8})$/) hsn: string;
  @IsString() @MinLength(1) @MaxLength(500) description: string;
  @IsString() @Matches(/^[A-Z]{3}$/) uqc: string;
}
export class GstRecipientDto {
  @IsString() @MinLength(2) @MaxLength(255) name: string;
  @IsString() @MaxLength(1000) address: string;
  @IsString() @Matches(/^\d{2}$/) state_code: string;
  @IsOptional() @IsString() @MaxLength(15) gstin?: string;
  @IsString() @MaxLength(1000) delivery_address: string;
  @IsString() @Matches(/^\d{2}$/) delivery_state_code: string;
}
export class GstInvoiceDto {
  @IsDefined() @ValidateNested() @Type(()=>GstRecipientDto) recipient: GstRecipientDto;
  @IsString() @Matches(/^\d{2}$/) place_of_supply: string;
  @IsBoolean() reverse_charge: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({each:true}) @Type(()=>GstLineDto) lines: GstLineDto[];
  @IsOptional() @IsBoolean() confirmed?: boolean;
  @IsOptional() @IsBoolean() no_previous_gst_invoice?: boolean;
}
