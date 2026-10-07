'use client';
import {authorizationBudget} from '@/packages/domain/authorization-budget';
import {InboxLink} from '@/components/inbox/inbox-link';
import Link from 'next/link';

import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {ArrowLeft,ArrowRight,BedDouble,Bus,Car,Check,FileText,Fuel,KeyRound,Luggage,Plane,Plus,Receipt,SquareParking,Trash2,Utensils} from 'lucide-react';
import {z} from 'zod';
import {usePlatform,SyncIndicator} from '@/components/platform/provider';
import {Button} from '@/components/ui/button';
import {ReceiptIntake} from './receipt-intake';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import type {Command,Entity,PayloadOf} from '@/packages/contracts';
import {planningModuleSchema,PLANNING_SCHEMA_VERSION,parseAmountMinor,travelCategories,type PlannedExpense} from '@/packages/contracts/planning-module';
import {voucherModuleSchema,voucherResolutionSchema,VOUCHER_MODULE_SCHEMA_VERSION} from '@/packages/contracts/voucher-module';
import {approvedTravel,reconcileStoredExpenses,suggestReceiptAllocation,type ApprovedRevision,type Resolution,type Reconciliation} from '@/packages/domain/voucher-adapter';
import {receiptCurrencies,parseReceiptAmount,receiptAmountText,formatReceiptAmount,originalReceiptSchema,convertedBreakdown,type ReceiptCurrency} from '@/packages/contracts/expense-currency';
import {validateExchangeRates,editPlanningAmount,changePlanningCurrency,type ExchangeRates} from '@/packages/domain/exchange-rates';
import type {VerificationReport} from '@/packages/domain/voucher-verification';
import {PlanningHotelFinder} from './planning-hotel-finder';
import {RentalCarFinder} from './rental-car-finder';
import type {RentalLocation} from '@/packages/domain/rental-car';
import {FlightSuggestions,type SelectedFlight} from './flight-suggestions';
import {ApprovalTracker,WaitingForApprovers} from './approval-tracker';
import {PlaceField} from './place-field';
import {TripEditor} from './trip-editor';
import {TravelModeField} from './travel-mode-field';
import {DescriptionField} from './description-field';
import {isListedDescription,MILEAGE_DESCRIPTION} from '@/packages/domain/expense-descriptions';
import {hotelAtRate,inGsaLocality,lodgingOverage} from '@/packages/domain/lodging-aea';
import {LodgingAeaCard} from './lodging-aea-card';
import {isNonconventionalLodging,preAuditProblem,relevantPreAudit,type PreAudit} from '@/packages/domain/pre-audit';
import {DtsChecksCard} from './dts-checks-card';
import {DemoApprove} from './demo-approve';
import {AmendmentBanner,ChangeTrip} from './amendment';
import {TripTimeline} from './trip-timeline';
import './trip-sheet.css';
import './authorization-form.css';
import {AuthorizationSummary} from './authorization-summary';
import {MealsEstimate} from './meals-estimate';
import {PlannedCosts} from './planned-costs';
import {voucherDocuments} from '@/packages/domain/voucher-documents';
import {VoucherDocumentsCard} from './voucher-documents-card';
import {usePersonalState} from '@/components/platform/personal-state';
import type {TravelMode} from '@/packages/domain/travel-mode';
import type {FlightOption} from '@/packages/domain/flight-search';
const originKey='ouranos.travel.origin',travelerKey='ouranos.travel.traveler',paymentKey='ouranos.travel.payment';
const remembered=(key:string)=>{try{return localStorage.getItem(key)||''}catch{return ''}};
const remember=(key:string,value:string)=>{try{localStorage.setItem(key,value)}catch{/* Browser storage may be off; nothing to remember then. */}};
/** Most people pay with their travel card, so that's the default until they pick otherwise. */
const usualPayment=(saved?:unknown):'gtcc'|'personal'=>saved==='personal'||(!saved&&remembered(paymentKey)==='personal')?'personal':'gtcc';
import type {HotelProperty} from '@/packages/domain/hotel-discovery';
import {TravelPackagePanel} from './package-panel';
import {assessReceipt} from '@/voucher/src/receiptValidity.js';
import type {LocalRecord} from '@/packages/offline/database';

type Platform=ReturnType<typeof usePlatform>;
type Module='planning'|'vouchers';
type Category=typeof travelCategories[number];
const categoryLabels:Record<Category,string>={airfare:'Airfare',lodging:'Lodging',rental_car:'Rental car',fuel:'Fuel',meals:'Meals & incidentals',parking:'Parking',ground_transport:'Ground transport',baggage:'Baggage',other:'Other'};
const money=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(minor/100);
const dollars=(minor:unknown)=>typeof minor==='number'?(minor/100).toFixed(2):'';
const text=(value:unknown)=>typeof value==='string'?value:'';
const label=(value:string)=>value.replaceAll('_',' ');
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const displayDate=(value:unknown)=>text(value)?new Date(`${value}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const editable=(row?:LocalRecord)=>!row||['draft','changes_requested','needs_action'].includes(row.server?.status||row.local.status);
const recent=(rows:LocalRecord[],kind:string,tripId:string)=>rows.filter(r=>r.kind===kind&&r.local.tripId===tripId).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0];
/** Plain-language names for form fields the validator can reject. */
function issueText(issue:z.ZodIssue){
 const [field,index,sub]=issue.path;
 if(field==='traveler')return 'Enter the traveler’s name.';
 if(field==='origin')return 'Choose your starting city and state.';
 if(field==='approvedExpenseItems'&&typeof index==='number'){const n=index+1;return sub==='authorizedAmountMinor'?`Enter a planned amount for expense ${n}.`:sub==='description'?`Add a description for expense ${n}.`:`Check the details of expense ${n}.`}
 if(field==='approvedExpenseItems')return 'Add at least one planned expense.';
 return issue.message;
}
function message(error:unknown){return error instanceof z.ZodError?error.issues.map(issueText).filter((v,i,a)=>a.indexOf(v)===i).join(' '):error instanceof Error?error.message:'Unable to complete this action. Please try again.'}
/** What is missing from a plan, in the order it appears on the page. */
/** An icon per kind of cost, so a list of costs can be scanned at a glance. */
const COST_ICONS:Record<string,typeof Plane>={airfare:Plane,lodging:BedDouble,rental_car:KeyRound,fuel:Fuel,meals:Utensils,parking:SquareParking,ground_transport:Car,transport:Bus,baggage:Luggage,other:Receipt};
type QuickCost='flight'|'hotel'|'rental'|'parking'|'other';
const QUICK_COSTS:Array<{id:QuickCost;label:string;category:Category;description:string}>=[
 {id:'flight',label:'Flight',category:'airfare',description:'Round-trip flight'},
 {id:'hotel',label:'Hotel',category:'lodging',description:'Hotel'},
 {id:'rental',label:'Rental car',category:'rental_car',description:'Rental Car - at TDY Area'},
 {id:'parking',label:'Parking',category:'parking',description:'Parking - TDY Area'},
 {id:'other',label:'Other',category:'other',description:''},
];
/** Glide to a section that just opened, briefly highlight it, and put the cursor in its first field, so it doesn't just appear somewhere below. */
function bringIntoView(id:string,focus='input:not([type=hidden]):not([disabled]),select,textarea'){
 // A short timer (not an animation frame) so it also runs while the tab is in the background.
 window.setTimeout(()=>{
  const target=document.getElementById(id);if(!target)return;
  const still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({behavior:still||document.visibilityState!=='visible'?'auto':'smooth',block:'start'});
  // Some browsers skip smooth scrolling; if it didn't arrive, jump there.
  window.setTimeout(()=>{if(Math.abs(target.getBoundingClientRect().top)>160)target.scrollIntoView({block:'start'})},900);
  target.classList.remove('cw-arrived');void target.offsetWidth;target.classList.add('cw-arrived');
  window.setTimeout(()=>target.classList.remove('cw-arrived'),1800);
  const field=target.querySelector<HTMLElement>(focus);(field??target).focus({preventScroll:true});
 },60);
}
const amountMinorOrNull=(value:string)=>{try{return parseAmountMinor(value)}catch{return null}};
function planProblems(traveler:string,origin:string,items:Array<{amount:string;currency:string;usdAmount:string}>){
 const problems=[!traveler.trim()&&'Enter the traveler’s name.',!origin.trim()&&'Choose your starting city and state.',!items.length&&'Add at least one cost, like your flight or hotel.'];
 items.forEach((item,i)=>{const amount=(item.currency==='USD'?item.amount:item.usdAmount).trim();problems.push(!item.amount.trim()?`Enter a planned amount for expense ${i+1}.`:amount&&!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)?`Expense ${i+1}: use an amount like 355.00.`:!amount?`Expense ${i+1}: exchange rates are still loading; try again in a moment.`:false)});
 return problems.filter(Boolean).join(' ');
}
function useFeedback(){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');const active=useRef(false);
 async function run(name:string,fn:()=>Promise<string|void>){if(active.current)return;active.current=true;setBusy(name);setError('');setNotice('');try{const result=await fn();if(result)setNotice(result)}catch(e){setError(message(e))}finally{active.current=false;setBusy('')}}
 return {busy,error,notice,run,setError,setNotice};
}
function useUnsaved(dirty:boolean){useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])}
function Feedback({error,notice}:{error:string;notice:string}){return <>{error&&<p className="cw-feedback cw-error" role="alert">{error}</p>}{notice&&<p className="cw-feedback cw-notice" role="status">{notice}</p>}</>}
function Field({label:caption,children,className=''}:{label:string;children:ReactNode;className?:string}){return <label className={`cw-field ${className}`}><span>{caption}</span>{children}</label>}
function Categories(){return travelCategories.map(c=><option key={c} value={c}>{categoryLabels[c]}</option>)}
function Status({value}:{value:string}){const name=label(value);return <span className={`cw-status cw-status-${value}`}>{name.charAt(0).toUpperCase()+name.slice(1)}</span>}
async function deviceId(p:Platform){const db=p.repository!.db;return db.transaction('rw',db.meta,async()=>{const saved=(await db.meta.get('deviceId'))?.value;if(saved)return saved;const id=crypto.randomUUID();await db.meta.put({key:'deviceId',value:id});return id})}
async function readyToSubmit(p:Platform,tripId:string){
 if(!p.client||!p.engine||!p.repository||!p.organizationId)throw new Error('Connect your workspace before continuing.');
 await p.engine.sync();
 const pending=await p.repository.db.outbox.toArray();
 if(pending.some(q=>q.command.entityId===tripId||record(q.command.payload).tripId===tripId))throw new Error('Some trip changes are still on this device. Sync them before submitting. Check workspace settings if a change needs attention.');
}
/** Ask the server to send a submission that was waiting for approvers; quietly does nothing until they exist. */
async function routeWaiting(p:Platform,id:string){
 if(!p.client||!p.engine||!p.organizationId)return false;
 try{
  const {entity}=await p.client.get('authorization',id,p.organizationId);if(entity.status!=='in_review')return false;
  const result=await p.client.command({type:'authorization.submit',commandId:crypto.randomUUID(),organizationId:p.organizationId,deviceId:await deviceId(p),entityId:id,expectedVersion:entity.version,schemaVersion:1,payload:{}});
  if(!result.ok)return false;await p.engine.merge(result.entity);return true;
 }catch{return false}
}
async function onlineCommand(p:Platform,type:'authorization.submit'|'authorization.amend'|'voucher.submit'|'document.confirm'|'document.reprocess',id:string,payload:Record<string,unknown>={}){
 if(!p.client||!p.repository||!p.engine||!p.organizationId)throw new Error('A connection to your workspace is required.');
 const kind=type.startsWith('authorization')?'authorization':type.startsWith('voucher')?'voucher':'document';
 if(await p.repository.db.outbox.where('entityKey').equals(`${kind}:${id}`).count())throw new Error('Sync this record’s pending changes first.');
 const {entity}=await p.client.get(kind,id,p.organizationId);
 // A response can be lost after a successful submission. Reading its current
 // state avoids saving over it or submitting the same revision twice.
 if((type.endsWith('.submit')&&['in_review','approved','verified','needs_action'].includes(entity.status))||(type==='document.confirm'&&entity.status==='ready')){await p.engine.merge(entity);return entity}
 const key=`online:${type}:${id}:${entity.version}${type==='authorization.amend'?`:${JSON.stringify(payload)}`:''}`;let saved=(await p.repository.db.meta.get(key))?.value;
 if(!saved){const command:Command={type,commandId:crypto.randomUUID(),organizationId:p.organizationId,deviceId:await deviceId(p),entityId:id,expectedVersion:entity.version,schemaVersion:1,payload} as Command;saved=JSON.stringify(command);await p.repository.db.meta.put({key,value:saved})}
 const result=await p.client.command(JSON.parse(saved));if(!result.ok)throw new Error(result.error.message);
 await p.engine.merge(result.entity);await p.engine.sync();return result.entity;
}
async function stageMessage(p:Platform,id:string,kind:string){await p.engine?.sync();const pending=await p.repository!.db.outbox.where('entityKey').equals(`${kind}:${id}`).count();return pending?'Saved on this device.':'Saved.'}

function subscribeLocation(callback:()=>void){window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback)}
const currentTripId=()=>new URLSearchParams(window.location.search).get('tripId')||'';
export function ConnectedWorkflow({module}:{module:Module}){
 const p=usePlatform();const tripId=useSyncExternalStore(subscribeLocation,currentTripId,()=>null);
 return <main className="quiet-page cw-page"><header className="quiet-header"><Link href="/dashboard" className="quiet-brand">Ouranos</Link><nav className="inbox-header-actions" aria-label="Workspace"><InboxLink/><Link className="cw-workspace-link" href="/dashboard/platform">Settings</Link></nav></header>
  {tripId===null||!p.repository||p.repository.organizationId!==p.organizationId?<section className="cw-shell"><p className="cw-muted">{p.loading||p.organizationId?'Opening your workspace…':'Choose an organization in workspace settings to continue.'}</p></section>:<WorkflowLoader key={`${p.repository.db.name}:${tripId}:${module}`} module={module} tripId={tripId}/>}
  <footer className="cw-footer"><span/><SyncIndicator/></footer>
 </main>;
}
function WorkflowLoader({module,tripId}:{module:Module;tripId:string}){
 const p=usePlatform();const rows=useLiveQuery<LocalRecord[]>(()=>p.repository!.db.entities.toArray(),[p.repository]);const [hydrated,setHydrated]=useState(!p.configured);
 useEffect(()=>{let active=true;if(p.engine)void p.engine.sync().then(()=>{if(active)setHydrated(true)});return()=>{active=false}},[p.engine]);
 if(!rows||!hydrated)return <section className="cw-shell"><p className="cw-muted" role="status">Loading your saved travel…</p></section>;
 const trip=rows.find(r=>r.kind==='trip'&&r.id===tripId)?.local;
 if(trip?.status==='cancelled')return <section className="cw-shell"><h1>Draft deleted</h1><Link href="/dashboard/travel">Restore it from Deleted drafts in Travel.</Link></section>;
 if(!trip)return <section className="cw-shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={14}/> Back</Link><h1>{module==='planning'?'Plan your travel':'Prepare your voucher'}</h1><p className="cw-muted">{tripId?'This trip is not available in this workspace.':'Choose a saved trip to continue.'}</p><div className="cw-trip-list">{rows.filter(r=>r.kind==='trip'&&r.local.status!=='cancelled').map(r=><Link key={r.id} href={`/dashboard/travel/${module}?tripId=${r.id}`}><div><strong>{text(r.local.data.destination)}</strong><span>{displayDate(r.local.data.departure)} — {displayDate(r.local.data.returnDate)}</span></div><ArrowRight size={18}/></Link>)}</div><Button asChild><Link href="/dashboard/travel/new">New trip <Plus size={16}/></Link></Button>{p.sync.message&&<p className="cw-muted">{p.sync.message}</p>}</section>;
 return <section className={`cw-shell cw-sheet ${module==='planning'?'cw-authorization':''}`}><Link href="/dashboard/travel" className="back-link"><ArrowLeft size={14}/> Your trips</Link><TripTimeline trip={trip} rows={rows} page={module}/>
 <div className="cw-heading"><div><h1>{text(trip.data.destination)||(module==='planning'?'Authorization':'Voucher')}</h1><p className="cw-sheet-subtitle">{module==='planning'?'Travel authorization':'Travel voucher'}{text(trip.data.installation)?` · ${text(trip.data.installation)}`:''}</p>{module==='planning'?<TripEditor trip={trip} editable={!rows.some(r=>r.kind==='authorization'&&r.local.tripId===trip.id&&['in_review','approved'].includes(r.server?.status||r.local.status))}/>:<p className="cw-muted">{displayDate(trip.data.departure)} — {displayDate(trip.data.returnDate)}</p>}</div></div>
 {module==='planning'?<PlanningForm trip={trip} rows={rows}/>:<VoucherGate trip={trip} rows={rows}/>}</section>;
}

type BudgetDraft={hint?:string;id:string;category:Category;description:string;amount:string;currency:ReceiptCurrency;usdAmount:string;conversionNote:string;merchant:string;payment:''|'gtcc'|'personal';date:string;startDate:string;endDate:string};
function budgetDraft(item?:PlannedExpense):BudgetDraft{return {id:item?.id||crypto.randomUUID(),category:item?.category||'airfare',description:item?.description||'',amount:item?.originalEstimate?receiptAmountText(item.originalEstimate.amountMinor,item.originalEstimate.currency):item?dollars(item.authorizedAmountMinor):'',currency:(item?.originalEstimate?.currency||'USD') as ReceiptCurrency,usdAmount:item?.originalEstimate?dollars(item.authorizedAmountMinor):'',conversionNote:item?.originalEstimate?.conversionNote||'',merchant:item?.merchant||'',payment:item?.expectedPaymentMethod||'',date:item?.date||'',startDate:item?.startDate||'',endDate:item?.endDate||''}}
function PlanningForm({trip,rows}:{trip:Entity;rows:LocalRecord[]}){
 const p=usePlatform(),feedback=useFeedback();
 const {state:preferences,update:updatePreferences}=usePersonalState<{traveler?:string;origin?:string;paymentMethod?:'gtcc'|'personal'}>('preferences',{});
 const [initial]=useState(()=>recent(rows,'authorization',trip.id));const [id]=useState(()=>initial?.id||crypto.randomUUID());
 const parsed=planningModuleSchema.safeParse(initial?.local.data.formData);
 const [traveler,setTraveler]=useState(()=>parsed.success?parsed.data.traveler:remembered(travelerKey)),[origin,setOrigin]=useState(()=>{if(parsed.success)return parsed.data.origin;try{return localStorage.getItem(originKey)||''}catch{return ''}});
 const travelerValue=traveler||preferences.traveler||'',originValue=origin||preferences.origin||'';
 const [items,setItems]=useState<BudgetDraft[]>(()=>parsed.success?parsed.data.approvedExpenseItems.map(budgetDraft):[]);
 const [flight,setFlight]=useState<SelectedFlight|null>(null),flightItem=useRef<string|null>(null);
 const [travelMode,setTravelMode]=useState<TravelMode|undefined>(()=>parsed.success?(parsed.data.travelMode??(parsed.data.approvedExpenseItems.some(i=>i.category==='airfare')?'air':undefined)):undefined);
 const [mileage,setMileage]=useState(()=>({miles:parsed.success&&parsed.data.mileage?String(parsed.data.mileage.miles):'',rate:parsed.success&&parsed.data.mileage?(parsed.data.mileage.centsPerMile/100).toFixed(2):''})),mileageItem=useRef<string|null>(null);
 const [allowance,setAllowance]=useState(()=>parsed.success&&parsed.data.allowance?parsed.data.allowance:{enabled:false,governmentMess:false,mealsProvided:{}});
 const [aea,setAea]=useState(()=>parsed.success?parsed.data.aeaJustification??'':'');
 const [preAudit,setPreAudit]=useState<PreAudit>(()=>parsed.success?parsed.data.preAudit??{}:{});
 const [amendment]=useState(()=>parsed.success?parsed.data.amendment:undefined);
 const [rates,setRates]=useState<ExchangeRates|null>(null),[rateError,setRateError]=useState(''),[rateReload,setRateReload]=useState(0);
 useEffect(()=>{let active=true;const abort=new AbortController();void fetch('/api/exchange-rates',{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error('Exchange rates unavailable.');return validateExchangeRates(await response.json())}).then(value=>{if(active){setRates(value);setRateError('');setItems(current=>current.map(item=>item.currency!=='USD'&&!item.usdAmount?{...item,...editPlanningAmount(item,item.amount,value)}:item))}}).catch(()=>{if(active)setRateError('Exchange rates are unavailable. USD still works; retry to convert currencies.')});return()=>{active=false;abort.abort()}},[rateReload]);
 const [dirty,setDirty]=useState(false);const baselineVersion=useRef(initial?.local.version||0);useUnsaved(dirty);
 const row=rows.find(r=>r.id===id&&r.kind==='authorization'),locked=!editable(row);
 const approval=rows.filter(r=>r.kind==='approval'&&r.local.data.entityId===id).sort((a,b)=>b.local.updatedAt.localeCompare(a.local.updatedAt))[0]?.local;
 const unsupported=Boolean(initial&&initial.local.data.formSchemaVersion!==PLANNING_SCHEMA_VERSION);
 const tripDates={destination:text(trip.data.destination),departure:text(trip.data.departure),returnDate:text(trip.data.returnDate)};
 const taxSeparate=inGsaLocality(tripDates);
 function addCost(kind:QuickCost){
  const preset=QUICK_COSTS.find(cost=>cost.id===kind)!,row:BudgetDraft={...budgetDraft(),category:preset.category,description:preset.description};
  if(kind==='hotel'){const cap=hotelAtRate(tripDates);if(cap)Object.assign(row,{amount:(cap.totalMinor/100).toFixed(2),hint:`Filled in at the lodging rate: ${money(cap.nightlyMinor)} × ${cap.nights} night${cap.nights===1?'':'s'}. Change it to your hotel’s price.`})}
  setItems(current=>[...current,row]);setDirty(true);
  bringIntoView(`cost-${row.id}`,'input[placeholder="0.00"]');
 }
 // A blank airfare line (every new plan starts with one) isn't a flight yet, so it doesn't raise flight questions.
 const checkedItems=items.filter(item=>item.category!=='airfare'||item.amount.trim()||/\bTMC\b/i.test(item.description));
 const overage=lodgingOverage(tripDates,items.flatMap(item=>{const minor=amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount);return minor===null?[]:[{category:item.category,description:item.description,authorizedAmountMinor:minor,...(item.startDate&&item.endDate?{startDate:item.startDate,endDate:item.endDate}:{})}]}));
 const outsideTrip=items.some(item=>[item.date,item.startDate,item.endDate].some(date=>date&&(date<text(trip.data.departure)||date>text(trip.data.returnDate))));
 const total=items.reduce<number|null>((sum,item)=>{if(sum===null)return null;if(!item.amount.trim())return sum;try{return sum+parseAmountMinor(item.currency==='USD'?item.amount:item.usdAmount)}catch{return null}},0);
 const budget=authorizationBudget(tripDates,{allowance,approvedExpenseItems:items.map(item=>({category:item.category,authorizedAmountMinor:amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount)??0}))});
 const status=row?.server?.status||row?.local.status||'draft';
 // A plan submitted before approvers were set is sent to S1 once they exist.
 const waiting=p.approvalMode==='required'&&status==='in_review'&&!approval&&Boolean(row?.server);
 useEffect(()=>{if(!waiting)return;let active=true;void routeWaiting(p,id).then(routed=>{if(active&&routed)void p.engine?.sync()});return()=>{active=false}},[waiting]);// eslint-disable-line react-hooks/exhaustive-deps
 function updateItem(index:number,patch:Partial<BudgetDraft>){setItems(current=>current.map((item,i)=>i===index?{...item,...patch}:item));setDirty(true)}
 function changeCurrency(index:number,currency:ReceiptCurrency){try{updateItem(index,changePlanningCurrency(items[index],currency,rates));feedback.setError('')}catch(error){feedback.setError(message(error))}}
 /** A hotel picked from the finder inside a hotel cost fills in that cost's hotel and stay dates; the amount stays the traveler's. */
 function selectHotelFor(itemId:string,property:HotelProperty){
  setItems(current=>current.map(item=>item.id!==itemId?item:{...item,merchant:property[0],description:!item.description.trim()||item.description==='Hotel'?property[0]:item.description,startDate:item.startDate||text(trip.data.departure),endDate:item.endDate||text(trip.data.returnDate),hint:`Picked ${property[0]}. Change the amount to its nightly price × nights.`}));
  setDirty(true);feedback.setError('');
 }

 function selectRentalFor(itemId:string,location:RentalLocation){
  setItems(current=>current.map(item=>item.id!==itemId?item:{...item,merchant:location.company,description:!item.description.trim()||item.description==='Rental car'?`${location.company} rental car`:item.description,startDate:item.startDate||text(trip.data.departure),endDate:item.endDate||text(trip.data.returnDate),hint:`Picked ${location.company}${location.branch?` · ${location.branch}`:''}. Enter the rate you’re quoted for a compact car for your dates.`}));
  setDirty(true);feedback.setError('');
 }

/** Not flying: an untouched airfare row becomes the cost that fits how the traveler is getting there. */
 function chooseTravelMode(mode:TravelMode){
  setTravelMode(mode);setDirty(true);if(mode==='air')return;
  const category:Category|null=mode==='pov'?'ground_transport':mode==='rental'?'rental_car':null;
  setItems(current=>current.map(item=>item.category==='airfare'&&!item.amount.trim()&&!item.merchant.trim()?(category?{...item,category}:{...item,category:'other'}):item));
 }
 function addMileage(minor:number){
  const miles=mileage.miles.trim(),description=`${MILEAGE_DESCRIPTION} · ${miles} miles round trip`;
  setItems(current=>{
   const index=current.findIndex(item=>item.id===mileageItem.current)>=0?current.findIndex(item=>item.id===mileageItem.current):current.findIndex(item=>item.category==='ground_transport'&&!item.amount.trim());
   const base=index>=0?current[index]!:budgetDraft();
   const row:BudgetDraft={...base,category:'ground_transport',currency:'USD',usdAmount:'',conversionNote:'',amount:(minor/100).toFixed(2),description,payment:base.payment||'personal'};
   mileageItem.current=row.id;
   return index>=0?current.map((item,i)=>i===index?row:item):current.length>=100?current:[...current,row];
  });
  setDirty(true);feedback.setError('');feedback.setNotice('Mileage added to planned costs. Adjust it if needed.');
 }
 function addRental(){
  setItems(current=>{
   const next=[...current],has=(c:Category)=>next.some(item=>item.category===c);
   if(!has('rental_car'))next.push({...budgetDraft(),category:'rental_car',description:'Rental car'});
   if(!has('fuel'))next.push({...budgetDraft(),category:'fuel',description:'Rental car fuel'});
   return next.slice(0,100);
  });
  setDirty(true);feedback.setError('');feedback.setNotice('Rental car and fuel lines added. Enter their amounts below.');
 }
 /** Fill the row this picker filled before, else an empty airfare row, else add one. Other airfare stays untouched. */
 function selectFlight(value:SelectedFlight|null){
  setFlight(value);if(!value)return;const option:FlightOption=value.option;
  setItems(current=>{
   const index=current.findIndex(item=>item.id===flightItem.current)>=0?current.findIndex(item=>item.id===flightItem.current):current.findIndex(item=>item.category==='airfare'&&!item.amount.trim()&&!item.merchant.trim());
   const base=index>=0?current[index]!:budgetDraft();
   const selected:BudgetDraft={...base,category:'airfare',currency:'USD',usdAmount:'',conversionNote:'',amount:option.price.toFixed(2),merchant:option.airline,description:`${option.airline} ${option.roundTrip?'round trip':'one way'} · ${option.departAirport} to ${option.arriveAirport}`.slice(0,250),date:text(trip.data.departure)};
   flightItem.current=selected.id;
   return index>=0?current.map((item,i)=>i===index?selected:item):current.length>=100?current:[...current,selected];
  });
  setDirty(true);feedback.setError('');feedback.setNotice(`${option.airline} flight added to planned airfare. Adjust the amount if needed.`);
 }
 async function save(){
  const problems=planProblems(travelerValue,originValue,items);if(problems)throw new Error(problems);remember(travelerKey,travelerValue.trim());updatePreferences(current=>({...current,traveler:travelerValue.trim(),origin:originValue.trim()}));
  const current=await p.repository!.db.entities.get(`authorization:${id}`);if(!editable(current))throw new Error('This plan has already been submitted. Refresh to see its review status.');
  if((current?.local.version||0)!==baselineVersion.current)throw new Error('This plan changed in another session. Your edits are still here; reload to review the newer version before saving.');
  const normalized=items.map(item=>item.currency!=='USD'&&!item.usdAmount?{...item,...editPlanningAmount(item,item.amount,rates)}:item);
  const miles=Number(mileage.miles),centsPerMile=Math.round(Number(mileage.rate)*100);
  const form=planningModuleSchema.parse({traveler:travelerValue,origin:originValue,...(travelMode?{travelMode}:{}),...(travelMode==='pov'&&miles>0&&centsPerMile>0?{mileage:{miles,centsPerMile}}:{}),currency:'USD',allowance:{...allowance,mealsProvided:Object.fromEntries(Object.entries(allowance.mealsProvided).filter(([date])=>date>=text(trip.data.departure)&&date<=text(trip.data.returnDate)))},...(amendment?{amendment}:{}),...(overage&&aea.trim()?{aeaJustification:aea.trim()}:{}),...(relevantPreAudit(checkedItems,preAudit)?{preAudit:relevantPreAudit(checkedItems,preAudit)}:{}),approvedExpenseItems:normalized.map(item=>({id:item.id,category:item.category,description:item.description.trim()||categoryLabels[item.category],authorizedAmountMinor:parseAmountMinor(item.currency==='USD'?item.amount:item.usdAmount),...(item.currency!=='USD'?{originalEstimate:{currency:item.currency,amountMinor:parseReceiptAmount(item.amount,item.currency),conversionNote:item.conversionNote}}:{}),...(item.merchant?{merchant:item.merchant}:{}),...(item.payment?{expectedPaymentMethod:item.payment}:{}),...(item.date?{date:item.date}:{}),...(item.startDate||item.endDate?{startDate:item.startDate,endDate:item.endDate}:{} )}))});
  await p.repository!.stage('authorization.save',id,{tripId:trip.id,formSchemaVersion:PLANNING_SCHEMA_VERSION,formData:form});baselineVersion.current=(await p.repository!.db.entities.get(`authorization:${id}`))!.local.version;setDirty(false);return stageMessage(p,id,'authorization');
 }
 async function submit(){
  const flagged=preAuditProblem(checkedItems,preAudit);if(flagged)throw new Error(flagged);
  if(overage&&!aea.trim())throw new Error('Your hotel is over the per diem lodging rate. Add the justification for your approver before submitting.');
  if(overage&&/\[[^\]]*\]/.test(aea))throw new Error('Fill in the parts in [brackets] in your hotel justification before submitting.');
  if(dirty||!row)await save();if(p.approvalMode==='preview'){await readyToSubmit(p,trip.id);window.location.assign(`/dashboard/travel/vouchers?tripId=${trip.id}`);return}await readyToSubmit(p,trip.id);const result=await onlineCommand(p,'authorization.submit',id);setDirty(false);
  // Take the traveler to their confirmation, which holds the submitted details.
  if(result.status==='in_review'){await p.engine?.sync();window.location.assign(`/dashboard/inbox?authorization=${id}`);return 'Submitted. Opening your inbox…'}
  return result.status==='approved'?(p.approvalMode==='automatic'?'Plan verified by Ouranos. You can now prepare your voucher.':'This plan is approved.'):'Submitted for review. Your confirmation is in Inbox.';
 }
 if(unsupported)return <div className="cw-card"><h2>A different planning form is attached.</h2><p className="cw-muted">This saved authorization uses an older or partner form. Its data has been preserved.</p><Link href="/dashboard/platform">Return to workspace</Link></div>;
 return <><div className="cw-section-heading"><h2>Travel details</h2><Status value={status}/></div>
 {amendment&&status!=='approved'&&<AmendmentBanner amendment={amendment} status={status} current={{...tripDates,purpose:text(trip.data.purpose),...(text(trip.data.installation)?{installation:text(trip.data.installation)}:{}),items:items.flatMap(item=>{const minor=amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount);return minor===null?[]:[{id:item.id,category:item.category,description:item.description.trim()||categoryLabels[item.category],authorizedAmountMinor:minor}]})}}/>}
 {status==='approved'&&p.approvalMode!=='preview'&&<ChangeTrip onStart={async reason=>{await onlineCommand(p,'authorization.amend',id,{reason});window.location.reload()}}/>}
 {locked&&status!=='in_review'&&<div className="cw-banner"><Check size={18}/><div><strong>{status==='approved'&&p.approvalMode==='automatic'?'Verified by Ouranos.':status==='approved'?'Approved.':status==='in_review'?'In review.':'This revision is closed.'}</strong><p>{status==='approved'&&p.approvalMode==='automatic'?'Internal checks passed.':''}</p></div>{status==='approved'&&<Link href={`/dashboard/travel/vouchers?tripId=${trip.id}`}>Open voucher <ArrowRight size={16}/></Link>}</div>}
 {p.approvalMode==='required'&&status!=='approved'&&(approval&&!(amendment&&approval.status==='approved')?<ApprovalTracker request={approval}/>:status==='in_review'&&row?.server&&<WaitingForApprovers/>)}{p.approvalMode==='required'&&status==='in_review'&&row?.server&&<DemoApprove authorizationId={id} tripId={trip.id}/>}
 <form onSubmit={e=>{e.preventDefault();void feedback.run('save',save)}}><fieldset disabled={locked||!!feedback.busy} className="cw-fieldset"><div className="cw-card cw-grid"><Field label="Traveler name"><Input value={travelerValue} onChange={e=>{setTraveler(e.target.value);setDirty(true);remember(travelerKey,e.target.value)}} autoComplete="name" maxLength={200} required/></Field><PlaceField id="origin" label="Starting location" variant="plan" value={originValue} onChange={value=>{setOrigin(value);setDirty(true);try{localStorage.setItem(originKey,value)}catch{}}}/><div className="cw-span-full cw-purpose"><span>Purpose</span><p>{text(trip.data.purpose)}</p></div></div>
 <TravelModeField mode={travelMode} onMode={chooseTravelMode} miles={mileage.miles} rate={mileage.rate} onMileage={patch=>{setMileage(m=>({...m,...patch}));setDirty(true)}} onAddMileage={addMileage} onAddRental={addRental} disabled={locked||!!feedback.busy}/>
 {travelMode==='air'&&<FlightSuggestions from={origin} to={text(trip.data.destination)} departure={text(trip.data.departure)} returnDate={text(trip.data.returnDate)} selected={flight} onSelect={selectFlight} disabled={locked||!!feedback.busy}/>}
 <DtsChecksCard items={checkedItems} purpose={text(trip.data.purpose)} atInstallation={Boolean(text(trip.data.installation))} answers={preAudit} onAnswers={answers=>{setPreAudit(answers);setDirty(true)}} onAddLine={(category,description)=>{setItems(current=>current.length>=100?current:[...current,{...budgetDraft(),category,description}]);setDirty(true)}} taxSeparate={taxSeparate} locked={locked}/>
 <div className="authorization-expenses"><div id="cw-planned-expenses" tabIndex={-1} className="cw-section-heading"><div><h2>Planned expenses</h2></div><span className="authorization-expense-count">{items.length} {items.length===1?'expense':'expenses'}</span></div>
 <div className="authorization-expense-layout"><div className="authorization-expense-main">{!rates&&!rateError&&<p className="cw-muted" role="status">Loading exchange rates…</p>}{rateError&&<p className="cw-muted" role="status">{rateError} <button type="button" className="back-link" disabled={locked} onClick={()=>{setRateError('');setRateReload(n=>n+1)}}>Retry rates</button></p>}
 {outsideTrip&&!locked&&<p className="cw-muted" role="status">Some expense dates are outside your trip dates. Update them before submitting.</p>}<div className="cw-budget-list">{items.map((item,index)=><article className="cw-card cw-budget-item cw-cost" id={`cost-${item.id}`} key={item.id}><div className="cw-item-heading cw-cost-head">{(()=>{const Icon=COST_ICONS[item.category]??Receipt;return <span className="cw-cost-icon" aria-hidden="true"><Icon size={18}/></span>})()}<div className="cw-cost-title"><span className="cw-item-name">{item.description.trim()||categoryLabels[item.category]}</span><small>Cost {index+1} · {categoryLabels[item.category]}</small></div><strong className="cw-cost-amount">{amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount)!==null?money(amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount)!):'—'}</strong>{!locked&&<button className="cw-icon-button" type="button" aria-label={`Remove planned expense ${index+1}`} onClick={()=>{setItems(current=>current.filter(x=>x.id!==item.id));setDirty(true)}}><Trash2 size={16}/></button>}</div><div className="cw-grid"><Field label={`Amount · ${item.currency}`} className="cw-span-full"><Input value={item.amount} onChange={e=>updateItem(index,editPlanningAmount(item,e.target.value,rates))} placeholder="0.00" inputMode="decimal" required/></Field>{item.currency!=='USD'&&<p className="cw-muted cw-span-full" role="status" title={item.conversionNote}>{item.usdAmount?`≈ ${money(parseReceiptAmount(item.usdAmount,'USD'))} USD · exchange-rate estimate`:rates?'Enter an amount to calculate the USD estimate.':'Loading exchange rates…'}</p>}{item.hint&&<p className="cw-muted cw-span-full cw-item-hint">{item.hint}</p>}{item.category==='rental_car'&&!locked&&text(trip.data.destination)&&<div className="cw-span-full"><RentalCarFinder label={`Find a rental car near ${text(trip.data.destination)}`} destination={text(trip.data.destination)} onSelect={feedback.busy?undefined:location=>selectRentalFor(item.id,location)}/></div>}{item.category==='lodging'&&!/\btax(es)?\b/i.test(item.description)&&!locked&&<div className="cw-span-full"><PlanningHotelFinder label={`Find a hotel near ${text(trip.data.destination)}`} trip={{id:trip.id,destination:text(trip.data.destination),departure:text(trip.data.departure),returnDate:text(trip.data.returnDate),lodgingBudgetMinor:amountMinorOrNull(item.currency==='USD'?item.amount:item.usdAmount),budgetLabel:'Planned lodging budget'}} onSelectHotel={feedback.busy?undefined:property=>selectHotelFor(item.id,property)}/></div>}<details className="cw-disclosure cw-span-full" open={item.currency!=='USD'}><summary>More details</summary><div className="cw-grid"><Field label="Type"><select value={item.category} onChange={e=>updateItem(index,{category:e.target.value as Category,...(isListedDescription(item.category,item.description)?{description:''}:{})})}><Categories/></select></Field><Field label="Description · optional" className="cw-span-full"><DescriptionField key={item.category} category={item.category} value={item.description} onChange={description=>updateItem(index,{description})}/></Field><Field label="Currency"><select value={item.currency} onChange={e=>changeCurrency(index,e.target.value as ReceiptCurrency)} disabled={!!item.amount.trim()&&!rates}>{receiptCurrencies.map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></Field><Field label="Merchant · optional"><Input value={item.merchant} onChange={e=>updateItem(index,{merchant:e.target.value})} maxLength={200}/></Field><Field label="Expected payment"><select value={item.payment} onChange={e=>updateItem(index,{payment:e.target.value as BudgetDraft['payment']})}><option value="">No preference</option><option value="gtcc">GTCC</option><option value="personal">Personal</option></select></Field>{item.category==='lodging'?<><Field label="Check-in · optional"><Input type="date" min={text(trip.data.departure)} max={text(trip.data.returnDate)} value={item.startDate} onChange={e=>updateItem(index,{startDate:e.target.value})}/></Field><Field label="Check-out · optional"><Input type="date" min={item.startDate||text(trip.data.departure)} max={text(trip.data.returnDate)} value={item.endDate} onChange={e=>updateItem(index,{endDate:e.target.value})}/></Field></>:<Field label="Expense date · optional"><Input type="date" min={text(trip.data.departure)} max={text(trip.data.returnDate)} value={item.date} onChange={e=>updateItem(index,{date:e.target.value})}/></Field>}</div></details></div></article>)}</div>
 {!locked&&<p className="cw-quick-add-label" id="cw-quick-add-label">{items.length?'Add another cost':'Add your first cost'}</p>}{!locked&&<div className="cw-quick-add" role="group" aria-labelledby="cw-quick-add-label">{QUICK_COSTS.map(cost=><Button key={cost.id} type="button" variant="outline" onClick={()=>addCost(cost.id)} disabled={items.length>=100}><Plus size={15}/> {cost.label}</Button>)}</div>}</div><aside className="authorization-budget" aria-label="Travel budget"><MealsEstimate trip={tripDates} hasMealExpense={items.some(item=>item.category==='meals')} allowance={allowance} onChange={value=>{setAllowance(value);setDirty(true)}} locked={locked}/><AuthorizationSummary expensesMinor={budget.expensesMinor} mealsMinor={budget.mealsMinor} mealsIncluded={budget.mealsIncluded} totalMinor={total===null?null:budget.totalMinor}/></aside></div></div></fieldset>{overage&&<LodgingAeaCard overage={overage} value={aea} onChange={value=>{setAea(value);setDirty(true)}} locked={locked}/>}
 <Feedback error={feedback.error} notice={feedback.notice}/>{!locked&&<div className="cw-action-bar"><div></div><div className="cw-actions"><Button variant="outline" type="submit" disabled={!!feedback.busy}>{feedback.busy==='save'?'Saving…':'Save draft'}</Button><Button type="button" disabled={!!feedback.busy||!p.client||total===null} onClick={()=>void feedback.run('submit',submit)}>{feedback.busy==='submit'?'Checking…':p.approvalMode==='preview'?'Continue':p.approvalMode==='automatic'?'Verify plan':'Submit for review'}<ArrowRight size={16}/></Button></div></div>}</form>
 {status==='in_review'&&<p className="cw-muted cw-end-note"></p>}</>;
}

function VoucherGate({trip,rows}:{trip:Entity;rows:LocalRecord[]}){
 const p=usePlatform();const preview=p.approvalMode==='preview';
 const auth=rows.filter(r=>r.kind==='authorization'&&r.local.tripId===trip.id&&(preview?Boolean(r.server):r.server?.status==='approved')).sort((a,b)=>b.server!.updatedAt.localeCompare(a.server!.updatedAt))[0];
 if(!auth&&preview)return <><ReceiptInbox trip={trip} rows={rows}/><Button asChild variant="outline"><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Add travel plan <ArrowRight size={16}/></Link></Button></>;
 const changing=!auth&&rows.some(r=>r.kind==='authorization'&&r.local.tripId===trip.id&&record(r.local.data.formData).amendment);
 if(!auth)return <><div className="cw-card cw-empty"><FileText size={28}/><h2>{changing?'Your trip change is waiting for approval.':'Plan approval pending.'}</h2><p className="cw-muted">{changing?'The voucher opens again once your approvers approve the change. Your expenses and receipts are kept.':'You can collect receipts while waiting. Preparing the voucher still requires an approved plan.'}</p><Button asChild><Link href={`/dashboard/travel/planning?tripId=${trip.id}`}>Open travel plan <ArrowRight size={16}/></Link></Button></div><ReceiptInbox trip={trip} rows={rows}/></>;
 return <ApprovedVoucher key={`${auth.id}:${auth.server!.version}`} authorizationId={auth.id} trip={trip} rows={rows}/>;
}
function ApprovedVoucher({authorizationId,trip,rows}:{authorizationId:string;trip:Entity;rows:LocalRecord[]}){
 const p=usePlatform();const [revision,setRevision]=useState<ApprovedRevision|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;if(!p.client||!p.organizationId)return;void (p.approvalMode==='preview'?p.client.workingAuthorization(authorizationId,p.organizationId):p.client.approvedAuthorization(authorizationId,p.organizationId)).then(result=>{approvedTravel(result.revision);if(active)setRevision(result.revision)}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[authorizationId,p.client,p.organizationId,p.approvalMode,reload]);
 if(!revision)return <div className="cw-card"><p className={error?'cw-error':'cw-muted'} role={error?'alert':'status'}>{error||'Loading your travel plan…'}</p>{error&&<Button variant="outline" onClick={()=>{setError('');setReload(n=>n+1)}}>Try again</Button>}</div>;
 return <VoucherForm key={revision.id} trip={trip} rows={rows} revision={revision}/>;
}

type ExpenseDraft={id:string;version:number;authorizationItemId:string;merchant:string;date:string;amount:string;currency:ReceiptCurrency;usdAmount:string;usdBasis:'card_statement'|'documented_conversion';conversionNote:string;currencyCorrection:string;category:Category;paymentMethod:''|'gtcc'|'personal';description:string;documentIds:string[];startDate:string;endDate:string;taxes:string;fees:string;bookedOnline:boolean};
function expenseDraft(entity?:Entity):ExpenseDraft{const parsed=originalReceiptSchema.safeParse(entity?.data.originalReceipt),original=parsed.success?parsed.data:null;return {id:entity?.id||crypto.randomUUID(),version:entity?.version||0,authorizationItemId:text(entity?.data.authorizationItemId),merchant:text(entity?.data.merchant),date:text(entity?.data.incurredOn),amount:original?receiptAmountText(original.amountMinor,original.currency):entity?dollars(entity.data.amountMinor):'',currency:(original?.currency||'USD') as ReceiptCurrency,usdAmount:original?dollars(entity?.data.amountMinor):'',usdBasis:original?.usdBasis||'card_statement',conversionNote:original?.conversionNote||'',currencyCorrection:text(entity?.data.receiptCurrencyCorrection),category:(entity?.data.category==='transport'?'ground_transport':entity?.data.category||'other') as Category,paymentMethod:(entity?.data.paymentMethod||'') as ExpenseDraft['paymentMethod'],description:text(entity?.data.description),documentIds:Array.isArray(entity?.data.documentIds)?entity.data.documentIds as string[]:[],startDate:text(entity?.data.serviceStartDate),endDate:text(entity?.data.serviceEndDate),taxes:original?receiptAmountText(original.taxesMinor,original.currency):dollars(entity?.data.taxesMinor)||'',fees:original?receiptAmountText(original.feesMinor,original.currency):dollars(entity?.data.feesMinor)||'',bookedOnline:entity?.data.bookedOnline===true}}
function VoucherForm({trip,rows,revision}:{trip:Entity;rows:LocalRecord[];revision:ApprovedRevision}){
 const p=usePlatform(),feedback=useFeedback();const approved=planningModuleSchema.parse(revision.snapshot.entity.data.formData);
 const {state:preferences,update:updatePreferences}=usePersonalState<{traveler?:string;origin?:string;paymentMethod?:'gtcc'|'personal'}>('preferences',{});
 const [initial]=useState(()=>recent(rows,'voucher',trip.id));const [id]=useState(()=>initial?.id||crypto.randomUUID());const baselineVersion=useRef(initial?.local.version||0);const form=record(initial?.local.data.formData);
 const row=rows.find(r=>r.kind==='voucher'&&r.id===id),locked=!editable(row),status=row?.server?.status||row?.local.status||'draft';
 const expenses=rows.filter(r=>r.kind==='expense'&&r.local.tripId===trip.id).map(r=>r.local),documents=rows.filter(r=>r.kind==='document'&&r.local.tripId===trip.id).map(r=>r.local);
 const [included,setIncluded]=useState<string[]>(()=>Array.isArray(initial?.local.data.expenseIds)?initial.local.data.expenseIds as string[]:expenses.map(e=>e.id));
 const [resolutions,setResolutions]=useState<Record<string,Resolution>>(()=>record(form.resolutions) as Record<string,Resolution>),[certified,setCertified]=useState(form.certified===true),[intakeComplete,setIntakeComplete]=useState(form.intakeComplete===true),[dirty,setDirty]=useState(false);
 const [editor,setEditor]=useState<ExpenseDraft|null>(null),[reviewReceipt,setReviewReceipt]=useState<string|null>(null);
 const verificationKey=`${id}:${status}:${row?.server?.version||0}`;
 const [loadedVerification,setLoadedVerification]=useState<{key:string;report:VerificationReport}|null>(null);
 const verification=loadedVerification?.key===verificationKey?loadedVerification.report:null;
 useEffect(()=>{if(!['verified','needs_action'].includes(status)||!p.client||!p.organizationId)return;let active=true;const key=`${id}:${status}:${row?.server?.version||0}`;void p.client.voucherVerification(id,p.organizationId).then(value=>{if(active)setLoadedVerification({key,report:value.report})}).catch(()=>{if(active)setLoadedVerification(null)});return()=>{active=false}},[status,row?.server?.version,p.client,p.organizationId,id]);
 useUnsaved(dirty||editor!==null);
 const selected=expenses.filter(e=>included.includes(e.id));
 const reconciliation=useMemo(()=>reconcileStoredExpenses(revision,selected,documents,resolutions),[revision,selected,documents,resolutions]);
 const changed=()=>{setDirty(true);setCertified(false)};
 const attachments=voucherDocuments({travelMode:approved.travelMode,expenses:selected.map(e=>({category:text(e.data.category),merchant:text(e.data.merchant),foreignCurrency:Boolean(e.data.originalReceipt)})),missingReceipts:reconciliation.issues.filter(issue=>issue.code==='receipt_missing').map(issue=>text(selected.find(e=>e.id===issue.expenseId)?.data.merchant)||'an expense')});
 const unsupported=Boolean(initial&&initial.local.data.formSchemaVersion!==VOUCHER_MODULE_SCHEMA_VERSION);
 /** One tap: the planned cost happened as planned. Dates and payment come from the plan and your usual card. */
 async function sameAsPlanned(item:PlannedExpense){
  const current=await p.repository!.db.entities.get(`voucher:${id}`);if(!editable(current))throw new Error('This voucher has already been submitted.');
  const departure=text(trip.data.departure),returnDate=text(trip.data.returnDate),lodging=item.category==='lodging';
  const start=item.startDate||departure,end=item.endDate||returnDate,expenseId=crypto.randomUUID();
  const payload:PayloadOf<'expense.save'>={tripId:trip.id,merchant:(item.merchant||item.description).slice(0,200),incurredOn:item.date||(lodging?end:start),amountMinor:item.authorizedAmountMinor,currency:'USD',category:item.category,paymentMethod:item.expectedPaymentMethod||usualPayment(preferences.paymentMethod),authorizationItemId:item.id,description:item.description,documentIds:[],...(lodging&&start<end?{serviceStartDate:start,serviceEndDate:end}:{})};
  await p.repository!.stage('expense.save',expenseId,payload);setIncluded(current=>[...current,expenseId]);
  setEditor(current=>current&&current.authorizationItemId===item.id&&!expenses.some(e=>e.id===current.id)?null:current);
  setResolutions(current=>{const next={...current};delete next[`auth:${item.id}:not_used`];return next});changed();
  return `${item.description} added. Add its receipt below.`;
 }
 function differentFromPlanned(item:PlannedExpense){
  const lodging=item.category==='lodging';
  setEditor({...expenseDraft(),authorizationItemId:item.id,category:item.category,merchant:(item.merchant||item.description).slice(0,200),description:item.description,paymentMethod:item.expectedPaymentMethod||usualPayment(preferences.paymentMethod),date:item.date||(lodging?item.endDate||text(trip.data.returnDate):item.startDate||text(trip.data.departure)),...(lodging?{startDate:item.startDate||text(trip.data.departure),endDate:item.endDate||text(trip.data.returnDate)}:{})});
  feedback.setError('');bringIntoView('cw-expense-editor','input[placeholder="0.00"]');
 }
 function markNotUsed(item:PlannedExpense,notUsed:boolean){
  if(notUsed)setEditor(current=>current&&current.authorizationItemId===item.id&&!expenses.some(e=>e.id===current.id)?null:current);
  setResolutions(current=>{const next={...current},key=`auth:${item.id}:not_used`;if(notUsed)next[key]={type:'not_used',value:item.id,at:new Date().toISOString()};else delete next[key];return next});changed();
 }
 function editExpense(entity?:Entity,receipts=false){const draft=expenseDraft(entity);setEditor(entity?draft:{...draft,paymentMethod:usualPayment(preferences.paymentMethod)});feedback.setError('');bringIntoView(receipts?'cw-expense-receipts':'cw-expense-editor',receipts?'button':undefined)}
 async function saveExpense(){
  if(!editor)return;const current=await p.repository!.db.entities.get(`voucher:${id}`);if(!editable(current))throw new Error('This voucher has already been submitted.');
  const currentExpense=await p.repository!.db.entities.get(`expense:${editor.id}`);if((currentExpense?.local.version||0)!==editor.version)throw new Error('This expense changed in another session. Cancel this edit and reopen its current details before saving.');
  const paymentMethod=editor.paymentMethod;if(!paymentMethod)throw new Error('Choose a payment method.');remember(paymentKey,paymentMethod);updatePreferences(current=>({...current,paymentMethod}));
  const originalAmount=editor.currency==='USD'?parseAmountMinor(editor.amount):parseReceiptAmount(editor.amount,editor.currency);
  if(originalAmount<=0)throw new Error('Enter a positive receipt amount.');
  const taxesMinor=editor.category==='lodging'&&editor.taxes.trim()?parseReceiptAmount(editor.taxes,editor.currency):0;
  const feesMinor=editor.category==='lodging'&&editor.fees.trim()?parseReceiptAmount(editor.fees,editor.currency):0;
  const originalReceipt=editor.currency==='USD'?undefined:originalReceiptSchema.parse({currency:editor.currency,amountMinor:originalAmount,taxesMinor,feesMinor,usdBasis:editor.usdBasis,conversionNote:editor.conversionNote});
  const amountMinor=originalReceipt?parseAmountMinor(editor.usdAmount):originalAmount;
  const breakdown=originalReceipt?convertedBreakdown(originalReceipt,amountMinor):{taxesMinor,feesMinor};
  const payload:PayloadOf<'expense.save'>={tripId:trip.id,merchant:editor.merchant,incurredOn:editor.date,amountMinor,currency:'USD',category:editor.category,paymentMethod,authorizationItemId:editor.authorizationItemId,description:editor.description,documentIds:editor.documentIds,...breakdown,bookedOnline:editor.category==='lodging'&&editor.bookedOnline,...(originalReceipt?{originalReceipt}:{}),...(editor.currencyCorrection.trim()?{receiptCurrencyCorrection:editor.currencyCorrection.trim()}:{}),...(editor.startDate?{serviceStartDate:editor.startDate}:{}),...(editor.endDate?{serviceEndDate:editor.endDate}:{})};
  await p.repository!.stage('expense.save',editor.id,payload);setIncluded(current=>current.includes(editor.id)?current:[...current,editor.id]);
  setResolutions(current=>Object.fromEntries(Object.entries(current).filter(([key])=>!key.startsWith(`${editor.id}:`)&&key!==`auth:${editor.authorizationItemId}:not_used`)));setEditor(null);changed();return stageMessage(p,editor.id,'expense');
 }
 async function payloadForSave(requireComplete:boolean,nextResolutions=resolutions,recertify=false){
  if(editor)throw new Error('Save or cancel the open expense before saving your voucher.');
  const stored=await p.repository!.db.entities.toArray();const currentExpenses=stored.filter(r=>r.kind==='expense'&&r.local.tripId===trip.id&&included.includes(r.id)).map(r=>r.local);const currentDocuments=stored.filter(r=>r.kind==='document'&&r.local.tripId===trip.id).map(r=>r.local);
  const check=reconcileStoredExpenses(revision,currentExpenses,currentDocuments,nextResolutions);
  const formData={tripId:trip.id,authorizationId:revision.snapshot.entity.id,currency:'USD',certified:recertify?false:certified,intakeComplete,expenseItems:currentExpenses.map(e=>({expenseId:e.id,authorizationItemId:e.data.authorizationItemId,amountMinor:e.data.amountMinor,currency:e.data.currency,documentIds:e.data.documentIds||[]})),reconciliation:{totalAmountMinor:currentExpenses.reduce((sum,e)=>sum+Number(e.data.amountMinor),0),unresolvedIssueIds:check.issues.map(i=>i.id)},resolutions:nextResolutions};
  if(requireComplete){if(!intakeComplete)throw new Error('Confirm that you have accounted for all trip expenses.');if(!certified)throw new Error('Certify the expense details before submitting.');if(!check.ready)throw new Error('Resolve the items listed below before submitting your voucher.');voucherModuleSchema.parse(formData)}
  return {tripId:trip.id,authorizationId:revision.snapshot.entity.id,expenseIds:currentExpenses.map(e=>e.id),formSchemaVersion:VOUCHER_MODULE_SCHEMA_VERSION,formData};
 }
 async function save(requireComplete=false,nextResolutions=resolutions,recertify=false){
  const current=await p.repository!.db.entities.get(`voucher:${id}`);if(!editable(current))throw new Error('This voucher has already been submitted. Refresh to view its status.');
  if((current?.local.version||0)!==baselineVersion.current)throw new Error('This voucher changed in another session. Reload to review the newer revision before saving.');
  const payload=await payloadForSave(requireComplete,nextResolutions,recertify);if(!payload.expenseIds.length)throw new Error('Add at least one expense to your voucher.');await p.repository!.stage('voucher.save',id,payload);baselineVersion.current=(await p.repository!.db.entities.get(`voucher:${id}`))!.local.version;setDirty(false);return stageMessage(p,id,'voucher');
 }
 async function submit(){
  if(p.approvalMode==='preview'){await save();await readyToSubmit(p,trip.id);return 'Saved.'}
  if(!intakeComplete)throw new Error('Confirm that you have accounted for all trip expenses.');
  if(!certified)throw new Error('Certify the expense details before verification.');
  await readyToSubmit(p,trip.id);
  // Save the current reconciled references only while the record is editable.
  // If a previous response was lost, recover its accepted submission instead.
  const current=await p.repository!.db.entities.get(`voucher:${id}`);
  if(!editable(current)){const result=await onlineCommand(p,'voucher.submit',id);baselineVersion.current=result.version;return result.status==='verified'?'Verified by Ouranos. Your expenses are ready for payment.':'This voucher is already locked.'}
  await save();await readyToSubmit(p,trip.id);const result=await onlineCommand(p,'voucher.submit',id);baselineVersion.current=result.version;setDirty(false);return result.status==='verified'?'Verified by Ouranos. Your expenses are ready for payment.':'Verification found items that need your attention.';
 }
 async function capture(files:File[],attach=false){const ids:string[]=[];for(const file of files)ids.push(await p.repository!.captureReceipt(trip.id,file));if(attach)setEditor(current=>current&&current.id===editor?.id?{...current,documentIds:[...new Set([...current.documentIds,...ids])]}:current);await p.engine?.sync();changed();return attach?'Receipts selected. Save the expense to attach them, then review their processing status below.':'Receipts saved. Their processing status appears below.'}
 async function captureForExpense(expense:Entity,files:File[]){
  if(editor?.id===expense.id){
   // The open form would overwrite the expense's receipts when saved, so add the new ones to the form.
   const ids:string[]=[];for(const file of files)ids.push(await p.repository!.captureReceipt(trip.id,file));
   setEditor(current=>current&&current.id===expense.id?{...current,documentIds:[...new Set([...current.documentIds,...ids])]}:current);
   return `Receipt added to the open expense. Save it to keep the receipt with it.`;
  }
  const voucher=await p.repository!.db.entities.get(`voucher:${id}`);if(!editable(voucher))throw new Error('This voucher has already been submitted.');
  const current=await p.repository!.db.entities.get(`expense:${expense.id}`);
  if(!current||current.local.version!==expense.version)throw new Error('This expense changed. Refresh before attaching a receipt.');
  const ids:string[]=[];
  for(const file of files)ids.push(await p.repository!.captureReceipt(trip.id,file));
  const latest=await p.repository!.db.entities.get(`expense:${expense.id}`);
  if(!latest||latest.local.version!==expense.version)throw new Error('This expense changed during upload. Your receipt is saved in Receipts; reopen the expense to attach it.');
  if(!editable(await p.repository!.db.entities.get(`voucher:${id}`)))throw new Error('This voucher has already been submitted. Your receipt is saved in Receipts.');
  await p.repository!.stage('expense.save',expense.id,{...latest.local.data,tripId:trip.id,documentIds:[...new Set([...(latest.local.data.documentIds as string[]||[]),...ids])]} as PayloadOf<'expense.save'>);
  setResolutions(current=>Object.fromEntries(Object.entries(current).filter(([key])=>!key.startsWith(`${expense.id}:`))));changed();
  await p.engine?.sync();return 'Receipt attached. Check and confirm it here after processing.';
 }
 async function saveStatement(issue:Reconciliation['issues'][number],resolution:Resolution){
  const checked=voucherResolutionSchema.parse(resolution);
  if(checked.type!=='lost_receipt_statement')throw new Error('Choose a lost-receipt statement.');
  const expense=await p.repository!.db.entities.get(`expense:${issue.expenseId}`);
  if(!expense||expense.local.version!==checked.value.expenseVersion)throw new Error('This expense changed. Reopen its receipt statement before saving.');
  const next={...resolutions,[issue.id]:{...checked,at:new Date().toISOString()}};
  const notice=await save(false,next,true);setResolutions(next);setCertified(false);
  return notice==='Saved.'?'Statement saved.': 'Statement saved on this device. It will sync when connected.';
 }
 function resolve(issue:Reconciliation['issues'][number],resolution:Resolution){setResolutions(current=>({...current,[issue.id]:{...resolution,at:new Date().toISOString()}}));changed()}
 if(unsupported)return <div className="cw-card"><h2>A different voucher form is attached.</h2><p className="cw-muted">Its data has been preserved. Return to workspace to review the existing record.</p><Link href="/dashboard/platform">Workspace</Link></div>;
 return <>
 <div className="cw-approved-summary"><div><span className="cw-summary-label">{p.approvalMode==='preview'?'Travel plan':'Approved plan'}</span><strong>{approved.traveler}</strong><p>{approved.origin} <ArrowRight size={13}/> {text(revision.snapshot.trip.data.destination)}</p></div><div><span className="cw-muted">{p.approvalMode==='preview'?'Planned budget':'Approved budget'}</span><strong>{money(approved.approvedExpenseItems.reduce((sum,e)=>sum+e.authorizedAmountMinor,0))}</strong><span className="cw-fingerprint" title={revision.sha256}>{p.approvalMode==='preview'?'Draft':`Revision ${revision.id.slice(0,8)}`}</span></div></div>
 {verification&&<section className="cw-card cw-verification" aria-live="polite"><h2>{verification.status==='verified'?'Voucher verified by Ouranos':'Needs action'}</h2><p className="cw-muted">{verification.checksPassed} checks passed · {verification.expenseCount} expenses · {verification.receiptCount} confirmed receipts</p>{verification.status==='verified'?<p>Your expenses are ready for payment.</p>:<div className="cw-issues">{verification.blockingIssues.map(issue=><div className="cw-issue" key={issue.id}><p>{issue.message}</p>{issue.expenseId&&expenses.some(expense=>expense.id===issue.expenseId)&&<Button variant="outline" disabled={!!feedback.busy} onClick={()=>editExpense(expenses.find(expense=>expense.id===issue.expenseId),issue.code==='receipt_missing')}>{issue.action}</Button>}</div>)}</div>}<Button asChild variant="outline"><Link href={`/dashboard/travel/vouchers/verification?tripId=${trip.id}&voucherId=${id}`}>View verification details <ArrowRight size={15}/></Link></Button></section>}
 {(locked||(p.approvalMode==='preview'&&row?.server))&&<TravelPackagePanel voucherId={id} refreshKey={`${status}:${row?.server?.version}`}/>}
 <details className={`cw-record-details ${locked?'':'cw-editable'}`} open={!locked}><summary>{locked?'View expenses':'Expenses'}</summary>
 <div className="cw-section-heading"><div><h2>Expenses</h2></div><Status value={status}/></div>
 {locked&&<div className="cw-banner"><Check size={18}/><div><strong>{status==='verified'?'Verified by Ouranos. Your expenses are ready for payment.':status==='approved'?'Approved.':'In review.'}</strong></div></div>}
 <PlannedCosts items={approved.approvedExpenseItems} expenses={expenses} notUsed={new Set(approved.approvedExpenseItems.filter(item=>resolutions[`auth:${item.id}:not_used`]?.type==='not_used').map(item=>item.id))} locked={locked} busy={!!feedback.busy} onSame={item=>void feedback.run('expense',()=>sameAsPlanned(item))} onDifferent={differentFromPlanned} onNotUsed={markNotUsed} onEdit={editExpense}/>
 <div className="cw-expenses">{expenses.map(expense=><article id={`expense-${expense.id}`} className={`cw-expense-row ${included.includes(expense.id)?'':'cw-excluded'}`} key={expense.id}><label className="cw-check"><input type="checkbox" checked={included.includes(expense.id)} disabled={locked||!!feedback.busy} onChange={e=>{setIncluded(current=>e.target.checked?[...current,expense.id]:current.filter(x=>x!==expense.id));changed()}}/><span className="sr-only">Include {text(expense.data.merchant)} in this voucher</span></label><div className="cw-expense-info"><strong>{text(expense.data.merchant)}</strong><span>{categoryLabels[text(expense.data.category) as Category]??label(text(expense.data.category))} · {displayDate(expense.data.incurredOn)} · {expense.data.paymentMethod==='personal'?'Personal':'GTCC'}</span><small>{(expense.data.documentIds as string[]||[]).length} receipt{(expense.data.documentIds as string[]||[]).length===1?'':'s'}{!included.includes(expense.id)?' · Excluded from this voucher':''}</small></div><div className="cw-expense-amount"><strong>{money(Number(expense.data.amountMinor))}</strong>{originalReceiptSchema.safeParse(expense.data.originalReceipt).success&&<small style={{display:'block'}}>{formatReceiptAmount(Number(record(expense.data.originalReceipt).amountMinor),String(record(expense.data.originalReceipt).currency))} original</small>}</div>{!locked&&<Button variant="ghost" disabled={!!feedback.busy} onClick={()=>editExpense(expense)}>Edit</Button>}</article>)}</div>
 {!locked&&!editor&&<Button variant="outline" className="cw-add-button" onClick={()=>editExpense()} disabled={!!feedback.busy}><Plus size={16}/> Add another expense</Button>}
 {editor&&!locked&&<form id="cw-expense-editor" className="cw-card cw-expense-editor" onSubmit={e=>{e.preventDefault();void feedback.run('expense',saveExpense)}}><div className="cw-section-heading"><h3>{expenses.some(e=>e.id===editor.id)?'Edit expense':'New expense'}</h3></div><fieldset className="cw-fieldset cw-grid" disabled={!!feedback.busy}>
 <Field label="Approved budget item" className="cw-span-full"><select required value={editor.authorizationItemId} onChange={e=>{const item=approved.approvedExpenseItems.find(i=>i.id===e.target.value)!;setEditor({...editor,authorizationItemId:item.id,category:item.category})}}><option value="" disabled>Choose an approved item</option>{approved.approvedExpenseItems.map(item=><option key={item.id} value={item.id}>{item.description} · {money(item.authorizedAmountMinor)}</option>)}</select></Field>
 <Field label="Merchant"><Input value={editor.merchant} onChange={e=>setEditor({...editor,merchant:e.target.value})} maxLength={200} required/></Field><Field label={`Receipt amount · ${editor.currency}`}><Input value={editor.amount} onChange={e=>setEditor({...editor,amount:e.target.value})} inputMode="decimal" placeholder="0.00" required/></Field><Field label="Receipt currency"><select value={editor.currency} onChange={e=>setEditor({...editor,currency:e.target.value as ReceiptCurrency,usdAmount:''})}>{receiptCurrencies.map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></Field>{editor.currency!=='USD'&&<><Field label="Amount charged · USD"><Input value={editor.usdAmount} onChange={e=>setEditor({...editor,usdAmount:e.target.value})} inputMode="decimal" placeholder="From your statement or conversion" required/></Field><Field label="USD amount source"><select value={editor.usdBasis} onChange={e=>setEditor({...editor,usdBasis:e.target.value as ExpenseDraft['usdBasis']})}><option value="card_statement">Card statement</option><option value="documented_conversion">Documented conversion</option></select></Field><Field label={editor.usdBasis==='documented_conversion'?'Conversion details':'Conversion note · optional'}><Input value={editor.conversionNote} onChange={e=>setEditor({...editor,conversionNote:e.target.value})} required={editor.usdBasis==='documented_conversion'} minLength={editor.usdBasis==='documented_conversion'?8:undefined} maxLength={2000} placeholder="Rate, date and source"/></Field><p className="cw-muted cw-span-full">Keep the original receipt amount above. Voucher totals use the USD amount you confirm here; Ouranos does not fetch exchange rates.</p></>}<Field label="Expense date"><Input type="date" value={editor.date} onChange={e=>setEditor({...editor,date:e.target.value})} required/></Field><Field label="Payment method"><select required value={editor.paymentMethod} onChange={e=>setEditor({...editor,paymentMethod:e.target.value as ExpenseDraft['paymentMethod']})}><option value="" disabled>Choose payment method</option><option value="gtcc">GTCC</option><option value="personal">Personal</option></select></Field><Field label="Category"><select required value={editor.category} onChange={e=>setEditor({...editor,category:e.target.value as Category,...(isListedDescription(editor.category,editor.description)?{description:''}:{})})}><option value="" disabled>Choose category</option><Categories/></select></Field><Field label="Description · optional"><DescriptionField key={editor.category} category={editor.category||'other'} value={editor.description} onChange={description=>setEditor({...editor,description})} maxLength={2000}/></Field>
 {editor.category==='lodging'&&<><Field label="Check-in"><Input type="date" value={editor.startDate} onChange={e=>setEditor({...editor,startDate:e.target.value})}/></Field><Field label="Check-out"><Input type="date" min={editor.startDate} value={editor.endDate} onChange={e=>setEditor({...editor,endDate:e.target.value})}/></Field></>}
 {editor.category==='lodging'&&isNonconventionalLodging(`${editor.merchant} ${editor.description}`)&&<p className="cw-feedback cw-error cw-span-full" role="status">Airbnb, VRBO and similar rentals usually aren’t paid unless your approver said yes in advance. Keep that approval with your receipts.</p>}{editor.category==='lodging'&&<><Field label={`Tax · ${editor.currency}`}><Input inputMode="decimal" value={editor.taxes} onChange={e=>setEditor({...editor,taxes:e.target.value})} placeholder="0.00"/></Field><Field label={`Fees · ${editor.currency}`}><Input inputMode="decimal" value={editor.fees} onChange={e=>setEditor({...editor,fees:e.target.value})} placeholder="0.00"/></Field><label className="cw-check cw-span-full"><input type="checkbox" checked={editor.bookedOnline} onChange={e=>setEditor({...editor,bookedOnline:e.target.checked})}/><span>Booked through an online travel agency</span></label></>}
 <details className="cw-span-full cw-disclosure"><summary>Correct a scanned currency</summary><Field label="Explain an OCR currency error · optional"><Input value={editor.currencyCorrection} onChange={e=>setEditor({...editor,currencyCorrection:e.target.value})} maxLength={2000} placeholder="Only if the original receipt shows a different currency"/></Field></details><div id="cw-expense-receipts" tabIndex={-1} className="cw-span-full cw-attach"><span>Attach receipts</span><ReceiptIntake disabled={!!feedback.busy} onFiles={files=>void feedback.run('receipt',()=>capture(files,true))}/>{documents.length?documents.map(doc=><label className="cw-check" key={doc.id}><input type="checkbox" checked={editor.documentIds.includes(doc.id)} onChange={e=>setEditor({...editor,documentIds:e.target.checked?[...editor.documentIds,doc.id]:editor.documentIds.filter(id=>id!==doc.id)})}/><span>{text(doc.data.filename)} <small>{label(doc.status)}</small></span></label>):<p className="cw-muted">Upload or photograph a receipt here. It will be selected for this expense; save the expense to attach it.</p>}</div>
 </fieldset><div className="cw-actions cw-editor-actions"><Button type="button" variant="ghost" disabled={!!feedback.busy} onClick={()=>setEditor(null)}>Cancel</Button><Button type="submit" disabled={!!feedback.busy}>{feedback.busy==='expense'?'Saving…':'Save expense'}</Button></div></form>}
 {locked?<div className="cw-section-heading"><h2>Receipts</h2></div>:<ReceiptIntake disabled={!!feedback.busy} onFiles={files=>void feedback.run('receipt',()=>capture(files))}/>}
 <div className="cw-card cw-receipt-list">{documents.length?documents.map(doc=><div className="cw-receipt" key={doc.id}><FileText size={19}/><div><strong>{text(doc.data.filename)}</strong><span>{receiptStatus(doc.status)}</span></div>{['needs_review','ready'].includes(doc.status)&&<Button variant="ghost" onClick={()=>setReviewReceipt(reviewReceipt===doc.id?null:doc.id)}>{reviewReceipt===doc.id?'Close':'Review'}</Button>}{!locked&&['failed','awaiting_provider'].includes(doc.status)&&<Button variant="ghost" disabled={!!feedback.busy} onClick={()=>void feedback.run('retry',async()=>{await onlineCommand(p,'document.reprocess',doc.id);return 'Receipt queued for processing.'})}>Retry</Button>}</div>):<p className="cw-muted">JPEG, PNG or PDF · 20 MB max</p>}</div>
 <ReceiptSyncNotice/>
 {reviewReceipt&&<ReceiptReview key={reviewReceipt} id={reviewReceipt} document={documents.find(d=>d.id===reviewReceipt)!} locked={locked} onConfirmed={()=>{setReviewReceipt(null);changed()}} onUseDetails={(documentId,fields,hint)=>{if(!receiptCurrencies.includes(fields.currency as ReceiptCurrency)){feedback.setError('Choose a supported receipt currency before using these details.');return}const suggestion=suggestReceiptAllocation(revision,fields,hint);const matched=approved.approvedExpenseItems.find(item=>item.id===suggestion.authorizationItemId);const draft=expenseDraft();setEditor({...draft,authorizationItemId:matched?.id||'',merchant:fields.merchant||'',date:/^\d{4}-\d{2}-\d{2}$/.test(fields.date||'')?fields.date:'',amount:fields.amount||fields.paid_total||fields.total||'',currency:fields.currency as ReceiptCurrency,category:(matched?.category||suggestion.category) as Category,paymentMethod:(['gtcc','personal'].includes(fields.paymentMethod)?fields.paymentMethod:'') as ExpenseDraft['paymentMethod'],description:hint,documentIds:[documentId],startDate:fields.serviceStartDate||'',endDate:fields.serviceEndDate||'',taxes:fields.taxes||'',fees:fields.fees||'',bookedOnline:false});setReviewReceipt(null);feedback.setNotice(matched?`Suggested match: ${matched.description}. Check the receipt details and payment method, then save.`:'Receipt details added. Choose the approved budget item and check the fields before saving.');setTimeout(()=>window.document.getElementById('cw-expense-editor')?.scrollIntoView({block:'center'}),0)}}/>}
 <VoucherDocumentsCard tripId={trip.id} documents={attachments}/>
 <div className="cw-section-heading"><div><h2>Review</h2></div></div>
 <div className="cw-totals"><div><span>Actual expenses</span><strong>{money(Math.round(reconciliation.totals.actual*100))}</strong></div><div><span>GTCC</span><strong>{money(Math.round(reconciliation.totals.gtcc*100))}</strong></div><div><span>Personal</span><strong>{money(Math.round(reconciliation.totals.traveler*100))}</strong></div></div>
 {reconciliation.issues.length?<div className="cw-issues">{reconciliation.issues.map(issue=><Issue key={issue.id} issue={issue} locked={locked} busy={!!feedback.busy} expense={selected.find(e=>e.id===issue.expenseId)} receiptContent={issue.code==='receipt_missing'&&selected.some(e=>e.id===issue.expenseId)?<>
  <ReceiptIntake disabled={!!feedback.busy} onFiles={files=>void feedback.run('receipt',()=>captureForExpense(selected.find(e=>e.id===issue.expenseId)!,files))}/>
  <p className="cw-muted">JPEG, PNG or PDF · 20 MB max. Attached to this expense automatically.</p>
  {documents.filter(doc=>(selected.find(e=>e.id===issue.expenseId)?.data.documentIds as string[]||[]).includes(doc.id)).map(doc=><div key={doc.id} className="cw-inline-document"><strong>{text(doc.data.filename)}</strong><p className="cw-muted" role="status">{receiptStatus(doc.status)}</p>{['needs_review','ready'].includes(doc.status)?<ReceiptReview id={doc.id} document={doc} locked={locked} onConfirmed={changed}/>:['failed','awaiting_provider'].includes(doc.status)?<Button variant="outline" disabled={!!feedback.busy} onClick={()=>void feedback.run('retry',async()=>{await onlineCommand(p,'document.reprocess',doc.id);return 'Receipt queued for processing.'})}>Retry</Button>:null}</div>)}
  <Feedback error={feedback.error} notice={feedback.busy==='receipt'?'Uploading receipt…':feedback.notice}/>
 </>:undefined} onResolve={resolution=>{if(resolution.type==='lost_receipt_statement')void feedback.run('statement',()=>saveStatement(issue,resolution));else resolve(issue,resolution)}} onEdit={()=>{const expense=expenses.find(e=>e.id===issue.expenseId);if(expense)editExpense(expense,issue.code==='receipt_missing')}}/>)}</div>:selected.length>0?<div className="cw-ready"><Check size={18}/> Ready.</div>:<p className="cw-muted">Add an expense to begin reconciliation.</p>}
 {Object.keys(resolutions).length>0&&<details className="cw-resolutions"><summary>{Object.keys(resolutions).length} recorded resolution{Object.keys(resolutions).length===1?'':'s'}</summary>{Object.entries(resolutions).map(([key,value])=><div key={key}><span>{value.type==='not_used'?'Authorized item not used':value.type==='confirmed_date'?`Date confirmed: ${value.value}`:value.type==='lost_receipt_statement'?value.value.reason:value.value}</span>{!locked&&<Button variant="ghost" disabled={!!feedback.busy} onClick={()=>{setResolutions(current=>Object.fromEntries(Object.entries(current).filter(([id])=>id!==key)));changed()}}>Remove</Button>}</div>)}</details>}
 {!locked&&<div className="cw-certification"><label className="cw-check"><input type="checkbox" checked={intakeComplete} disabled={!!feedback.busy} onChange={e=>{setIntakeComplete(e.target.checked);changed()}}/><span>All expenses are included.</span></label><label className="cw-check"><input type="checkbox" checked={certified} disabled={!!feedback.busy} onChange={e=>{setCertified(e.target.checked);setDirty(true)}}/><span>I certify these details are accurate.</span></label></div>}
 <Feedback error={feedback.error} notice={feedback.notice}/>{!locked&&<div className="cw-action-bar"><div><p>{reconciliation.ready?'Ready for verification.':'Resolve the items above, or run verification for a full report.'}</p></div><div className="cw-actions"><Button variant="outline" disabled={!!feedback.busy||!!editor} onClick={()=>void feedback.run('save',()=>save())}>{feedback.busy==='save'?'Saving…':'Save draft'}</Button><Button disabled={!!feedback.busy||!!editor||!p.client||(p.approvalMode!=='preview'&&(!certified||!intakeComplete))} onClick={()=>void feedback.run('submit',submit)}>{feedback.busy==='submit'?'Verifying…':p.approvalMode==='preview'?'Save voucher':'Verify voucher'}<ArrowRight size={16}/></Button></div></div>}
 </details></>;
}
function ReceiptSyncNotice(){
 const p=usePlatform(),feedback=useFeedback();
 if(p.sync.state!=='blocked'||!p.sync.message)return null;
 return <div className="cw-feedback cw-error" role="alert"><p>{p.sync.message}</p><Button type="button" variant="outline" disabled={!!feedback.busy||!p.engine} onClick={()=>void feedback.run('sync',()=>p.engine!.sync())}>{feedback.busy?'Retrying…':'Retry sync'}</Button><Feedback error={feedback.error} notice={feedback.notice}/></div>;
}
function ReceiptInbox({trip,rows}:{trip:Entity;rows:LocalRecord[]}){
 const p=usePlatform(),feedback=useFeedback();const [review,setReview]=useState<string|null>(null);
 const documents=rows.filter(r=>r.kind==='document'&&r.local.tripId===trip.id).map(r=>r.local);
 const selected=documents.find(d=>d.id===review);
 return <><ReceiptIntake disabled={!!feedback.busy} onFiles={files=>void feedback.run('upload',async()=>{for(const file of files)await p.repository!.captureReceipt(trip.id,file);await p.engine?.sync();return 'Receipts saved. Their processing status appears below.'})}/>
 <div className="cw-card cw-receipt-list">{documents.length?documents.map(doc=><div className="cw-receipt" key={doc.id}><FileText size={19}/><div><strong>{text(doc.data.filename)}</strong><span>{receiptStatus(doc.status)}</span></div>{['needs_review','ready'].includes(doc.status)&&<Button variant="ghost" onClick={()=>setReview(doc.id)}>Review</Button>}{['failed','awaiting_provider'].includes(doc.status)&&<Button variant="ghost" disabled={!!feedback.busy} onClick={()=>void feedback.run('retry',async()=>{await onlineCommand(p,'document.reprocess',doc.id)})}>Retry</Button>}</div>):<p className="cw-muted">JPEG, PNG or PDF · 20 MB max</p>}</div>
 <ReceiptSyncNotice/>
 {selected&&<ReceiptReview key={selected.id} id={selected.id} document={selected} locked={false} onConfirmed={()=>setReview(null)}/>}
 <Feedback error={feedback.error} notice={feedback.notice}/></>;
}
function receiptStatus(status:string){const labels:Record<string,string>={registered:'Saved · waiting to upload',uploaded:'Processing',processing:'Processing',awaiting_provider:'Waiting for a connected receipt processor',needs_review:'Review receipt',ready:'Confirmed',quarantined:'File blocked by the security scan',failed:'Processing needs attention'};return labels[status]||label(status)}
function ReceiptReview({id,document:doc,locked,onConfirmed,onUseDetails}:{id:string;document:Entity;locked:boolean;onConfirmed:()=>void;onUseDetails?:(id:string,fields:Record<string,string>,hint:string)=>void}){
 const p=usePlatform(),feedback=useFeedback();const [fields,setFields]=useState<Array<{name:string;value:string;confidence?:number}>|null>(null),[confirmed,setConfirmed]=useState(false),[url,setUrl]=useState(''),[hint,setHint]=useState(''),[currencyOverride,setCurrencyOverride]=useState('');const setError=feedback.setError;
 useEffect(()=>{let active=true;if(!p.client||!p.organizationId)return;void p.client.extractions(id,p.organizationId).then(result=>{const latest=record(result.runs[0]),extracted=record(latest.result);const values=Array.isArray(extracted.fields)?extracted.fields:[];if(active)setFields(values.map(v=>{const field=record(v);return {name:text(field.name),value:typeof field.value==='string'?field.value:String(field.value??''),confidence:typeof field.confidence==='number'?field.confidence:undefined}}))}).catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[id,p.client,p.organizationId,setError]);
 if(!doc)return null;
 const extracted=Object.fromEntries((fields||[]).map(f=>[f.name,f.value]));const receiptCheck=assessReceipt((fields||[]).filter(f=>f.name.startsWith('text')).map(f=>f.value).join('\n'),extracted);
 return <section className="cw-card cw-receipt-review"><div className="cw-section-heading"><h3>{text(doc.data.filename)}</h3><Button variant="outline" onClick={()=>void feedback.run('download',async()=>{if(!p.client||!p.organizationId)throw new Error('Connect to view the original receipt.');setUrl((await p.client.download(id,p.organizationId)).url)})}>View original</Button></div>{url&&<p className="cw-muted"><a href={url} target="_blank" rel="noopener noreferrer">Open receipt file <ArrowRight size={13}/></a> · Link expires after one minute.</p>}
 {fields===null?<p className="cw-muted">Loading extracted details…</p>:fields.length?<dl className="cw-extraction">{fields.filter(field=>!field.name.startsWith('text')).map((field,index)=><div key={`${field.name}:${index}`}><dt>{label(field.name)}</dt><dd>{field.value}{field.confidence!==undefined&&field.confidence<.85&&<small>Check this value carefully</small>}</dd></div>)}</dl>:<p className="cw-muted">No structured fields were returned. Review the original file and enter its details in the expense.</p>}
 {fields?.some(field=>field.name.startsWith('text'))&&<details className="cw-raw-extraction"><summary>Full extracted text</summary><pre>{fields.filter(field=>field.name.startsWith('text')).map(field=>field.value).join('\n\n')}</pre></details>}
 {!locked&&onUseDetails&&fields&&fields.some(field=>['merchant','date','amount'].includes(field.name))&&<><Field label="Receipt currency"><select value={currencyOverride||extracted.currency||''} onChange={e=>setCurrencyOverride(e.target.value)}><option value="" disabled>Confirm currency</option>{receiptCurrencies.map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></Field><Field label="Receipt type · optional"><Input value={hint} onChange={e=>setHint(e.target.value)} placeholder="hotel, parking, rental car gas…" maxLength={120}/></Field><Button variant="outline" disabled={!!feedback.busy} onClick={()=>onUseDetails(id,{...Object.fromEntries(fields.filter(field=>!field.name.startsWith('text')).map(field=>[field.name,field.value])),rawText:fields.filter(field=>field.name.startsWith('text')).map(field=>field.value).join('\n'),currency:currencyOverride||extracted.currency||''},hint)}>Use extracted details</Button></>}
 {doc.status==='needs_review'&&!locked&&<><label className="cw-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the original receipt.</span></label><Button disabled={!confirmed||fields===null||!!feedback.busy} onClick={()=>void feedback.run('confirm',async()=>{await onlineCommand(p,'document.confirm',id);onConfirmed()})}>{feedback.busy==='confirm'?'Confirming…':'Confirm receipt'}</Button></>}
 {fields&&receiptCheck.problems.length>0&&<details className="cw-disclosure"><summary>Check receipt</summary>{receiptCheck.problems.map(problem=><p key={problem}>{problem}</p>)}</details>}<Feedback error={feedback.error} notice={feedback.notice}/></section>;
}
function Issue({issue,locked,busy=false,expense,onResolve,onEdit,receiptContent}:{issue:Reconciliation['issues'][number];locked:boolean;busy?:boolean;expense?:Entity;onResolve:(resolution:Resolution)=>void;onEdit:()=>void;receiptContent?:ReactNode}){
 const [explanation,setExplanation]=useState(''),[receiptOpen,setReceiptOpen]=useState(false);
 return <div className="cw-issue"><p>{issue.message}</p>{!locked&&(issue.code==='authorized_item_unaccounted'?<Button variant="outline" disabled={busy} onClick={()=>onResolve({type:'not_used',value:issue.authorizationItemId!})}>Mark not used</Button>:['over_authorization','lodging_over_cap'].includes(issue.code)?<div className="cw-explanation"><Field label="Explain the additional cost"><Textarea disabled={busy} value={explanation} onChange={e=>setExplanation(e.target.value)} maxLength={4000} placeholder="Describe why the actual cost exceeded the plan."/></Field><Button variant="outline" disabled={busy||explanation.trim().length<8} onClick={()=>onResolve({type:'explanation',value:explanation.trim()})}>Save explanation</Button></div>:issue.code==='receipt_missing'&&expense?<div className={`cw-issue-receipt ${receiptOpen?'is-open':''}`}><Button variant="outline" disabled={busy} aria-expanded={receiptOpen} aria-controls={`receipt-${issue.id}`} onClick={()=>setReceiptOpen(open=>!open)}>{receiptOpen?'Close receipt upload':'Add receipt'}</Button>{receiptOpen&&<div id={`receipt-${issue.id}`} className="cw-inline-receipts" role="region" aria-label={`Receipt for ${text(expense.data.merchant)}`}>{receiptContent}</div>}{!expense.data.bookedOnline&&<details className="cw-disclosure"><summary>Receipt lost?</summary><Field label="What happened?"><Textarea disabled={busy} value={explanation} onChange={e=>setExplanation(e.target.value)} maxLength={2000} placeholder="Lost, destroyed, or explain what happened" required/></Field><p className="cw-muted">This statement will be saved with your voucher. You’ll certify it before verification.</p><Button variant="outline" disabled={busy||!explanation.trim()} onClick={()=>onResolve({type:'lost_receipt_statement',value:{reason:explanation.trim(),expenseVersion:expense.version}})}>Save statement</Button></details>}</div>:issue.code==='itinerary_changed'&&expense?<Button variant="outline" disabled={busy} onClick={()=>onResolve({type:'confirmed_date',value:text(expense.data.incurredOn)})}>Confirm {displayDate(expense.data.incurredOn)}</Button>:<Button variant="outline" disabled={busy} onClick={onEdit}>{issue.action}</Button>)}</div>;
}
