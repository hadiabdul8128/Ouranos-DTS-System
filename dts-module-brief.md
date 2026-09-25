# Ouranos — DTS Module (Defense Travel Companion)

**Status:** Draft v0.3 · Sep 2026 (fact-checked; see changelog at end)
**Owner:** Ouranos product
**One-liner:** An offline-first travel copilot that sits alongside the Defense Travel System — it drafts authorizations, captures evidence in the field, tracks GTC spend against per diem, and assembles voucher-ready packages so soldiers get reimbursed faster and stop eating late fees.

---

## 1. Why this module, why now

- **DTS is the system of record and is not going anywhere soon.** DoD cancelled MyTravel — the $374M commercial replacement for DTS — in May 2023, and GAO's January 2026 report (GAO-26-107663) found the failure was caused by no central leadership authority, weak program management, inadequate stakeholder outreach, and inconsistent inclusion of users in requirements. DoD is running a small modernization budget while drafting a six-year plan, with a broader overhaul targeted to **begin in FY2027 (i.e., Oct 2026 onward)**. Translation: the legacy system is the reality for years, but a modernization lane is opening *now* — that's both a risk (§11) and a BD opportunity (§9).
- **The pain is acute, frequent, and financial.** Every TDY touches it. Vouchers get rejected for missing receipts, soldiers wait weeks for reimbursement, and GTC confusion leads to late fees and credit hits for junior enlisted — the population least equipped to absorb them.
- **The wedge fits the Ouranos thesis.** We are not trying to be Palantir (data platform) or replace DTS (system of record). We are the **frontline execution layer**: disconnected operation, on-device AI, evidence capture, conflict-aware sync. Travel is the highest-frequency, highest-pain paper workflow in garrison life, and it's a perfect first module because it demos itself.

**Strategic positioning:** *companion, not replacement.* Ouranos never submits to DTS in v1 — it makes the soldier's side of the interaction fast and correct. This avoids the multi-year integration/authorization fight and matches how soldiers actually behave (they already keep a shoebox of receipts and a Notes-app tally).

---

## 2. How the real system works (grounding facts)

These are the mechanics any credible product must respect:

| Thing | Reality |
|---|---|
| System of record | DTS (travel.dod.mil), run by DTMO; bookings fulfilled via the TMC (CWT) inside DTS |
| Payment card | GTCC — Citibank-issued, Individually Billed Account (IBA). The soldier is personally liable for the bill. **Split disbursement is mandatory on all DoD travel vouchers** — GTCC charges are paid to Citi directly from the voucher; any remaining balance is the cardholder's to pay (e.g., via CitiManager) |
| GTCC delinquency ladder | Suspended at **61 days** past statement close (no new charges, no ATM) → due-process letter at 90 → cancelled / eligible for **salary offset at 126 days** → possible charge-off and credit-bureau reporting at 210. GTCC regs last revised May 14, 2026 |
| Receipt rules (JTR para **010301**) | Itemized receipt required for **all lodging (any amount)** and **any single expense ≥ $75**. Lost/destroyed receipt → a lost-receipt statement with the same information is allowed. AOs are discouraged from demanding extra receipts. (Note: 010302 is *duplicate payments / fraudulent claims* — a pre-check rule too, see F3.1) |
| Per diem | Lodging cap + M&IE, by location and season. **DTMO's per-diem lookup is authoritative for DoD travelers** (includes military installations; CONUS generally mirrors GSA). GSA publishes an official API (`api.gsa.gov/travel/perdiem/v2`, free key) + flat files — use as ingest, validate against DTMO. OCONUS rates: DTMO tables only (no official API; third-party normalizers exist, e.g. allowancesapi.com). **CONUS rates roll over every Oct 1 (fiscal year)** |
| Per diem edge cases that cause rejections | **CONUS lodging taxes are *not* in the lodging cap** — reimbursed separately as a misc. expense (different rules OCONUS). **Government-provided meals** (incl. meals in a conference fee) must be deducted from M&IE; all three meals provided → incidentals only; Government mess available → Government Meal Rate (GMR). **Long-term TDY (>30 days)** uses the Lodging-Plus computation (flat-rate 75%/55% was repealed by the FY2019 NDAA). M&IE includes tips/taxes on meals — never separately reimbursable |
| DTS already does | Imports GTCC transactions into the voucher's expense list; accepts receipt uploads (scan/fax); since **Aug 19, 2025** has **13 fixed expense categories** (the free-text "Create Your Own Expense" was removed). Our value is not moving data DTS already has — it's capturing the receipt, getting the math right, and pre-checking *before* the soldier sits down at DTS |
| Lodging priority (policy) | 1) On-base DoD lodging, 2) DoD Preferred commercial program properties, 3) commercial within lodging cap; exceeding the cap requires actual-expense authorization |
| Workflow | Orders (DD 1610 / DTS orders) → Authorization approved by Authorizing Official (AO), funds committed → travel → voucher filed (target: within 5 days of return) → AO certifies → DFAS pays (goal days, reality often weeks) |
| Roles | Traveler, AO, Reviewer, NCH travel clerk, Defense Travel Administrator (DTA) |
| Known pain | Ancient UI, rework loops from AO rejections, clunky receipt attachment, manual per-diem lookups, reimbursement delays, GTC statements that surprise soldiers |

---

## 3. Product concept: the three phases of a TDY

The module is organized around the natural lifecycle of a trip. Each phase maps to real user jobs and works **fully offline**.

### Phase 1 — Pre-travel: "Get the authorization right the first time"

**F1.1 Trip setup (v0.1: manual) → orders parsing (later, gated)**
- **v0.1:** 60-second manual trip setup — duty location(s), dates, lodging type (commercial / on-base / none), rental car y/n, government meals y/n, TDY length. That's all the per-diem engine needs.
- **Later:** photograph/import TDY orders (DD 1610 or DTS printout) and OCR the same fields. **Gated on a CUI/PII review** (§8): orders can carry PII and may be CUI-marked, and storing them in a non-DoD app on a personal device is exactly what DoD mobile-app guidance warns against. If we ship it, extract the fields and discard the image by default.
- Creates a `Trip` record in the local store; everything downstream hangs off it.

**F1.2 Per-diem engine (offline)**
- Bundle of current CONUS (GSA) + OCONUS (DTMO) rates as an on-device database, versioned and updated opportunistically when connected (rates are public, non-sensitive data — ideal for ship-in-app updates).
- Computes: lodging cap by night (seasonal), M&IE by location, **first/last-day M&IE at 75%**, proportional splits for multi-location trips.
- Must also handle (these are the common rejection causes, see §2): **lodging tax outside the cap** (CONUS), **provided-meal deductions / GMR**, **long-term TDY Lodging-Plus**, and **fiscal-year rollover** (a trip spanning Oct 1 uses two rate tables).
- Every number shown is traceable to its source table — the app never "estimates" a rate.
- **Golden test suite:** DTMO publishes worked computational examples (the JTR "CE" papers, e.g. meals-in-a-mess, long-term lodging). Every example becomes a unit test; the engine doesn't ship until all pass.

**F1.3 Lodging recommender (the AI piece)**
- Policy-aware ranking, in order: on-base DoD lodging availability → DoD Preferred properties → commercial options within the cap.
- Signals: price vs. nightly cap (headroom = money in the traveler's pocket vs. out-of-pocket risk), distance to duty site, parking, breakfast, laundry, gym, cancellation terms.
- Output per option: *"Compliant — $18 under cap, 1.2 mi from gate"* or *"Requires actual-expense authorization — over cap by $22/night during peak season."*
- Sources: public DoD Preferred/DoD lodging data + commercial availability via a connected-device query. On-device model does ranking and explanation; raw availability fetch happens only when connectivity exists and is cached.

**F1.4 Authorization cost estimator**
- Builds the full estimated-cost worksheet that mirrors DTS authorization line items (airfare estimate, lodging × nights at cap, M&IE × days, rental car, tolls/parking, fees).
- Export as a clean one-page PDF/summary so typing it into DTS takes minutes, not an hour of tab-switching and rate lookups.

### Phase 2 — In-trip: the field companion (offline-first core)

**F2.1 Evidence capture (Ouranos differentiator)**
- Camera → on-device OCR extracts vendor, date, amount, tax, line items → receipt is hashed + timestamped at capture, stored in the local evidence store (same evidence-chain primitive as the Ouranos inventory module).
- **Capture at point of sale, not paperwork time.** The receipt flow is framed as part of *buying* — snap it before you leave the counter — never as a later chore. (Pattern proven at scale by HCB; see §5.)
- Receipts are matched to expense categories automatically (lodging, fuel, parking, tolls, laundry, covered meals, fees).
- Batch capture mode: snap 8 receipts at the hotel desk in 30 seconds.
- **"Is this a valid receipt?" check at capture:** DTMO defines what a valid receipt is (itemized, vendor, date, amount, payment method). A hotel confirmation or card slip isn't one — flag it *at the counter* and prompt for the itemized folio.
- **Lost-receipt statement:** when a receipt is truly gone, generate the statement the JTR allows, pre-filled with the same fields (vendor/date/amount/reason) from the matching GTC transaction.
- **Receipt-debt nudge:** if an imported GTC transaction that requires a receipt (≥ $75 or lodging) has no matching capture within 24h, surface it while the receipt is still gettable — "Fuel, $81 at the Shoppette yesterday — add the receipt before it's gone."

**F2.2 Spend tracker**
- Running tally in three columns: **Authorized (estimate) · Spent to date · Per-diem ceiling**.
- **Plain-language money.** Copy reads like a person: *"You have $47 of meals allowance left for today"* — never "M&IE ceiling balance: $47.00." Numbers are exact; the language around them is human.
- Live warnings as ceilings are approached: *"Lodging trending $11/night over cap — you'll need actuals authorization or a different hotel."*
- M&IE ledger auto-computed per day, including first/last-day 75% rules.
- Works entirely offline; receipts and tallies are local until sync.

**F2.3 GTC reconciliation (v1: statement import)**
- **Framing:** DTS already imports GTCC transactions into the voucher, so we don't win by moving transactions. We win by knowing *before voucher time* which charges will need a receipt and whether that receipt exists — and by protecting the soldier from the delinquency ladder (§2).
- **Hard truth:** Citibank exposes no public API for GTCC IBAs; statements live in CitiManager. Card-linking services (Plaid etc.) don't support government cards.
- v1 path: user imports the monthly statement (CSV/QFX/OFX download or email-forwarded statement parsed with explicit consent) → transactions are matched against captured receipts and per-diem math.
- Flags: charges with no receipt (if ≥ $75 or lodging → "get the receipt before you leave"), duplicate charges, declined-card reasons helper (DTMO publishes the decline-reason list), statement due date vs. expected reimbursement date.
- **Never touch the PAN.** We store statement-level data only — keeps us out of PCI-DSS scope for card acceptance.
- Long-term: pursue a Citi partnership (commercial-card APIs) through a government channel — multi-year effort, not an MVP dependency.

**F2.4 Trip log**
- Itinerary (from parsed authorization), mileage log for POV travel with rate lookup, ad-hoc notes with photo attachment (e.g., "hotel overbooked, had to move — documented for actuals").
- All offline, all synced later.

### Phase 3 — Post-trip: voucher assembly & getting paid

**F3.1 Voucher builder**
- Assembles the claim from trip data: final per-diem computation, categorized expenses, matched receipts.
- **JTR pre-check before the AO ever sees it:** receipt present for every lodging expense and every item ≥ $75 (JTR 010301), or a lost-receipt statement; no duplicate claims (JTR 010302 — e.g., same charge entered as both GTC import and manual expense, or M&IE claimed on a day meals were provided); lodging tax split out from room rate; every expense maps to one of DTS's 13 categories (fixed since Aug 19, 2025 — keep the mapping versioned); missing-document checklist with the exact items that would trigger rejection.
- Output: (a) a DTS-entry walkthrough — a screen-by-screen checklist mirroring the actual DTS voucher flow with the right numbers in the right fields; (b) a single PDF evidence package (receipts, ordered and labeled) ready to attach.

**F3.2 Get-paid tracker**
- Split-disbursement math shown plainly (it's mandatory, so this is a fact, not a choice): how much goes straight to the GTC, how much to the personal account, and **what's left for you to pay Citi yourself** (e.g., personal charges, the gap if the voucher is short).
- Timeline nudge chain: file within 5 days → check that the GTC balance clears → countdown against the real delinquency ladder (*"This $212 balance hits suspension in 9 days"* at day 61, salary offset at 126) → dispute helper if a charge is wrong.
- This feature alone is a retention engine: it protects soldiers' credit and money.

### Cross-cutting: JTR assistant (on-device RAG)
- "Ask the regulation": natural-language questions against a vetted, versioned offline JTR knowledge base (the JTR is public).
- **Hard guardrails:** answers must cite paragraph numbers; if the passage isn't in the local corpus, say so; never compute rates not present in the local rate tables. Hallucinating a per-diem rate or an entitlement is a trust-killer and potentially a real financial harm to a service member.

---

## 4. What we deliberately do NOT do (v1)

- **No booking.** Booking official travel requires the TMC/CWT relationship; going around it creates compliance problems for the user. We recommend, DTS books.
- **No submission into DTS.** No public API; becoming an authorized DTS-integrated system is a years-long DTMO/DFAS path. Companion first; integration is a Phase-3 business objective, not a technical dependency.
- **No direct Citi integration in v1.** Statement import only (see F2.3).
- **No storage of card numbers, SSN, or CAC-derived credentials.** Full stop — shrinks our security review surface to something we can actually defend.

---

## 5. Design reference: HCB patterns we adopt — and where we diverge

[HCB](https://bank.hackclub.com) (Hack Club Bank) is the closest *design* reference for this module, and the resemblance is deliberate. It runs the same core loop as DTS — **card → receipt → categorize → approval → reimbursement** — aimed at teenage hackathon organizers instead of soldiers, and it proved two things worth stealing wholesale: that consumer-grade execution of a compliance loop earns intense loyalty from a young, non-finance audience (teen organizers ≈ junior enlisted), and that a playful, humane tone in a boring-but-critical domain *builds* trust rather than undermining it. Anti-DTS energy is part of the wedge, not decoration.

### Patterns we adopt

| Pattern | What it means here | Lands in |
|---|---|---|
| Capture at point of sale | Receipts are due when the money is spent, framed as part of buying — never as later paperwork. Plus a receipt-debt nudge when a GTC charge lacks its receipt. | F2.1 |
| Plain-language money | "You have $47 of meals allowance left today," not "M&IE ceiling balance." Exact numbers, human words. | F2.2 |
| Approvals where approvers live | The AO gets a clean, pre-checked consumer surface instead of a fight with DTS — the equivalent of HCB doing approvals in Slack. | v0.3 AO queue |
| Ledger as source of truth | Every dollar is an append-only ledger entry with a hashed evidence attachment; per-diem math and the voucher are *derived views*, never the source. | §6 data model |
| Transparency within scope | No public ledgers ever (OPSEC). Role-scoped visibility instead: traveler sees their trip, AO sees their queue, commander sees the unit rollup. | v0.3 + B2G seed |
| Tone as a feature | Fast, warm, opinionated copy; the anti-"gray wave of misery" aesthetic is a deliberate differentiator against DTS-grade software. | Product-wide |

### Where we deliberately diverge (hard lines)

HCB is a **fiscal sponsor**: it custodies the money, issues the cards, and carries the liability. We do the opposite, and this is a feature of the business, not a limitation:

1. **No custody of funds.** We never hold or move money — no money-transmission exposure, no government funds in our accounts. Citi owns the card, DFAS owns the payment, DTS owns the record.
2. **No card issuance.** We don't (and can't) issue or replace the payment instrument.
3. **Nothing public, ever.** DoD-adjacent data can never be public-by-default; all visibility is role-scoped and need-to-know.
4. **Offline-first, not cloud-first.** HCB assumes connectivity; disconnected operation is our moat.

Framing for pitches: *HCB's UX, married to none of HCB's balance-sheet risk.*

### Competitive landscape (new in v0.3)

The space is not empty. Honest positioning:

| Player | What it is | Overlap | Our edge |
|---|---|---|---|
| **DTS itself** | System of record; GTCC import, receipt upload, pre-audit flags | Receipts, expenses, pre-audit | Mobile-first capture at point of sale, plain-language money, pre-check *before* DTS, delinquency protection |
| **Honest MOS** (honestmos.com) | Free web platform, 279 tools: DTS field walkthrough (25+ error codes, pre-audit flags), per-diem/TDY calculator, GTC guide. Same "written by people who do TDY" voice | Knowledge + calculators | They *explain*; we *do* — capture, track, assemble. Watch closely; could also be a distribution partner |
| **Generic expense apps** ("Military Expenses", "My Travel Expenses" on the App Store; Expensify-class tools) | Receipt photos, per-diem tallies, email reports | Capture + tally | JTR/DTS-specific rules, DTS-mirrored checklist, GTCC ladder, evidence hashing |
| **Per-diem calculators** (e.g. milmultiplier, afcrashpad guides) | Web rate lookups | F1.2 | Offline, trip-aware, meal deductions, auditable to rate-table version |
| **SAP Concur / commercial T&E** | Would-be replacement (MyTravel) | Everything, eventually | Dropped once; a new modernization award is the real long-term threat (§11) |

**To verify before build:** whether DTS offers any mobile receipt-upload path today. Some secondary sources claim a "DTS mobile app"; we couldn't confirm it on DTMO. If it exists, point-of-sale capture must be dramatically better than DTS's own, not just available.

---

## 6. Data model (sketch)

Ledger-first design (see §5): expenses and receipts are append-only entries; everything the traveler sees is a projection.

```
Trip
 ├─ orders_doc (file + parsed fields + confidence)
 ├─ authorization (status, line-item estimates, funding)
 ├─ per_diem_plan (nightly rates, M&IE days, version of rate tables used)
 ├─ itinerary (segments, lodging stays, POV mileage entries)
 ├─ ledger[]  ← append-only: expense entries, receipts, statement txns,
 │              refunds/adjustments — each with evidence hash + device + clock
 ├─ receipts[] (image ref, sha256 hash, captured_at, ocr_payload, match→ledger entry)
 ├─ statement_import[] (source, period, transactions[])
 └─ voucher_package (DERIVED: generated artifacts, pre-check results, status)

Sync metadata: every record carries device_id, lamport/vector clock, revision vector
→ conflict-aware merge into the Ouranos core sync service
```

Conflicts are tractable here: the ledger is append-mostly; per-diem computations are deterministic from (rate-table version × trip facts); the genuinely conflicting surface (edits to the same expense from two devices) is small and can use last-writer-wins with an audit trail of both versions.

---

## 7. On-device AI: what runs where

| Capability | Where it runs | Why |
|---|---|---|
| Receipt OCR + field extraction | On-device (vision model) | Must work in the field with zero signal; PII never leaves the phone unencrypted |
| Orders parsing | On-device | Same |
| Lodging ranking + explanations | On-device rules/ML over cached availability | Deterministic, auditable, policy-aware beats a black box |
| JTR assistant (RAG) | On-device vector index over public JTR text | Citable, offline, no hallucinated entitlements |
| Anomaly detection (dupes, cap breaches) | On-device rules + heuristics | Cheap, explainable to the AO |

Design rule: **the AI drafts and checks; the soldier decides; DTS remains the record.** Every AI output is a suggestion with a source, not an action.

---

## 8. Security & compliance posture

**Two-edition strategy (this de-risks the roadmap):**

1. **Soldier-owned-device edition ("companion").** Personal app, user's own data, minimal PII retention, local encryption at rest, evidence hashes for integrity. No government data feed required. This is the MVP surface and the wedge — it needs no ATO, no FedRAMP, just sane security and a privacy policy. Caveat to verify with counsel: unit/baseline policy (and OPSEC culture) around apps on personal devices during duty travel; the app should have an obvious "no sensitive data leaves this device" posture.
   - **Specific concern (v0.3):** DoD policy bars conducting official business involving **CUI** on non-DoD systems, and DoD CIO / DoD IG guidance flags unofficial mobile apps as an OPSEC and CUI-disclosure risk. Receipts and per-diem math are the traveler's own financial records (low risk). **Travel orders, itineraries for sensitive missions, and OCONUS location data are the risk surface.** v0.1 avoids it: manual trip setup, no orders images, no location tracking, no cloud. Get a written opinion before shipping orders OCR, sync, or the AO/commander views.
   - **Data loss is the flip side of local-only:** a lost phone must not mean lost receipts. v0.1 needs an encrypted export/backup the user controls (e.g., encrypted file to Files/iCloud Drive, user-held key).
2. **Government edition (enterprise).** For unit-level or DFAS/DTMO-facing deployment: FedRAMP Moderate+ / DoD IL4-IL5 hosting, authority-to-operate process, possibly CMMC depending on contract vehicle. This edition is where DTS/Citi integrations eventually land.

Cross-cutting: DoD-affiliated branding and claims need care (no implied endorsement); zero PAN/SSN storage; rate tables and JTR text are public and safe to bundle.

---

## 9. MVP plan

### v0.0 — Pre-build (2–3 weeks, runs before any code; see §9a)

### v0.1 — "The voucher weapon" (6–8 weeks, no integrations) — rescoped in v0.3
- Manual trip setup (orders OCR moved out — CUI risk + scope, see F1.1)
- Offline per-diem engine, **CONUS-only, simple TDYs (≤30 days, single location)** — incl. lodging-tax split, provided-meal deductions, first/last day 75%, FY rollover; golden-test suite green
- Receipt capture with on-device OCR (Apple Vision framework — free, offline), hashing, categorization into DTS's 13 categories, valid-receipt check, lost-receipt statement
- Voucher pre-check (JTR 010301 receipts + 010302 duplicates) + DTS-entry checklist + PDF evidence package
- Encrypted local store + user-controlled encrypted export; single device; no sync
- Legal/UX basics: "not affiliated with DoD/DTMO" disclaimer, privacy policy, in-app data delete, every number cites its source
- **Why first:** it attacks the #1 pain (rejected/delayed vouchers) with zero external dependencies. Demo to any soldier and they get it in 10 seconds.
- **Deferred from v0.1:** orders OCR, multi-location, long-term TDY, OCONUS, statement import, sync, JTR assistant.

### v0.2 — "The whole trip" (+6–8 weeks)
- Spend tracker vs. authorization; M&IE ledger; plain-language money
- GTC statement import (CSV/QFX) + matching + receipt-debt nudges
- Get-paid tracker (split disbursement, GTC due-date guard)
- OCONUS rates; multi-leg trips; long-term TDY (Lodging-Plus)
- Orders OCR (only if §8 CUI review clears it)
- Sync service + conflict-aware merge (Ouranos core)

### v0.3 — "The recommender, the assistant & the chain of command"
- Lodging recommender with DoD Preferred data
- JTR assistant — start with citation-first retrieval over JTR passages (search + quote); add on-device generation only if retrieval alone underdelivers
- **AO-facing view:** a pre-review queue showing AOs clean, pre-checked vouchers — the first B2B hook, since AO rework loops are the system's biggest bottleneck
- **Commander dashboard (scoped transparency):** unit-level travel spend rollup, visible by role and need-to-know — the B2G seed and the OPSEC-safe answer to HCB's public ledgers

### Business development tracks (run in parallel, not on the critical path)
- SBIR/STTR or xTech-style topics in financial management / readiness; AFWERX/OTA pathways
- Conversations with DTMO/DFAS about the eventual integration path; the six-year modernization plan targets a broader overhaul **starting FY2027 (now)** — watch SAM.gov for RFIs/industry days and respond to anything that asks about traveler-side mobile capture
- Citi partnership exploration for statement APIs (government-card programs)
- Veteran adjacency (post-MVP): VA beneficiary travel reimbursement is a separate, equally painful claims workflow — same receipt/evidence/claims engine, new audience. Fits the "veterans" part of the Ouranos mission.

---

## 9a. Pre-build checklist (v0.0 — resolve before writing product code)

**Research / validation**
- [ ] **10–15 traveler interviews** (junior enlisted first) + **3–5 AO / DTA / finance clerk interviews.** Goal: a ranked list of real voucher rejection reasons. Our assumed #1 (missing receipts) must be confirmed, not guessed.
- [ ] **Rejection-reason taxonomy** from those interviews + DTS pre-audit flags + Honest MOS's error-code list → becomes the pre-check rule set.
- [ ] **Receipt corpus:** 50–100 real (redacted) receipts and hotel folios — gas, Shoppette, rental car, lodging with taxes, multi-night folios. This is the OCR accuracy benchmark.
- [ ] **Verify DTS mobile capability** (§5 landscape) — hands-on with a CAC holder.
- [ ] **Walk the DTS voucher flow screen-by-screen** with a real traveler and record it (fields, order, labels). The DTS-entry checklist is only as good as this map.

**Rules & data**
- [ ] Decide per-diem source of truth (DTMO lookup vs. GSA API) and build the ingest + diff job. **FY2027 CONUS rates take effect Oct 1, 2026** — the first rate rollover lands during the build.
- [ ] Collect DTMO computational examples (CE papers) → golden test suite.
- [ ] Map our expense categories → DTS's 13 categories (versioned).
- [ ] Pull DTMO's "What is a Valid Receipt?" paper and the GTCC Cardholder Reference (rev. May 14, 2026) into the rules corpus.

**Legal / trust**
- [ ] Written opinion on CUI/PII + personal-device use (§8). Decides whether orders OCR ever ships.
- [ ] Trademark/branding review: "DTS", "Defense Travel", seals, "Department of War" naming (§12 Q4).
- [ ] Privacy policy, data-retention + deletion, "not a financial advisor / not DoD" disclaimers.
- [ ] Apple App Store review: finance-category requirements, no implied government affiliation.

**Tech spikes (1–3 days each)**
- [ ] Apple Vision OCR on the receipt corpus — field-level accuracy for vendor/date/total/tax.
- [ ] Encrypted local store + encrypted export round-trip.
- [ ] PDF evidence-package generation on device.

**Exit criteria for v0.0:** confirmed top-3 rejection reasons, OCR ≥ 90% field accuracy on totals/dates, a clear CUI answer, and 5 soldiers who say "I'd use this on my next TDY."

---

## 10. Success metrics

- Time from return → voucher filed (target: same day)
- AO first-pass acceptance rate (target: >95% on Ouranos-prepared vouchers)
- Days-to-reimbursement for users vs. baseline
- % of ≥$75 expenses with a captured receipt at time of purchase (the point-of-sale capture metric)
- GTC late-fee incidents among active users (the retention metric)

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| DTS modernization lands and subsumes the companion layer | The broader overhaul is slated to start in FY2027 — nearer than v0.2 assumed, but DoD's track record (MyTravel) says delivery is years out. Even a new system of record still needs a field capture layer. Build the evidence/sync engine generic (it powers inventory + maintenance modules anyway), and position to be *part of* modernization via BD |
| Incumbents / free tools already cover it (DTS, Honest MOS, generic expense apps) | Differentiate on doing, not explaining: point-of-sale capture, correct per-diem edge cases, pre-check, delinquency protection. Validate in v0.0 that this gap is real |
| CUI / personal-device policy blocks adoption or triggers a command ban | v0.1 stores no orders, no locations, no cloud; get a written opinion before expanding (§8) |
| Rate-table errors (FY rollover, lodging tax, meal deductions) cost a soldier money | Golden test suite from DTMO worked examples; every number shows its source + table version; conservative "check with your DTA" fallback on edge cases we don't model |
| Per-diem/JTR rule changes | Rate tables and rules are versioned data, updated OTA; computations record which version produced them |
| Citi never opens an API | Statement import covers 90% of the value; the pain isn't fetching transactions, it's the paperwork |
| OCR errors on receipts | Confidence scores + human confirm UI; evidence hash is on the image (ground truth), OCR is always re-runnable |
| Trust/safety of AI answers to entitlement questions | Citation-required RAG with refusal behavior; conservative by design |

## 12. Open questions (need your calls)

1. **First user persona:** junior enlisted (simple CONUS TDYs, highest pain, phone-only) vs. NCO/officer (complex multi-leg, more clout to advocate)? Recommend junior enlisted for the wedge.
2. **Distribution:** grassroots (app store, soldier-to-soldier, Reddit/unit forums) vs. top-down (unit pilot / SBIR)? Recommend grassroots for speed of learning, BD track in parallel.
3. **Platform:** iOS-first vs. cross-platform from day one? Recommend iOS-first (camera/OCR/secure-enclave quality), Android fast-follow.
4. **Brand boundaries:** how much do we lean on "DTS" naming in the product (e.g., "Ouranos Travel" vs. explicit DTS companion messaging)? Needs a light legal/Trademark look.
5. **Veterans edition timing** — in scope for v0.x research or parked?
6. **Honest MOS: competitor or partner?** Same audience, same voice, big content library, no "do it for me" tool. A partnership could be a distribution channel.
7. **Who owns the CUI/legal opinion** (§8, §9a), and on what timeline? It gates orders OCR, sync, and the AO views.
8. **Monetization for the companion edition:** free (a grassroots wedge that funds itself through B2G later) vs. freemium? This affects App Store category and review.

---

## Changelog

**v0.3 (Sep 24, 2026): fact-check + pre-build scope**
- Fixed the receipt-rule citation: JTR **010301** (not 010302; 010302 is duplicate payments).
- Split disbursement is mandatory under DoD policy; added the GTCC delinquency ladder (61 / 90 / 126 / 210 days).
- Per diem: DTMO is authoritative for DoD travelers; GSA API used as ingest. Added lodging-tax, provided-meal/GMR, long-term TDY (Lodging-Plus), and FY-rollover rules.
- Noted that DTS already imports GTCC transactions and has had 13 fixed expense categories since Aug 19, 2025; reframed F2.3 around that.
- Updated modernization timing: broader overhaul starts FY2027.
- Added competitive landscape (Honest MOS, generic expense apps, calculators).
- Added CUI/personal-device concern; orders OCR moved out of v0.1 and gated on review; added encrypted export.
- Rescoped v0.1; added v0.0 pre-build checklist (§9a); JTR assistant now retrieval-first.
- Open to verify: whether DTS has a mobile receipt-upload path.

**Sources:** GAO-26-107663; DTMO (MyTravel termination, DTS expense-category update, Valid Receipt paper, DTS Expenses module, per-diem lookup, GTCC regs); DFAS split disbursement; JTR; GSA Per Diem API; DoD flat-rate termination FAQ (2018); DoD CIO non-government mobile device guidance; honestmos.com.
