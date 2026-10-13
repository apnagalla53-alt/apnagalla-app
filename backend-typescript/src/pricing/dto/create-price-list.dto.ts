import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString, IsUUID, Min } from 'class-validator';

export class CreatePriceListDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  customer_type?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePriceListDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  customer_type?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
