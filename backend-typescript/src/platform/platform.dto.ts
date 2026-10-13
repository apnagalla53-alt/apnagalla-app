import { IsString, IsOptional, MinLength, MaxLength, IsIn, IsBoolean, IsNumber, Min, Max, IsInt,
  IsUUID, IsDateString, IsArray, IsObject, ArrayMaxSize } from 'class-validator';

export class TenantActionDto {
  @IsIn(['approve_access', 'status', 'subscription', 'limits', 'clear_limits', 'logout', 'disable_user', 'enable_user', 'unlock_user', 'revoke_session', 'note', 'feature', 'clear_feature', 'support_start', 'support_end']) action: string;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
  @IsOptional() @IsIn(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']) status?: string;
  @IsOptional() @IsUUID() plan_id?: string;
  @IsOptional() @IsDateString() expires_at?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3650) free_days?: number;
  @IsOptional() @IsBoolean() complimentary?: boolean;
  @IsOptional() @IsUUID() payment_id?: string;
  @IsOptional() @IsObject() limits?: Record<string, number>;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({each:true}) limit_keys?: string[];
  @IsOptional() @IsIn(['ACTIVE','TRIAL','COMPLIMENTARY']) subscription_status?: string;
  @IsOptional() @IsUUID() user_id?: string;
  @IsOptional() @IsUUID() session_id?: string;
  @IsOptional() @IsString() @MaxLength(50) feature_code?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsUUID() support_id?: string;
}
export class PlanDto {
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10000000) monthly_price: number;
  @IsObject() limits: Record<string, number>;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) feature_codes: string[];
  @IsOptional() @IsBoolean() is_active?: boolean;
}
export class FeatureDto {
  @IsString() @MinLength(1) @MaxLength(50) code: string;
  @IsString() @MinLength(1) @MaxLength(255) name: string;
  @IsBoolean() is_active: boolean;
  @IsIn(['OFF', 'BETA', 'PERCENTAGE', 'ON']) rollout_mode: string;
  @IsInt() @Min(0) @Max(100) rollout_percent: number;
  @IsArray() @ArrayMaxSize(1000) @IsUUID('all', { each: true }) beta_tenants: string[];
}
export class SubscriptionPaymentDto {
  @IsUUID() organization_id: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) amount: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) tax: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) discount: number;
  @IsIn(['PAID', 'PENDING', 'FAILED']) status: string;
  @IsIn(['CASH', 'UPI', 'CARD', 'BANK', 'MANUAL']) method: string;
  @IsString() @MinLength(1) @MaxLength(255) reference: string;
  @IsInt() @Min(1) @Max(120) period_months: number;
  @IsDateString() paid_at: string;
}
export class RefundPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000) amount: number;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}
export class PlatformExpenseDto {
  @IsIn(['SERVER', 'DATABASE', 'STORAGE', 'DOMAIN', 'EMAIL_SMS', 'GATEWAY', 'SUPPORT', 'ADS', 'SALARY', 'SOFTWARE', 'MISC']) category: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000) amount: number;
  @IsDateString() expense_date: string;
  @IsIn(['CASH', 'UPI', 'CARD', 'BANK', 'MANUAL']) method: string;
  @IsOptional() @IsString() @MaxLength(255) reference?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
export class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(255) title: string;
  @IsString() @MinLength(1) @MaxLength(4000) message: string;
  @IsIn(['ALL', 'FREE', 'RETAIL', 'RETAIL_PLUS', 'SELECTED']) audience: string;
  @IsArray() @IsUUID('all', { each: true }) tenant_ids: string[];
  @IsDateString() starts_at: string;
  @IsDateString() ends_at: string;
  @IsInt() @Min(0) @Max(10) priority: number;
}
export class PlatformSettingsDto {
  @IsBoolean() maintenance_mode: boolean;
  @IsString() @MaxLength(2000) banner: string;
  @IsBoolean() signup_enabled: boolean;
  @IsBoolean() force_login: boolean;
  @IsString() @MinLength(3) @MaxLength(2000) reason: string;
}
