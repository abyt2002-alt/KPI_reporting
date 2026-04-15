# Staging Notes

## Cross Platform Analysis

After the cross-platform analysis was completed, the following staging updates are available:

- Outcome filters are now grouped above the analysis section.
- Date range and positive-only filtering are consolidated in one top control area.
- Correlation rows use visual best-R and lag indicators for easier scanning.
- Horizontal overflow in the correlation cards was removed for cleaner usability.

## Summary Page Updates

- "New vs returning customers" visualization was changed from line chart to bar chart.
- KPI card title changed from "Media Spend" to "Meta Spend".
- KPI subtitle updated to "Meta ad spend".
- AI insight mapping now reads "Meta Spend" with fallback support for "Media Spend".

## RAG Implementation Scope (Post UI Branch)

After the `ui-changes` branch updates, this branch starts the AI insight RAG scope:

- Added a seeded 3-example retrieval layer for KPI insight generation.
- Added lightweight similarity scoring using filters (market/product/period) and KPI direction patterns.
- Prompt now includes retrieved examples as style guidance while forcing facts from live KPI payload only.
- Backend now returns 3 response variants (`variants`) plus retrieval metadata (`retrieval_examples`, `rag_scope`) alongside the existing fields.
- Existing UI compatibility is preserved because `headline`, `bullets`, `green_flag`, and `red_flag` are unchanged.

## Final Changes Scope (Pre-Demo)

This section is after the RAG phase, where only 3 seeded examples were used.
The following updates are for final demo preparation:

- Cross-platform analysis results are shown in one combined table instead of separate cards.
- Combined rows are globally sorted by highest `Best r`.
- Outcome context is retained in-table with an `Outcome` column when multiple outcomes are selected.

## Final Changes Scope (Latest Push)

Latest updates pushed in `final-changes` after the pre-demo scope:

- Sidebar navigation order was updated to show **Cross Platform Analysis** before **Campaign Assessment**.
- Main page render order was aligned with the same navigation order.
- Trinity Insights no longer auto-runs on page load; users trigger AI manually with the CTA.
- Insights CTA now follows lifecycle labeling:
  - First run: `Generate insights`
  - After data exists: `Refresh insights`
  - After filter/view change: `Regenerate insights`
- AI insights request timeout was increased from `30s` to `60s` to reduce false timeout failures on slower responses.
