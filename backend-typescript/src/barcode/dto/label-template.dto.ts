import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsIn, Min } from 'class-validator';

export class CreateLabelTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @IsIn(['PRODUCT', 'MRP', 'INWARD', 'SHELF'])
  template_type?: string;

  @IsString()
  @IsOptional()
  @IsIn(['ROLL', 'SHEET'])
  paper_type?: string;

  @IsNumber()
  @Min(10)
  width_mm: number;

  @IsNumber()
  @Min(10)
  height_mm: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  columns?: number;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsString()
  @IsOptional()
  config_json?: string;
}

export class UpdateLabelTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PRODUCT', 'MRP', 'INWARD', 'SHELF'])
  template_type?: string;

  @IsString()
  @IsOptional()
  @IsIn(['ROLL', 'SHEET'])
  paper_type?: string;

  @IsNumber()
  @IsOptional()
  @Min(10)
  width_mm?: number;

  @IsNumber()
  @IsOptional()
  @Min(10)
  height_mm?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  columns?: number;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  config_json?: string;
}
