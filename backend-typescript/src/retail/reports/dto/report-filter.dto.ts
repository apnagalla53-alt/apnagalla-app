import { IsOptional, IsString, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @IsOptional() @IsString() staff_id?:string;
  @IsOptional() @IsString() godown_id?:string;
  @IsOptional() @IsString() variant_id?:string;
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  item_id?: string;

  @IsOptional()
  @IsString()
  payment_method?: string;
}
