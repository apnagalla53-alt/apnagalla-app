import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsIn } from 'class-validator';

export class AssignBarcodeDto {
  @IsUUID()
  @IsNotEmpty()
  item_id: string;

  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsString()
  @IsOptional()
  @IsIn(['CODE128', 'EAN13', 'EAN8', 'UPC_A', 'QR', 'SUPPLIER', 'INTERNAL'])
  barcode_type?: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}
