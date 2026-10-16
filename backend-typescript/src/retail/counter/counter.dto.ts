import { IsString, IsOptional, IsNumber, IsBoolean, Matches, MaxLength, Min, Max } from 'class-validator';
export class UpiProfileDto {
  @IsOptional() @IsString() @Matches(/^(primary|[a-f0-9-]{36})$/) id?:string;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(60) label?:string;
  @IsOptional() @IsBoolean() make_default?:boolean;
  @IsOptional() @IsBoolean() add_new?:boolean;
  @IsString() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/) upi_id: string;
  @IsString() @Matches(/\S/) @MaxLength(100) payee_name: string;
  @IsOptional() @IsString() @Matches(/^[0-9+ -]{7,20}$/) mobile?: string;
  @IsBoolean() show_on_invoice: boolean;
}
export class CashCountDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) opening_cash?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(999999999) actual_cash?: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
