import { IsString, IsNumber, IsOptional } from 'class-validator';

export class OpenShiftDto {
  @IsString()
  branch_id: string;

  @IsNumber()
  @IsOptional()
  opening_balance?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CloseShiftDto {
  @IsNumber()
  @IsOptional()
  closing_balance?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
