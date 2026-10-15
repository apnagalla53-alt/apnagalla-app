import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
export const experienceEvents = [
  'onboarding_completed',
  'start_choice_selected',
  'first_bill_started',
  'item_search_used',
  'item_search_no_result',
  'inline_item_started',
  'inline_item_created',
  'amount_only_sale_used',
  'customer_inline_created',
  'supplier_inline_created',
  'purchase_inline_item_created',
  'bill_save_attempted',
  'bill_saved',
  'bill_failed',
  'bill_resumed',
  'purchase_started',
  'purchase_saved',
  'purchase_resumed',
  'home_suggestion_shown',
  'home_suggestion_actioned',
  'home_suggestion_dismissed',
  'bulk_item_started',
  'bulk_item_saved',
  'intake_opened',
  'intake_method_selected',
  'supplier_bill_capture_started',
  'intake_review_opened',
  'intake_row_corrected',
  'intake_confirmed',
  'excel_upload_started',
  'excel_mapping_reviewed',
  'excel_import_confirmed',
  'voice_started',
  'voice_parsed',
  'voice_corrected',
  'whatsapp_share_received',
  'intake_abandoned',
] as const;
export class ExperienceEventDto {
  @IsUUID() event_id: string;
  @IsIn(experienceEvents) event: (typeof experienceEvents)[number];
  @IsOptional()
  @IsIn([
    'HOME',
    'BILL',
    'PAYMENT',
    'PURCHASE',
    'ITEM',
    'BULK',
    'ONBOARDING',
    'ASSISTANT',
    'INTAKE',
  ])
  workflow?: string;
  @IsOptional() @IsInt() @Min(0) @Max(2000) count?: number;
  @IsOptional() @IsInt() @Min(0) @Max(604800000) duration_ms?: number;
}
