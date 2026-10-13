import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';

export class GenerateProductLabelDto {
  @IsUUID()
  @IsNotEmpty()
  item_id: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;

  @IsUUID()
  @IsOptional()
  template_id?: string;

  @IsString()
  @IsOptional()
  barcode_id?: string;
}

export class RecordPrintJobDto {
  @IsString()
  @IsNotEmpty()
  document_type: string; // 'ITEM', 'GOODS_RECEIPT'

  @IsUUID()
  @IsNotEmpty()
  document_id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
