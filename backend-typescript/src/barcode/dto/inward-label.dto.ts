import { IsNotEmpty, IsOptional, IsInt, Min, Max, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class InwardLabelLineDto {
  @IsUUID()
  @IsNotEmpty()
  goods_receipt_line_id: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;
}

export class InwardLabelRequestDto {
  @IsUUID()
  @IsNotEmpty()
  goods_receipt_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InwardLabelLineDto)
  lines: InwardLabelLineDto[];

  @IsUUID()
  @IsOptional()
  template_id?: string;
}
