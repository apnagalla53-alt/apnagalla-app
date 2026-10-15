import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested, IsOptional, IsObject, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class ComponentDto {
  @IsUUID() item_id: string;
  @IsNumber() @Min(0.000001) @Max(1000000) quantity: number;
}
export class BundleRecipeDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ComponentDto) components: ComponentDto[];
}
class ModifierOptionDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsNumber() @Min(-1000000) @Max(1000000) price_delta: number;
}
class ModifierGroupDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsInt() @Min(0) @Max(20) min_select: number;
  @IsInt() @Min(0) @Max(20) max_select: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ModifierOptionDto) options: ModifierOptionDto[];
}
export class ModifierGroupsDto {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ModifierGroupDto) groups: ModifierGroupDto[];
}
export class AddVariantDto {
  @IsObject() attributes: Record<string,string>;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) sku?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(10000000) default_sale_rate?: number;
}
export class SetupVariantsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>AddVariantDto) variants: AddVariantDto[];
}
export class AddConversionDto {
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,19}$/) unit_code: string;
  @IsNumber() @Min(0.000001) @Max(1000000) conversion_factor: number;
  @IsOptional() @IsNumber() @Min(0) @Max(10000000) selling_price?: number;
}
class UnitPriceDto {
  @IsUUID() unit_id: string;
  @IsNumber() @Min(0) @Max(10000000) selling_price: number;
}
export class UnitPricesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>UnitPriceDto) prices:UnitPriceDto[];
}
