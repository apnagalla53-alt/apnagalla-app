import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePosSaleLineDto } from './create-pos-sale.dto';

export class CreatePosReturnDto {
  @IsString()
  branch_id: string;

  @IsString()
  @IsOptional()
  party_id?: string;

  @IsString()
  @IsOptional()
  original_invoice_id?: string;

  @IsDateString()
  document_date: string;
  @IsOptional() @IsIn(['CASH','KHATA']) refund_method?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePosSaleLineDto)
  lines: CreatePosSaleLineDto[];
}
