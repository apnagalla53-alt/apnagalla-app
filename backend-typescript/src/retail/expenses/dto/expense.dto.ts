import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, Min, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsNotEmpty()
  @IsString()
  @IsEnum(['BUSINESS_EXPENSE', 'OWNER_WITHDRAWAL'])
  type: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsUUID()
  attachment_id?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsNotEmpty()
  @IsString()
  @IsEnum(['CASH', 'UPI', 'BANK', 'CARD'])
  payment_method: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  paid_to?: string;

  @IsOptional()
  @IsString()
  bill_number?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  is_active?: boolean;
}

export class CreateExpenseCategoryDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;
}
