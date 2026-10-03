/** Where a trip is, in five plain steps, and the one thing to do next. */
export type StepState='done'|'current'|'todo';
export type TripStep={id:'plan'|'approval'|'travel'|'expenses'|'paid';label:string;state:StepState};
export type NextStep={title:string;detail:string;action?:{label:string;to:'plan'|'expenses'|'dts'|'hotels'}};
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
  {id:'plan',label:'Plan',state:state(planned,!planned)},
  {id:'approval',label:'Approval',state:state(approved,t.planStatus==='in_review')},
  {id:'travel',label:'Travel',state:state(approved&&back,approved&&!back)},
  {id:'expenses',label:'Expenses',state:state(filed,approved&&back&&!filed)},
  {id:'paid',label:'Paid',state:state(Boolean(t.paid),filed&&!t.paid)},
 ];
 let next:NextStep;
 if(t.paid)next={title:'All done',detail:'Your trip is paid.'};
 else if(!t.planStatus||t.planStatus==='draft')next=t.changing
  ?{title:'Finish your change',detail:'Update the trip or costs, then send the change to your approvers.',action:{label:'Open the plan',to:'plan'}}
  :{title:'Finish your plan',detail:'Add how you’re getting there and what it will cost, then send it for review.',action:{label:'Open the plan',to:'plan'}};
 else if(t.planStatus==='changes_requested')next={title:'Fix what your approver asked',detail:'Your approver sent the plan back. Make the changes and send it again.',action:{label:'Open the plan',to:'plan'}};
 else if(t.planStatus==='rejected')next={title:'Your plan wasn’t approved',detail:'Talk to your approver before planning this trip again.'};
 else if(t.planStatus==='in_review')next={title:t.waitingOn?`Waiting on ${t.waitingOn}`:'Waiting for approval',detail:'Nothing to do right now. You’ll get a message in your inbox when it’s decided.'};
 else if(!back)next=away
  ?{title:'You’re traveling',detail:`Keep your receipts. When you’re back on ${day(t.returnDate)}, add your expenses.`,action:{label:'Add expenses',to:'expenses'}}
  :{title:'Enter your trip in DTS',detail:`Approved. Copy your trip into DTS and book your travel before ${day(t.departure)}.`,action:{label:'Enter this in DTS',to:'dts'}};
 else if(!filed)next={title:'Add your expenses',detail:'Add what you spent and your receipts, then check your voucher.',action:{label:'Add expenses',to:'expenses'}};
 else next={title:'Enter your voucher in DTS',detail:'Copy your expenses into DTS and attach your documents. Then wait for payment.',action:{label:'Enter this in DTS',to:'dts'}};
 return {steps,next};
}
