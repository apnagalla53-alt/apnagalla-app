import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class DirectoryQuery {
  @IsOptional() @IsString() @MaxLength(255) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
  @IsOptional() @IsUUID() organization_id?: string;
  @IsOptional() @IsUUID() company_id?: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() user_id?: string;
}
export class CreateStaffDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) username?: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @IsString() @MinLength(1) @MaxLength(255) display_name: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) roles?: string[];
}
export class StaffUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) display_name?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(10) language?: string;
}
export class AdminPasswordDto { @IsString() @MinLength(8) @MaxLength(72) new_password: string; }
export class RoleDto {
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class OrganizationUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(255) legal_name?: string;
}
export class CompanyUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) legal_name?: string;
  @IsOptional() @IsString() @MaxLength(255) trade_name?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(20) postal_code?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(15) gstin?: string;
  @IsOptional() @IsString() @MaxLength(10) pan?: string;
  @IsOptional() @IsString() @MaxLength(50) timezone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(12) fy_start_month?: number;
}
export class CreateCompanyDto extends CompanyUpdateDto {
  @IsUUID() organization_id: string;
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsString() @MinLength(1) @MaxLength(255) declare legal_name: string;
}
export class BranchUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(20) postal_code?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
}
export class CreateBranchDto extends BranchUpdateDto {
  @IsUUID() company_id: string;
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsString() @MinLength(1) @MaxLength(255) declare name: string;
}
export class LocationUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class CreateLocationDto extends LocationUpdateDto {
  @IsUUID() branch_id: string;
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsString() @MinLength(1) @MaxLength(255) declare name: string;
}
export class CreateFinancialYearDto {
  @IsUUID() company_id: string;
  @IsString() @MinLength(1) @MaxLength(100) label: string;
  @IsDateString() start_date: string;
  @IsDateString() end_date: string;
}
