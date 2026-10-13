import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsInt, IsUUID, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateRetailItemDto {
  @IsOptional() @IsBoolean() skip_opening_cost?: boolean;
  @IsOptional() @IsNumber() @Min(0) opening_cost?: number;
  @IsOptional() @IsBoolean() inventory_tracking?: boolean;
  @IsString()
  @MinLength(1) @MaxLength(255)
  name: string;

  @IsNumber()
  @Min(0)
  selling_price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  opening_stock?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit_id?: string;
  @IsOptional() @IsString() @MaxLength(20) unit_code?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) unit_name?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gst_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchase_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  tax_class_id?: string;

  @IsOptional()
  @IsString()
  hsn_sac?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  low_stock_threshold?: number;

  @IsOptional()
  @IsString()
  preferred_supplier_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PIECE','WEIGHT','LENGTH','AREA','VOLUME','SERVICE'])
  selling_mode?: string;

  @IsOptional()
  @IsBoolean()
  has_variants?: boolean;

  @IsOptional()
  @IsBoolean()
  track_batch?: boolean;

  @IsOptional()
  @IsBoolean()
  track_serial?: boolean;

  @IsOptional()
  @IsBoolean()
  is_bundle?: boolean;

  @IsOptional()
  @IsInt() @Min(0) @Max(36500)
  warranty_days?: number;

  @IsOptional()
  custom_attributes?: any;

  @IsOptional()
  @IsString()
  compatibility_tags?: string;

}

export class UpdateRetailItemDto extends CreateRetailItemDto {
  @IsOptional() declare name: string;
  @IsOptional() declare selling_price: number;
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
