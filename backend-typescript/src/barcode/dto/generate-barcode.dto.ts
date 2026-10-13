import { IsString, IsOptional, IsIn } from 'class-validator';

export class GenerateBarcodeDto {
  @IsString()
  @IsOptional()
  @IsIn(['CODE128', 'EAN13', 'INTERNAL'])
  type?: string;

  @IsString()
  @IsOptional()
  prefix?: string;
}
