import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, Max, IsIn, MinLength, MaxLength, IsEmail, IsDateString } from 'class-validator';

export class CreateRetailSupplierDto {
  @IsOptional() @IsNumber() @Min(0) opening_balance?: number;
  @IsOptional() @IsDateString({strict:true}) visit_date?: string;
  @IsOptional() @IsIn(['NONE','WEEKLY','MONTHLY']) visit_cycle?: string;
  @IsString()
  @MinLength(1) @MaxLength(255)
  name: string;
  @IsOptional() @IsString() @MaxLength(50) code?: string;
  @IsOptional() @IsString() @MaxLength(100) nickname?: string;
  @IsOptional() @IsIn(['REGULAR','DISTRIBUTOR']) supplier_category?: string;
  @IsOptional() @IsBoolean() credit_allowed?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(3650) credit_days?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100000) max_credit_bills?: number;
  @IsOptional() @IsNumber() @Min(0) credit_limit?: number;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail() @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class UpdateRetailSupplierDto extends CreateRetailSupplierDto {
  @IsOptional() declare name: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class PaySupplierDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsIn(['CASH','UPI','CARD','BANK'])
  payment_method: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
