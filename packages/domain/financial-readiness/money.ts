/** Accept common USD input without stripping invalid text or silently rounding. */
export function parseFinancialMoney(text:string):number|null{
 const cleaned=text.trim().replace(/^\$\s*/,'');
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(cleaned))return null;
 const [whole,fraction='']=cleaned.replaceAll(',','').split('.');
 const minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(minor)&&minor<=1_000_000_000?minor:null;
}
export const financialMoney=(minor:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
export const financialInputMoney=(minor:number)=>(minor/100).toFixed(2);
