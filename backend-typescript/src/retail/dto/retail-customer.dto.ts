import { Matches, IsString, IsOptional, IsNumber, IsDateString, IsEmail, IsBoolean, IsInt, Min, Max, MinLength, MaxLength, IsIn, IsUUID } from 'class-validator';

export class CreateRetailCustomerDto {
  @IsString()
  @MinLength(1) @MaxLength(255)
  name: string;
  @IsOptional() @IsString() @MaxLength(50) code?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsBoolean() credit_allowed?: boolean;

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
  @IsNumber()
  @Min(0)
  opening_balance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit_limit?: number;

  @IsOptional()
  @IsInt() @Min(0) @Max(3650)
  credit_days?: number;

  @IsOptional()
  @IsUUID()
  price_list_id?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pan?: string;
}

export class UpdateRetailCustomerDto extends CreateRetailCustomerDto {
  @IsOptional() declare name: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ReceivePaymentDto {
  @IsOptional() @IsString() @Matches(/^(primary|[a-f0-9-]{36})$/) receiving_profile_id?:string;
  @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) received_on_mobile?:string;
  @IsOptional() @IsBoolean() receipt_confirmed?:boolean;
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsIn(['CASH','UPI','CARD','BANK'])
  payment_method: string; // CASH, UPI, BANK

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
