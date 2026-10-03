/** Where a trip is, in four document stages, and the one thing to do next. */
export type StepState='done'|'current'|'todo';
export type TripStep={id:'plan'|'approval'|'expenses'|'paid';label:string;state:StepState};
export type NextStep={title:string;detail:string;action?:{label:string;to:'plan'|'expenses'|'hotels'}};
type Input={planStatus?:string;changing?:boolean;waitingOn?:string;departure:string;returnDate:string;today:string;voucherStatus?:string;paid?:boolean};

const day=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const SUBMITTED_VOUCHER=['in_review','verified','approved'];

export function tripProgress(t:Input):{steps:TripStep[];next:NextStep}{
 const planned=['in_review','approved'].includes(t.planStatus??''),approved=t.planStatus==='approved';
 const back=t.today>t.returnDate,away=!back&&t.today>=t.departure;
 const filed=SUBMITTED_VOUCHER.includes(t.voucherStatus??'');
 // A recorded payment means the trip is finished, even if the voucher was filed outside Ouranos.
 const state=(done:boolean,current:boolean):StepState=>done||t.paid?'done':current?'current':'todo';
 const steps:TripStep[]=[
  {id:'plan',label:'Authorization',state:state(planned,!planned)},
  {id:'approval',label:'Approval',state:state(approved,t.planStatus==='in_review')},
  {id:'expenses',label:'Voucher',state:state(filed,approved&&!filed)},
  {id:'paid',label:'Paid',state:state(Boolean(t.paid),filed&&!t.paid)},
 ];
 let next:NextStep;
 if(t.paid)next={title:'All done',detail:'Your trip is paid.'};
 else if(!t.planStatus||t.planStatus==='draft')next=t.changing
  ?{title:'Finish your change',detail:'Update the trip or costs, then send the change to your approvers.',action:{label:'Open authorization',to:'plan'}}
  :{title:'Finish your plan',detail:'Add how you’re getting there and what it will cost, then send it for review.',action:{label:'Open authorization',to:'plan'}};
 else if(t.planStatus==='changes_requested')next={title:'Fix what your approver asked',detail:'Your approver sent the plan back. Make the changes and send it again.',action:{label:'Open authorization',to:'plan'}};
 else if(t.planStatus==='rejected')next={title:'Your plan wasn’t approved',detail:'Talk to your approver before planning this trip again.'};
 else if(t.planStatus==='in_review')next={title:t.waitingOn?`Waiting on ${t.waitingOn}`:'Waiting for approval',detail:'Nothing to do right now. You’ll get a message in your inbox when it’s decided.'};
 else if(filed)next={title:'Waiting for payment',detail:'Your expenses are in. You’ll be paid once they’re processed.'};
 else if(!back)next=away
  ?{title:'You’re traveling',detail:`Keep your receipts. When you’re back on ${day(t.returnDate)}, add your expenses.`,action:{label:'Open voucher',to:'expenses'}}
  :{title:'Get ready for your trip',detail:`Approved. Book your travel and find a place to stay before ${day(t.departure)}.`,action:{label:'Find a hotel',to:'hotels'}};
 else if(!filed)next={title:'Prepare your voucher',detail:'Add what you spent and your receipts, then check your voucher.',action:{label:'Open voucher',to:'expenses'}};
 else next={title:'Waiting for payment',detail:'Your expenses are in. You’ll be paid once they’re processed.'};
 return {steps,next};
}
