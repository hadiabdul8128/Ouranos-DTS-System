# Ouranos travel workspace

Interactive product prototype: login → Ouranos overview → Travel / DTS.

## Run

```sh
npm install
npm run dev
```

## Included

- Magic UI Border Beam installed with `npx shadcn@latest add @magicui/border-beam --yes`.
- Responsive login, overview, and travel dashboard.
- Workflow search for travel/DTS and related terms.
- Trip filters, details, notifications, and a two-step draft form.
- Demo drafts persist only in this browser through localStorage.
- Optional `open_travel_workspace` WebMCP navigation tool.

## Boundaries

This is a UI prototype using fictional sample records. The login does not authenticate users, and the email field is not submitted or stored. CAC/PIV is an explanatory placeholder. No connection to DTS, document processing, approval service, financial system, or offline synchronization engine is implemented. A hosted private-site access gate is separate from future Ouranos authentication.

## Validation

TypeScript check: `npx tsc --noEmit`.
Production build through the Sites build helper.
