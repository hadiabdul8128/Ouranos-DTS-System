/** One-sentence meanings for the military travel terms travelers trip over. Keys are matched as whole words. */
export const GLOSSARY:Record<string,{name:string;meaning:string}>={
 AEA:{name:'Actual Expense Allowance',meaning:'Permission to be paid more than the normal lodging rate, up to 300%, when there’s a good reason.'},
 CTW:{name:'Constructed Travel Worksheet',meaning:'Compares the cost of driving with the cost of flying. You’re paid whichever is cheaper.'},
 TMC:{name:'Travel Management Company',meaning:'The travel agency that books and tickets your official travel. It charges a small fee per booking.'},
 ILP:{name:'Integrated Lodging Program',meaning:'On-base and preferred lodging you’re expected to use first at many installations.'},
 'M&IE':{name:'Meals and Incidental Expenses',meaning:'The daily amount for food and tips. It’s paid by per diem, not as an expense.'},
 GTCC:{name:'Government Travel Charge Card',meaning:'Your government travel card, used for official travel costs.'},
 IBA:{name:'Individually Billed Account',meaning:'Your own government travel card account, the one in your name.'},
 LOA:{name:'Line of Accounting',meaning:'The funding code that pays for the trip. Your unit tells you which one to pick.'},
 FCAL:{name:'Fund Cite Authorization Letter',meaning:'A letter from an outside organization saying it will pay for your trip.'},
 DFAC:{name:'Dining facility',meaning:'The base dining hall. When you can eat there, your meal rate is lower.'},
 ODTA:{name:'Organization Defense Travel Administrator',meaning:'Your unit’s travel administrator. Ask them about your account and funding.'},
 GSA:{name:'General Services Administration',meaning:'The agency that sets per diem rates and the discounted contract airfares.'},
 AO:{name:'Approving Official',meaning:'The person who approves your travel.'},
};
const TERMS=Object.keys(GLOSSARY).sort((a,b)=>b.length-a.length).map(term=>term.replace(/[&]/g,'\\$&'));
const PATTERN=new RegExp(`(?<![A-Za-z0-9&])(${TERMS.join('|')})(?![A-Za-z0-9&])`,'g');

/** Split text into plain parts and glossary terms, explaining each term only the first time it appears. */
export function splitTerms(text:string):Array<string|{term:string}>{
 const parts:Array<string|{term:string}>=[],seen=new Set<string>();let last=0;
 for(const match of text.matchAll(PATTERN)){
  const term=match[1]!;if(seen.has(term))continue;seen.add(term);
  if(match.index>last)parts.push(text.slice(last,match.index));
  parts.push({term});last=match.index+term.length;
 }
 if(last<text.length)parts.push(text.slice(last));
 return parts;
}
