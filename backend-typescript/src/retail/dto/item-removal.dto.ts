import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
export class ItemRemovalDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsUUID('all', {each: true}) ids: string[];
  @IsIn(['ARCHIVE', 'DELETE']) action: 'ARCHIVE' | 'DELETE';
  @IsOptional() @IsString() confirmation?: string;
}
