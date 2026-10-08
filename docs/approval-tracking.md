# Approval tracking

The 21st.dev OrderTracking component lives at `components/ui/order-tracking.tsx`. Its original shipping example is in `components/ui/order-tracking-demo.tsx`. This project already provides shadcn aliases, Tailwind, TypeScript, lucide-react, and the shared `cn` utility; no additional dependency or provider is needed. Shared styles are in `app/globals.css`, with approval-specific styling in `components/travel/approval-tracker.css`.

`ApprovalTracker` uses the vertical tracker for authorization and voucher requests on planning and inbox surfaces. Milestones come from the saved submission and approval levels. Only approved levels show a completed check. Returned or rejected decisions stay incomplete, preserve the approver comment, and retain the existing overdue warning. Pending future levels do not receive invented dates. Recorded timestamps explicitly use UTC to keep server and browser rendering consistent.

`platform/tests/approval-tracking.test.ts` covers completion, returned/rejected decisions, handoff dates, and missing dates.
