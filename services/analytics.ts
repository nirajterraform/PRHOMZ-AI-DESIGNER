/**
 * Lightweight GA4 event helper.
 *
 * Guarded on every call: if the gtag snippet hasn't loaded (ad blocker, offline,
 * consent not granted) it's a silent no-op, and it never throws — analytics can
 * never break the app. Events land in the GA4 "PRHOMZ AI" property (designer
 * stream G-CBYYMXGPRR), alongside the existing `sign_up` conversion.
 *
 * Event names / params used across the app:
 *   select_style        { style_id, style_name }   — a theme was chosen
 *   generate_design     { style_id, budget }       — Apply Transformations
 *   compare_slider_used { style_id }                — dragged before/after
 *   shop_look_open      { style_id }                — opened Shop the Look
 *   select_product      { item_name, price }        — clicked a product to shop
 *   save_look           { items }                   — saved the product selection
 *   download_design     {}                          — downloaded a result
 */
export function track(event: string, params: Record<string, unknown> = {}): void {
  try {
    (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', event, params);
  } catch {
    /* analytics must never break the UX */
  }
}
