import { IsString, IsOptional, IsNumber, Min, MinLength, MaxLength, IsUUID, IsIn, IsDateString } from 'class-validator';

export class CreateNeedListDto {
  @IsString()
  @MinLength(1) @MaxLength(255)
  name: string;

  @IsOptional() @IsNumber() @Min(0.000001)
  quantity?: number;
  @IsOptional() @IsNumber() @Min(0) expected_price?: number;
  @IsOptional() @IsIn(['SHOP','CUSTOMER']) source?: string;

  @IsOptional()
  @IsUUID()
  customer_id?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsUUID()
  preferred_supplier_id?: string;

  @IsOptional()
  @IsIn(['NORMAL','URGENT'])
  priority?: string; // NORMAL, URGENT

  @IsOptional()
  @IsDateString()
  needed_by?: string;

  @IsOptional()
  @IsString()
  note?: string;
  
}

export class UpdateNeedStatusDto {
  @IsIn(['NEED','ORDERED','RECEIVED','CANCELLED'])
  status: string; // ORDERED, RECEIVED, CANCELLED
}

export class UpdateNeedListDto extends CreateNeedListDto {
  @IsOptional() declare name: string;
}
