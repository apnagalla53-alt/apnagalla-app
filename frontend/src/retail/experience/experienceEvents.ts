import api from "../../shared/api";
import { createUuid } from "../../shared/browserCrypto";
export type ExperienceEvent =
  | "onboarding_completed"
  | "start_choice_selected"
  | "first_bill_started"
  | "item_search_used"
  | "item_search_no_result"
  | "inline_item_started"
  | "inline_item_created"
  | "amount_only_sale_used"
  | "customer_inline_created"
  | "supplier_inline_created"
  | "purchase_inline_item_created"
  | "bill_save_attempted"
  | "bill_saved"
  | "bill_failed"
  | "bill_resumed"
  | "purchase_started"
  | "purchase_saved"
  | "purchase_resumed"
  | "home_suggestion_shown"
  | "home_suggestion_actioned"
  | "home_suggestion_dismissed"
  | "bulk_item_started"
  | "bulk_item_saved"
  | "intake_opened"
  | "intake_method_selected"
  | "supplier_bill_capture_started"
  | "intake_review_opened"
  | "intake_row_corrected"
  | "intake_confirmed"
  | "excel_upload_started"
  | "excel_mapping_reviewed"
  | "excel_import_confirmed"
  | "voice_started"
  | "voice_parsed"
  | "voice_corrected"
  | "whatsapp_share_received"
  | "intake_abandoned";
type Measurement = {
  workflow?:
    | "HOME"
    | "BILL"
    | "PAYMENT"
    | "PURCHASE"
    | "ITEM"
    | "BULK"
    | "ONBOARDING"
    | "ASSISTANT"
    | "INTAKE";
  count?: number;
  duration_ms?: number;
};
/** No raw names, amounts, search terms, documents, phone numbers or URLs. */
export function trackExperience(
  event: ExperienceEvent,
  measure: Measurement = {},
) {
  void api
    .post(
      "/retail/account/experience/events",
      { event_id: createUuid(), event, ...measure },
      { experienceEvent: true } as any,
    )
    .catch(() => {
      /* Optional measurements must never interrupt a transaction. */
    });
}
