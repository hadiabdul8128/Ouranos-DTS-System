'use client';
import Link from 'next/link';

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {ArrowLeft, ArrowUpRight, CheckCircle2, FileText, RefreshCw} from 'lucide-react';
import {usePlatform} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import type {Entity, Role} from '@/packages/contracts';
import {approvalLevelName, approvalWait} from '@/packages/contracts/approval-chain';
import {authorizationBudget} from '@/packages/domain/authorization-budget';
import {travelModeSummary} from '@/packages/domain/travel-mode';
import {preAuditFlags} from '@/packages/domain/pre-audit';
import {amendmentChanges} from '@/packages/domain/amendment';
import {planningModuleSchema, PLANNING_SCHEMA_VERSION, type PlanningModuleInput} from '@/packages/contracts/planning-module';
import {voucherModuleSchema, VOUCHER_MODULE_SCHEMA_VERSION, type VoucherModuleInput} from '@/packages/contracts/voucher-module';
import {AllowanceDetails} from '@/components/travel/allowance';
import {TravelPackagePanel} from '@/components/travel/package-panel';
import type {Allowance} from '@/packages/domain/voucher-adapter';
import type {OuranosClient} from '@/packages/sdk';

type RevisionDetail = Awaited<ReturnType<OuranosClient['revision']>>;
type Row = Record<string, unknown>;
type Decision = 'approved' | 'changes_requested' | 'rejected';
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const string = (value: unknown, fallback = 'Not provided') => typeof value === 'string' && value ? value : fallback;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const label = (value: unknown) => string(value).replaceAll('_', ' ');
const data = (value: unknown) => record(record(value).data);
const STATUS_TEXT: Record<string, string> = {in_review: 'Waiting for review', approved: 'Approved', changes_requested: 'Sent back', rejected: 'Not approved', verified: 'Checked'};
const statusText = (value: unknown) => STATUS_TEXT[string(value, '')] ?? label(value);
const kindText = (kind: unknown) => kind === 'voucher' ? 'Expenses (voucher)' : 'Travel plan';
/** Who, where, when and how much, so a leader knows what they're deciding before reading the details. */
function ReviewSummary({detail, kind}: {detail: RevisionDetail; kind: string}) {
  const snapshot = detail.revision.snapshot, trip = data(snapshot.trip);
  const plan = kind === 'authorization' ? planningForm(snapshot.entity) : planningForm(record(record(snapshot.authorizationRevision).snapshot).entity);
  const voucher = kind === 'voucher' ? voucherForm(snapshot.entity) : null;
  const budgetSnapshot=kind==='authorization'?snapshot:record(record(snapshot.authorizationRevision).snapshot);
  const planned=plan?authorizationBudget({destination:string(trip.destination,''),departure:string(trip.departure,''),returnDate:string(trip.returnDate,'')},plan,budgetSnapshot.perDiem as Allowance|null).totalMinor:0;
  const flags = kind === 'authorization' && plan ? [plan.amendment && `Change ${plan.amendment.number} to an approved plan`, plan.aeaJustification && 'Hotel over the lodging rate', plan.preAudit?.flightFare === 'other' && 'Flight isn’t a GSA fare', plan.preAudit?.rentalClass === 'larger' && 'Rental car larger than compact'].filter(Boolean) as string[] : [];
  return <section className="review-summary" aria-label="Summary">
    <p className="review-summary-who">{plan?.traveler || 'Traveler'}</p>
    <p className="review-summary-trip">{plan?.origin ? `${plan.origin} → ` : ''}{string(trip.installation, '') ? `${string(trip.installation)} · ` : ''}{string(trip.destination)}</p>
    <p className="review-summary-when">{date(trip.departure)} – {date(trip.returnDate)} · {string(trip.purpose, '')}</p>
    <p className="review-summary-money">{voucher ? <>{usd(voucher.reconciliation.totalAmountMinor)} <span>claimed of {usd(planned)} approved</span></> : <>{usd(planned)} <span>planned</span></>}</p>
    {flags.length > 0 && <ul className="review-summary-flags">{flags.map(flag => <li key={flag}>{flag} · see below</li>)}</ul>}
  </section>;
}
const usd = (minor: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(minor / 100);
const money = (minor: unknown, currency: unknown = 'USD') => {
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) return 'Not provided';
  if (currency === 'USD') return usd(minor);
  return `${(minor / 100).toFixed(2)} ${string(currency)}`;
};
const date = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not provided';
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 'Not provided' : parsed.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
};
const timestamp = (value: unknown) => {
  if (typeof value !== 'string') return 'Not provided';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not provided' : `${parsed.toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'})} UTC`;
};
const payment = (value: unknown) => value === 'gtcc' ? 'GTCC' : value === 'personal' ? 'Personal funds' : 'Not specified';
const bytes = (value: unknown) => typeof value === 'number' && value > 0 ? value >= 1_048_576 ? `${(value / 1_048_576).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB` : 'Size not provided';

function Field({name, children}: {name: string; children: ReactNode}) {
  return <div><dt>{name}</dt><dd>{children}</dd></div>;
}
function planningForm(entity: unknown): PlanningModuleInput | null {
  const entityData = data(entity);
  if (entityData.formSchemaVersion !== PLANNING_SCHEMA_VERSION) return null;
  const parsed = planningModuleSchema.safeParse(entityData.formData);
  return parsed.success ? parsed.data : null;
}
function voucherForm(entity: unknown): VoucherModuleInput | null {
  const entityData = data(entity);
  if (entityData.formSchemaVersion !== VOUCHER_MODULE_SCHEMA_VERSION) return null;
  const parsed = voucherModuleSchema.safeParse(entityData.formData);
  return parsed.success ? parsed.data : null;
}

function PlannedBudget({plan, approved,perDiem}: {plan: PlanningModuleInput; approved: boolean;perDiem:Allowance|null}) {
  const budget=authorizationBudget({destination:'',departure:'',returnDate:''},plan,perDiem);
  const total=budget.totalMinor;
  return <section className="connected-review-section" aria-labelledby="review-budget-title">
    <div className="connected-review-item-header"><h3 id="review-budget-title">{approved ? 'Approved budget' : 'Planned budget'}</h3><strong className="connected-review-total">{usd(total)} <small>USD</small></strong></div>
    <div className="connected-review-items">{plan.approvedExpenseItems.map(item => <article className="connected-review-item" key={item.id}>
      <div className="connected-review-item-header"><div><h4>{item.description}</h4><p className="connected-review-meta">{label(item.category)}{item.merchant ? ` · ${item.merchant}` : ''}</p></div><strong>{usd(item.authorizedAmountMinor)}</strong></div>
      <dl className="connected-review-summary">
        <Field name="Payment">{payment(item.expectedPaymentMethod)}</Field>
        {item.date && <Field name="Date">{date(item.date)}</Field>}
        {item.startDate && <Field name="Service dates">{date(item.startDate)} – {date(item.endDate)}</Field>}
        {item.nights !== undefined && <Field name="Nights">{item.nights}</Field>}
      </dl>
    </article>)}</div>
    <p className="platform-muted">Planned expenses: {usd(budget.expensesMinor)} · Meals and incidentals estimate: {budget.mealsIncluded?`${usd(budget.mealsMinor)} included`:'not included'}</p>
  </section>;
}

function FrozenExpenses({snapshot, plan}: {snapshot: Row; plan: PlanningModuleInput | null}) {
  const expenses = rows(snapshot.expenses);
  const documents = new Map(rows(snapshot.documents).map(document => [string(document.id), document]));
  const planned = new Map(plan?.approvedExpenseItems.map(item => [item.id, item]) || []);
  return <section className="connected-review-section" aria-labelledby="review-expenses-title">
    <h3 id="review-expenses-title">Submitted expenses <span className="connected-review-meta">({expenses.length})</span></h3>
    <div className="connected-review-items">{expenses.map((expense, index) => {
      const expenseData = data(expense);
      const item = planned.get(string(expenseData.authorizationItemId));
      const documentIds = Array.isArray(expenseData.documentIds) ? [...new Set(expenseData.documentIds.filter((id): id is string => typeof id === 'string'))] : [];
      return <article className="connected-review-item" key={string(expense.id, String(index))}>
        <div className="connected-review-item-header"><div><h4>{string(expenseData.merchant)}</h4><p className="connected-review-meta">{label(expenseData.category)} · {date(expenseData.incurredOn)}</p></div><strong>{money(expenseData.amountMinor, expenseData.currency)}</strong></div>
        {expenseData.description ? <p>{string(expenseData.description)}</p> : null}
        <dl className="connected-review-summary">
          <Field name="Payment">{payment(expenseData.paymentMethod)}</Field>
          {expenseData.category==='lodging'&&<><Field name="Tax">{money(expenseData.taxesMinor||0)}</Field><Field name="Fees">{money(expenseData.feesMinor||0)}</Field></>}
          <Field name="Budget item">{item?.description || 'Not available in this revision'}</Field>
          {(expenseData.serviceStartDate || expenseData.serviceEndDate) ? <Field name="Service dates">{date(expenseData.serviceStartDate)} – {date(expenseData.serviceEndDate)}</Field> : null}
        </dl>
        <div className="connected-review-receipts"><h5>Receipts · {documentIds.length}</h5>
          {documentIds.length ? documentIds.map(id => {
            const document = documents.get(id), metadata = data(document);
            return <div key={id}>
              <p><FileText size={14} aria-hidden="true"/> {document ? string(metadata.filename) : 'Receipt metadata unavailable'}</p>
              {document && <p className="connected-review-meta">{string(metadata.mediaType)} · {bytes(metadata.byteSize)} · {label(document.status)} at submission</p>}
              <details><summary>Receipt identity</summary><p className="connected-review-meta">Document <code>{id}</code></p>{metadata.sha256 ? <p className="connected-review-fingerprint">SHA-256 <code>{string(metadata.sha256)}</code></p> : null}</details>
            </div>;
          }) : <p className="connected-review-meta">No receipts attached to this expense.</p>}
        </div>
      </article>;
    })}</div>
  </section>;
}

function FrozenResolutions({form, snapshot, plan}: {form: VoucherModuleInput; snapshot: Row; plan: PlanningModuleInput | null}) {
  const resolutions = Object.entries(form.resolutions);
  const expenseNames = new Map(rows(snapshot.expenses).map(expense => [string(expense.id), string(data(expense).merchant)]));
  const budgetNames = new Map(plan?.approvedExpenseItems.map(item => [item.id, item.description]) || []);
  const issueNames: Record<string, string> = {over_authorization: 'Expense above approved budget', itinerary_changed: 'Return date changed', not_used: 'Budget item not used'};
  return <section className="connected-review-section" aria-labelledby="review-resolutions-title">
    <h3 id="review-resolutions-title">Explanations &amp; confirmations</h3>
    {resolutions.length ? <div className="connected-review-items">{resolutions.map(([id, resolution]) => {
      const issue = id.split(':').at(-1) || id;
      const subject = resolution.type === 'not_used' ? budgetNames.get(resolution.value) : expenseNames.get(id.split(':')[0]);
      return <article className="connected-review-item" key={id}>
        <h4>{issueNames[issue] || label(issue)}</h4>
        {subject && <p className="connected-review-meta">{subject}</p>}
        <p>{resolution.type === 'confirmed_date' ? `Confirmed travel date: ${date(resolution.value)}` : resolution.type === 'not_used' ? 'The traveler confirmed this budget item was not used.' : resolution.type === 'lost_receipt_statement' ? resolution.value.reason : resolution.value}</p>
        {resolution.at && <p className="connected-review-meta">Recorded {timestamp(resolution.at)}</p>}
      </article>;
    })}</div> : <p className="platform-muted">No exception explanations or confirmations were included.</p>}
  </section>;
}

function Submission({detail, kind}: {detail: RevisionDetail; kind: string}) {
  const snapshot = detail.revision.snapshot;
  const trip = data(snapshot.trip);
  const approvedRevision = record(snapshot.authorizationRevision);
  const plan = kind === 'authorization' ? planningForm(snapshot.entity) : planningForm(record(approvedRevision.snapshot).entity);
  const voucher = kind === 'voucher' ? voucherForm(snapshot.entity) : null;
  const reconciliation = record(snapshot.reconciliation);
  const expenses = rows(snapshot.expenses);
  const paidBy = (method: string) => expenses.reduce((sum, expense) => {
    const expenseData = data(expense);
    return expenseData.paymentMethod === method && expenseData.currency === 'USD' && typeof expenseData.amountMinor === 'number' && Number.isSafeInteger(expenseData.amountMinor) ? sum + expenseData.amountMinor : sum;
  }, 0);
  const amendment = kind === 'authorization' ? plan?.amendment : undefined;
  const changes = amendment && plan ? amendmentChanges(amendment.previous, {destination: string(trip.destination, ''), ...(typeof trip.installation === 'string' && trip.installation ? {installation: trip.installation} : {}), departure: string(trip.departure, ''), returnDate: string(trip.returnDate, ''), purpose: string(trip.purpose, ''), items: plan.approvedExpenseItems.map(item => ({id: item.id, category: item.category, description: item.description, authorizedAmountMinor: item.authorizedAmountMinor}))}) : [];
  return <>
    {amendment && <section className="connected-review-section review-amendment" aria-labelledby="review-amendment-title">
      <h3 id="review-amendment-title">Change {amendment.number} to an approved plan</h3>
      <p className="review-aea">{amendment.reason}</p>
      {changes.length ? <table className="review-changes"><thead><tr><th scope="col">What</th><th scope="col">Approved</th><th scope="col">Now</th></tr></thead><tbody>{changes.map(change => <tr key={change.label}><th scope="row">{change.label}</th><td>{change.from}</td><td>{change.to}</td></tr>)}</tbody></table> : <p className="platform-muted">No differences from the approved plan.</p>}
    </section>}
    <section className="connected-review-section">
      <h3>Travel details</h3>
      <dl className="connected-review-summary">
        <Field name="Traveler">{plan?.traveler || 'Not provided in this form'}</Field>
        <Field name="From">{plan?.origin || 'Not provided in this form'}</Field>
        <Field name="Getting there">{travelModeSummary(plan?.travelMode, plan?.mileage)}</Field>
        <Field name="To">{string(trip.destination)}</Field>
        {typeof trip.ordersNumber === 'string' && trip.ordersNumber && <Field name="Orders number">{trip.ordersNumber}</Field>}
        {typeof trip.installation === 'string' && trip.installation && <Field name="Installation">{string(trip.installation)}</Field>}
        <Field name="Departure">{date(trip.departure)}</Field>
        <Field name="Return">{date(trip.returnDate)}</Field>
        <Field name="Currency">{plan?.currency || voucher?.currency || 'Not provided'}</Field>
      </dl>
      <p className="connected-review-meta">Purpose</p><p>{string(trip.purpose)}</p>
      {preAuditFlags(plan?.preAudit).map(flag => <div key={flag.title}><p className="connected-review-meta">Pre-audit · {flag.title}</p><p className="review-aea">{flag.reason}</p></div>)}
      {plan?.aeaJustification && <><p className="connected-review-meta">Hotel over per diem · AEA justification</p><p className="review-aea">{plan.aeaJustification}</p></>}
    </section>
    <AllowanceDetails value={(kind==='authorization'?snapshot.perDiem:record(approvedRevision.snapshot).perDiem) as Allowance|null||null}/>
    {voucher&&<TravelPackagePanel voucherId={string(record(snapshot.entity).id)}/>}
    {plan && <PlannedBudget plan={plan} approved={kind === 'voucher'} perDiem={(kind==='authorization'?snapshot.perDiem:record(approvedRevision.snapshot).perDiem) as Allowance|null||null}/>}
    {voucher && <>
      <section className="connected-review-section">
        <h3>Voucher totals</h3>
        <dl className="connected-review-summary">
          <Field name="Total claimed (USD)"><strong className="connected-review-total">{usd(voucher.reconciliation.totalAmountMinor)}</strong></Field>
          <Field name="GTCC (USD)">{usd(paidBy('gtcc'))}</Field>
          <Field name="Personal funds (USD)">{usd(paidBy('personal'))}</Field>
        </dl>
        <p className="platform-muted">Payment totals reflect the submitted expenses.</p>
      </section>
      <FrozenExpenses snapshot={snapshot} plan={plan}/>
      <FrozenResolutions form={voucher} snapshot={snapshot} plan={plan}/>
      <section className="connected-review-section">
        <h3>Traveler certification</h3>
        <p><CheckCircle2 size={16} aria-hidden="true"/> The traveler certified this voucher and marked expense intake complete.</p>
        <p className="platform-muted">{reconciliation.ready === true ? 'Application reconciliation passed when this revision was submitted.' : 'Reconciliation status is not available in this revision.'} Review the submitted evidence before recording a decision.</p>
      </section>
    </>}
    <section className="connected-review-section">
      <details className="cw-disclosure"><summary>Revision details</summary>

      <dl className="connected-review-summary">
        <Field name="Revision"><code>{detail.revision.id}</code></Field>
        <Field name="Form version"><code>{string(data(snapshot.entity).formSchemaVersion)}</code></Field>
        <Field name="Submitted">{timestamp(record(detail.revision).created_at)}</Field>
      </dl>
      <p className="connected-review-fingerprint">SHA-256 <code>{detail.revision.sha256}</code></p>
      {kind === 'voucher' && approvedRevision.id ? <details><summary>Approved authorization reference</summary><p><code>{string(approvedRevision.id)}</code></p><p className="connected-review-fingerprint">SHA-256 <code>{string(approvedRevision.sha256)}</code></p></details> : null}
      </details>
    </section>
  </>;
}

export default function Review() {
  const platform = usePlatform();
  const actorId = platform.session?.user.id;
  const role = platform.memberships.find(membership => membership.organizationId === platform.organizationId)?.role;
  return <main className="quiet-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><Link href="/dashboard/platform">Workspace</Link></header>
    <section className="platform-panel connected-review">
      {platform.client && platform.organizationId && actorId ? <ReviewInbox key={`${platform.organizationId}:${actorId}:${role || ''}`} client={platform.client} organizationId={platform.organizationId} actorId={actorId} role={role}/> : <><h1>Review inbox</h1><p className="platform-muted">Sign in to a connected workspace to review submitted travel.</p><Link href="/dashboard/platform">Open workspace <ArrowUpRight size={14} aria-hidden="true"/></Link></>}
    </section>
  </main>;
}

function ReviewInbox({client, organizationId, actorId, role}: {client: OuranosClient; organizationId: string; actorId: string; role?: Role}) {
  const platform = usePlatform();
  const [requests, setRequests] = useState<Entity[]>([]);
  const [now] = useState(() => new Date());
  const [selected, setSelected] = useState<Entity | null>(null);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(false), listGeneration = useRef(0), detailGeneration = useRef(0), commandBusy = useRef(false);

  const refresh = useCallback(async () => {
    const generation = ++listGeneration.current;
    setLoading(true);
    try {
      const response = await client.list('approval', organizationId);
      if (!alive.current || generation !== listGeneration.current) return;
      setRequests(response.entities.filter(entity => entity.kind === 'approval' && entity.organizationId === organizationId));
      setError('');
    } catch (reason) {
      if (alive.current && generation === listGeneration.current) setError(reason instanceof Error ? reason.message : 'Unable to load reviews');
    } finally {
      if (alive.current && generation === listGeneration.current) setLoading(false);
    }
  }, [client, organizationId]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const listRequests = listGeneration, detailRequests = detailGeneration;
    // A disposed Strict Mode setup must not start a second inbox request.
    queueMicrotask(() => { if (!cancelled) void refresh(); });
    return () => { cancelled = true; alive.current = false; ++listRequests.current; ++detailRequests.current; };
  }, [refresh]);

  async function open(entity: Entity) {
    if (commandBusy.current) return;
    const generation = ++detailGeneration.current;
    setSelected(entity); setDetail(null); setComment(''); setError(''); setNotice(''); setDetailLoading(true);
    try {
      const [latest, submission] = await Promise.all([client.get('approval', entity.id, organizationId), client.revision(entity.id, organizationId)]);
      if (!alive.current || generation !== detailGeneration.current) return;
      if (latest.entity.id !== entity.id || latest.entity.kind !== 'approval' || latest.entity.organizationId !== organizationId || submission.revision.id !== latest.entity.data.revisionId || record(submission.revision.snapshot.entity).organizationId !== organizationId || record(submission.revision.snapshot.entity).id !== latest.entity.data.entityId || record(submission.revision.snapshot.trip).organizationId !== organizationId || record(submission.revision.snapshot.trip).id !== latest.entity.tripId) throw new Error('The review context changed. Return to the inbox and reopen this request.');
      setSelected(latest.entity); setDetail(submission);
    } catch (reason) {
      if (alive.current && generation === detailGeneration.current) setError(reason instanceof Error ? reason.message : 'Unable to load the submitted revision');
    } finally {
      if (alive.current && generation === detailGeneration.current) setDetailLoading(false);
    }
  }

  const steps = rows(detail?.steps).sort((a, b) => Number(a.position) - Number(b.position));
  const current = steps.find(step => step.status === 'pending');
  const levelLabels = rows(record(selected?.data).levels).map(level => typeof level.label === 'string' ? level.label : undefined);
  const kind = string(selected?.data.kind, '');
  const supported = Boolean(detail && (kind === 'authorization' ? planningForm(detail.revision.snapshot.entity) : kind === 'voucher' ? voucherForm(detail.revision.snapshot.entity) && planningForm(record(record(detail.revision.snapshot.authorizationRevision).snapshot).entity) : false));
  const canDecide = Boolean(selected?.status === 'in_review' && supported && current?.assignee_id === actorId && current?.required_role === role && record(detail?.revision).submitted_by !== actorId);

  async function decide(decision: Decision) {
    if (!selected || !detail || !canDecide || commandBusy.current) return;
    commandBusy.current = true; setBusy(true); setError('');
    const generation = detailGeneration.current;
    try {
      const storedDevice = await platform.repository?.db.meta.get('deviceId');
      if (!alive.current || generation !== detailGeneration.current) return;
      const result = await client.command({type: 'approval.decide', commandId: crypto.randomUUID(), organizationId, entityId: selected.id, expectedVersion: selected.version, deviceId: typeof storedDevice?.value === 'string' ? storedDevice.value : crypto.randomUUID(), schemaVersion: 1, payload: {decision, comment}});
      if (!alive.current || generation !== detailGeneration.current) return;
      if (!result.ok) throw new Error(result.error.message);
      if (result.entity.id !== selected.id || result.entity.organizationId !== organizationId || result.entity.kind !== 'approval') throw new Error('The response could not be matched to this request. Refresh the inbox to confirm the recorded decision.');
      ++detailGeneration.current; setSelected(null); setDetail(null); setComment('');
      setNotice(decision === 'approved' ? result.entity.status === 'approved' ? 'Approved. The traveler has been told.' : `Approved. It’s gone to ${approvalLevelName(steps.indexOf(current!) + 1, levelLabels[steps.indexOf(current!) + 1])} next, and the traveler has been told.` : decision === 'changes_requested' ? 'Sent back. The traveler has your note.' : 'Not approved. The traveler has been told.');
      await refresh();
      if (alive.current) void platform.engine?.sync().catch(() => { /* The server decision is already recorded; workspace sync can retry independently. */ });
    } catch (reason) {
      if (alive.current && generation === detailGeneration.current) setError(reason instanceof Error ? reason.message : 'Unable to record the decision. Reload this request to confirm its current status.');
    } finally {
      commandBusy.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function close() {
    if (commandBusy.current) return;
    ++detailGeneration.current; setSelected(null); setDetail(null); setComment(''); setError(''); setDetailLoading(false);
  }

  return <>
    <div className="connected-review-item-header"><div><h1>Requests to review</h1><p className="platform-muted">Travel plans and expenses waiting for a decision.</p></div>{!selected && <Button variant="ghost" aria-label="Refresh review inbox" disabled={loading || busy} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>Refresh</Button>}</div>
    {notice && <p className="connected-review-status" role="status">{notice}</p>}
    {error && <p className="connected-review-error" role="alert">{error}</p>}
    {!selected ? <div aria-busy={loading}>
      {loading && <p role="status" className="platform-muted">Loading review requests…</p>}
      {[...requests].sort((a, b) => Number(b.status === 'in_review') - Number(a.status === 'in_review')).map(request => <button type="button" className="platform-record review-record" key={request.id} disabled={busy || loading} onClick={() => void open(request)}>{(() => { const wait = approvalWait(request, now); return <div><strong>{kindText(request.data.kind)}{typeof request.data.destination === 'string' ? ` · ${request.data.destination}` : ''}</strong><p className="connected-review-meta">Updated {timestamp(request.updatedAt)}</p>{wait?.late && <p className="review-late">Waiting {wait.days} days · past the 72-hour mark</p>}</div>; })()}<span>{statusText(request.status)} <ArrowUpRight size={14} aria-hidden="true"/></span></button>)}
      {!loading && !requests.length && !error && <div className="platform-block"><h2>Nothing to review</h2><p className="platform-muted">When someone on your team sends a plan or expenses, it shows up here.</p></div>}
    </div> : <div className="platform-block">
      <Button variant="ghost" disabled={busy} onClick={close}><ArrowLeft size={16} aria-hidden="true"/>Back to requests</Button>
      <div className="connected-review-item-header"><h2>{kindText(kind)}</h2><span className="connected-review-status">{statusText(selected.status)}</span></div>
      {detailLoading ? <p role="status" className="platform-muted">Loading…</p> : detail ? <>
        {!supported && <p className="connected-review-error" role="alert">This form version cannot be fully displayed here. A decision is unavailable in this view.</p>}
        <ReviewSummary detail={detail} kind={kind}/>
        <Submission detail={detail} kind={kind}/>
        <details className="connected-review-section review-route">
          <summary>Approval route</summary>
          <ol className="connected-review-route">{steps.map((step, index) => <li key={string(step.id, String(index))}><strong>Level {index + 1} · {approvalLevelName(index, levelLabels[index])}</strong><span className="connected-review-status">{step.status === 'pending' ? step === current ? 'Deciding now' : 'Next' : statusText(step.status)}</span>{step.assignee_id === actorId && <p className="connected-review-meta">That’s you</p>}</li>)}</ol>
          {rows(detail.decisions).length > 0 && <><h3>Decisions so far</h3>{rows(detail.decisions).map((decision, index) => <article className="connected-review-item" key={string(decision.id, String(index))}><div className="connected-review-item-header"><strong>{statusText(decision.decision)}</strong><span className="connected-review-meta">{timestamp(decision.created_at)}</span></div><p className="connected-review-meta">{decision.actor_id === actorId ? 'You' : (() => { const at = steps.findIndex(step => step.id === decision.step_id); return at >= 0 ? approvalLevelName(at, levelLabels[at]) : 'Approver'; })()}</p>{decision.comment ? <p>{string(decision.comment)}</p> : null}</article>)}</>}
        </details>
        {canDecide ? <section className="connected-review-section connected-review-actions">
          <h3>Your decision</h3><p className="platform-muted">The traveler gets a message as soon as you decide.</p>
          <label htmlFor="decision-comment">Note to the traveler <span className="platform-muted">(say what to fix if you send it back)</span></label><Textarea id="decision-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} disabled={busy} rows={3}/>
          <div className="platform-actions"><Button disabled={busy} onClick={() => void decide('approved')}>{busy ? 'Saving…' : 'Approve'}</Button><Button disabled={busy} variant="outline" onClick={() => void decide('changes_requested')}>Send back for changes</Button><Button disabled={busy} variant="outline" onClick={() => void decide('rejected')}>Don’t approve</Button></div>
        </section> : <p className="platform-muted">{selected.status !== 'in_review' ? `This request is ${statusText(selected.status).toLowerCase()}.` : current?.assignee_id === actorId && current.required_role !== role ? 'Your role in this workspace doesn’t match this step. Ask your admin.' : supported ? 'Someone else decides this step.' : 'This request uses an older form and can’t be decided here.'}</p>}
        {!busy && <Button variant="ghost" onClick={() => void open(selected)}>Refresh</Button>}
      </> : <Button variant="outline" onClick={() => void open(selected)}>Retry loading submission</Button>}
    </div>}
  </>;
}
