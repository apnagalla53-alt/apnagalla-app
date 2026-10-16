import { IsString, MaxLength, MinLength } from 'class-validator';
import { RetailBillDto } from '../dto/retail-bill.dto';
export class BillCorrectionDto { @IsString() @MinLength(2) @MaxLength(100) editor_name:string; @IsString() @MinLength(3) @MaxLength(1000) reason:string; }
export class EditRetailBillDto extends RetailBillDto { @IsString() @MinLength(2) @MaxLength(100) editor_name:string; @IsString() @MinLength(3) @MaxLength(1000) reason:string; }
