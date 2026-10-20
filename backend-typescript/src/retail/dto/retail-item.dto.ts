import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsInt, IsUUID, IsIn, MinLength, MaxLength,IsArray,ArrayMinSize,ArrayMaxSize,ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddVariantDto } from '../../item-composition/item-composition.dto';

// Matches the existing DECIMAL(15,6) item and opening-stock columns.
const ITEM_NUMBER_MAX = 999_999_999.999999;

export class CreateRetailItemDto {
  @IsOptional() @IsUUID() brand_id?: string | null;
  @IsOptional() @IsBoolean() skip_opening_cost?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(ITEM_NUMBER_MAX, { message: 'Opening cost is too large. Enter an amount below 1,000,000,000.' }) opening_cost?: number;
  @IsOptional() @IsBoolean() inventory_tracking?: boolean;
  @IsString()
  @MinLength(1) @MaxLength(255)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(ITEM_NUMBER_MAX, { message: 'Selling price is too large. Enter an amount below 1,000,000,000.' })
  selling_price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(ITEM_NUMBER_MAX, { message: 'Stock quantity is too large. Enter a quantity below 1,000,000,000.' })
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
  @Max(ITEM_NUMBER_MAX, { message: 'Purchase price is too large. Enter an amount below 1,000,000,000.' })
  purchase_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(ITEM_NUMBER_MAX, { message: 'MRP is too large. Enter an amount below 1,000,000,000.' })
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
  @Max(ITEM_NUMBER_MAX, { message: 'Low-stock quantity is too large. Enter a quantity below 1,000,000,000.' })
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

export class InlineRetailItemDto extends CreateRetailItemDto {
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>AddVariantDto) variants?: AddVariantDto[];
  @IsOptional() @IsNumber() @Min(0) purchase_unit_selling_price?: number;
  @IsOptional() @IsString() @MaxLength(20) purchase_unit_code?:string;
  @IsOptional() @IsNumber() @Min(0.000001) purchase_unit_factor?:number;
}

export class CreateItemBrandDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
}
export class BulkRetailItemsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>CreateRetailItemDto) items:CreateRetailItemDto[];
}
