/** Short picture guides for the Help page. Images are real screenshots in public/help, 640px wide. */
export type HelpStep={title:string;text:string;image:string;height:number;alt:string};
export type HelpGuide={id:string;title:string;summary:string;steps:HelpStep[]};

export const helpGuides:HelpGuide[]=[
 {id:'plan',title:'Plan a trip',summary:'Tell us where and when, add what it will cost, then send it for review.',steps:[
  {title:'Start a new trip',text:'Open Travel and press New trip.',image:'travel-start',height:400,alt:'Travel page with the New trip button and links to checklists, trip history and hotels'},
  {title:'Say where and when',text:'Type the nearest city and state, then the installation from block 12 of your orders. Use the dates on your orders and add the orders number if you have it.',image:'trip-where',height:1225,alt:'Trip form with Tacoma, WA, Joint Base Lewis-McChord, dates, orders number and Annual Tour'},
  {title:'Open your plan',text:'Your trip is saved. The plan page is where you add the details.',image:'plan-top',height:480,alt:'Plan page header for a Seattle trip'},
  {title:'Pick how you are getting there',text:'Choose flying, your own car, a rental, a government vehicle or other. If you fly, pick a suggested flight to fill in a cost estimate.',image:'plan-mode',height:631,alt:'Travel mode buttons and the suggested flights dropdown'},
  {title:'Add your costs',text:'Add each cost you expect: category, amount and an optional description. Official expense names are listed first.',image:'plan-costs',height:560,alt:'Planned expense with amount, currency and description'},
  {title:'Answer the plan questions',text:'The Before you send your plan card asks about choices that need a reason, like a flight that isn’t a GSA fare. See Avoid delays.',image:'preaudit-flight',height:740,alt:'Card asking whether the flight is a GSA contract fare'},
  {title:'Send it',text:'Press Submit for review. Save draft keeps it for later.',image:'plan-submit',height:110,alt:'Save draft and Submit for review buttons'},
 ]},
 {id:'approval',title:'Get it approved',summary:'Your request goes to your own S1, then your command. You don’t pick anyone.',steps:[
  {title:'See where it is',text:'The plan shows who has it now and how many steps are left.',image:'approval-status',height:290,alt:'Status card reading With S1 · Administration, step 1 of 2'},
  {title:'Watch your inbox',text:'You get a message when it is submitted, approved at each step, or sent back.',image:'inbox',height:1080,alt:'Inbox with authorization submitted and approved messages'},
  {title:'Check your trips',text:'Each trip on Travel shows its status: Plan, In review, or Add expenses once approved.',image:'trip-list',height:640,alt:'Trip list with statuses In review, Add expenses and Plan'},
  {title:'Know your chain',text:'Settings shows your S1 and command. If it is wrong or empty, ask your S1 to add you.',image:'chain',height:460,alt:'Your chain of command card in Settings'},
 ]},
 {id:'voucher',title:'File your voucher',summary:'After the trip, record what you actually spent and attach receipts.',steps:[
  {title:'Open the approved trip',text:'Pick the trip marked Add expenses. Your approved plan and budget are at the top.',image:'voucher-top',height:640,alt:'Expenses page showing the approved plan and budget'},
  {title:'Add each expense',text:'Press Add expense, pick the approved item, then enter the merchant, amount, date and how you paid.',image:'voucher-expense',height:1010,alt:'New expense form filled in for a Delta flight paid with GTCC'},
  {title:'Attach receipts',text:'Take a photo or upload a receipt. Keep receipts for airfare, lodging, rental cars and anything $75 or more.',image:'voucher-receipts',height:340,alt:'Take a photo and Upload receipt buttons'},
  {title:'Check your documents',text:'The checklist lists the documents your voucher needs and names any receipt still missing. Tick each one when you have it.',image:'voucher-docs',height:1185,alt:'Documents checklist with orders ticked and a missing Delta receipt'},
 ]},
 {id:'flags',title:'Avoid delays',summary:'Some choices need a reason before your approver can approve them. Ouranos asks about them while you plan, so nothing gets sent back.',steps:[
  {title:'Say why, if it isn’t a GSA fare',text:'Pick Yes or No for your flight. If No, write the reason. You can’t submit until it’s filled in, and your approver sees it.',image:'preaudit-flight',height:740,alt:'GSA fare question answered No with a reason'},
  {title:'Add the separate lines',text:'Claim the TMC booking fee and hotel taxes on their own lines. One tap adds each; you fill in the amount.',image:'preaudit-lines',height:560,alt:'Buttons to add a TMC fee line and a lodging tax line'},
  {title:'Hotel over the rate?',text:'If your hotel costs more than the GSA lodging rate, Ouranos shows by how much. Up to 300% can be approved.',image:'aea-numbers',height:645,alt:'Hotel over per diem card: $188 allowed, $400 per night, $636 over, 213%'},
  {title:'Write the AEA justification',text:'Start from a draft and fill in the parts in [brackets]. Your approver sees it with your plan.',image:'aea-draft',height:735,alt:'Drafted AEA justification with the allowed and actual rates'},
 ]},
 {id:'hotels',title:'Find a hotel',summary:'See FedRooms hotels near your destination, then book through your travel office.',steps:[
  {title:'Pick a trip',text:'Open Find hotels for a trip from Travel, then choose the trip.',image:'hotels-pick',height:560,alt:'List of trips to search hotels for'},
  {title:'Search',text:'The city comes from your trip. Add a work ZIP or hotel name to narrow it down.',image:'hotels-search',height:760,alt:'Hotel search with the trip city filled in'},
  {title:'Choose and book',text:'Copy a hotel’s details and book it through your travel office. On-base lodging may be required first.',image:'hotels-results',height:440,alt:'FedRooms hotel results in Seattle with Copy details and View on map'},
 ]},
 {id:'leaders',title:'For leaders',summary:'S1 and command: add your people, approve their requests and send checklists.',steps:[
  {title:'Add your people',text:'Open My people from Travel. Enter someone’s email to add them. Their requests come to you automatically.',image:'team-add',height:690,alt:'My people page with the add someone form'},
  {title:'See how they are doing',text:'Each person shows their trips, what is waiting on you and anything overdue.',image:'team-person',height:900,alt:'A person card with trips, waiting on you and overdue flags'},
  {title:'Approve requests',text:'Open Review inbox and pick a request.',image:'review-inbox',height:722,alt:'Review inbox with travel authorizations'},
  {title:'Decide',text:'Approve it, request changes or reject it. Add a comment if they need to fix something.',image:'review-decide',height:600,alt:'Decision area with Approve, Request changes and Reject'},
  {title:'Send a checklist',text:'Write the steps, one per line, pick a due date and the people. You see each person’s progress.',image:'team-checklist',height:890,alt:'Send a checklist form'},
 ]},
];

