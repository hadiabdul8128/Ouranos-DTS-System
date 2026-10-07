'use client';
import {useEffect,useState} from 'react';
import {Check,ChevronDown,ExternalLink,Plane,RotateCw} from 'lucide-react';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {cheapestFlight,localToday,type FlightOption,type FlightResults} from '@/packages/domain/flight-search';
import './flight-suggestions.css';

const stops=(n:number)=>n===0?'Nonstop':`${n} stop${n>1?'s':''}`;
const money=(n:number)=>`$${n.toLocaleString('en-US')}`;
const sameFlight=(a:FlightOption|null,b:FlightOption)=>Boolean(a)&&a!.airline===b.airline&&a!.departTime===b.departTime&&a!.arriveTime===b.arriveTime&&a!.price===b.price;

export type SelectedFlight={key:string;option:FlightOption};
export const flightSearchKey=(from:string,to:string,departure:string,returnDate:string)=>[from,to,departure,returnDate].map(v=>v.trim().toLocaleLowerCase('en-US')).join('|');
type Props={from:string;to:string;departure:string;returnDate:string;selected:SelectedFlight|null;onSelect:(value:SelectedFlight|null)=>void;disabled?:boolean};
export function FlightSuggestions({from,to,departure,returnDate,selected:chosen,onSelect,disabled}:Props){
 const [today]=useState(localToday),past=Boolean(departure)&&departure<today;
 const ready=!past&&from.trim().length>=2&&to.trim().length>=2&&Boolean(departure)&&(!returnDate||returnDate>=departure);
 const key=flightSearchKey(from,to,departure,returnDate);
 const [attempt,setAttempt]=useState(0),requestKey=`${key}#${attempt}`;
 const [state,setState]=useState<{requestKey:string;results:FlightResults|null;error:string}>({requestKey:'',results:null,error:''});
 const loading=ready&&state.requestKey!==requestKey,{results,error}=state,selected=chosen?.key===key?chosen.option:null;
 const select=(option:FlightOption|null)=>onSelect(option?{key,option}:null);
 useEffect(()=>{
  if(!ready)return;
  const abort=new AbortController();
  // Wait for typing to settle before searching.
  const timer=setTimeout(()=>{
   const params=new URLSearchParams({from:from.trim(),to:to.trim(),departure,...(returnDate?{returnDate}:{})});
   void fetch(`/api/flights?${params}`,{signal:abort.signal}).then(async response=>{const body=await response.json() as FlightResults&{error?:string};if(!response.ok)throw new Error(body.error||'Flight prices are unavailable right now.');return body}).then(value=>setState({requestKey,results:value,error:''})).catch(e=>{if(abort.signal.aborted)return;setState({requestKey,results:null,error:e instanceof Error?e.message:'Flight prices are unavailable right now.'})});
  },700);
  return()=>{clearTimeout(timer);abort.abort()};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready,requestKey]);

 if(past)return <p className="flight-hint"><Plane size={14}/> These trip dates have passed, so there are no flights to suggest.</p>;
 if(!ready)return <p className="flight-hint"><Plane size={14}/> Add your starting location to see suggested flights.</p>;
 if(loading)return <p className="flight-hint" role="status"><span className="flight-spinner"/> Checking fares…</p>;
 if(error)return <p className="flight-hint flight-error" role="alert">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}><RotateCw size={12}/> Retry</button></p>;
 if(!results)return null;
 if(!results.options.length)return <p className="flight-hint">No flights found for this route. Check the city and state, or use the nearest city with an airport. <a href={results.searchUrl} target="_blank" rel="noreferrer">Search Google Flights <ExternalLink size={11}/></a></p>;
 return <FlightChoices results={results} selected={selected} onSelect={select} disabled={disabled}/>;
}

/** Fare selection, separate from the search request lifecycle. */
export function FlightChoices({results,selected,onSelect:select,disabled}:{results:FlightResults;selected:FlightOption|null;onSelect:(option:FlightOption|null)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const cheapest=cheapestFlight(results.options),trip=results.options[0]!.roundTrip?'Round trip':'One way';
 return <div className="flight-field"><label id="flight-label">Airfare estimate <span>{trip} · Google Flights</span></label>
  <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="flight-trigger" aria-labelledby="flight-label" disabled={disabled}>
   {selected?<FlightSummary option={selected} best={sameFlight(results.options[0]!,selected)} cheapest={sameFlight(cheapest,selected)}/>:<span className="flight-none">Select a fare <span>From {money(cheapest!.price)}</span></span>}<ChevronDown size={16}/></button></PopoverTrigger>
   <PopoverContent align="start" className="flight-menu"><ul role="listbox" aria-labelledby="flight-label">{results.options.map((option,index)=><li key={index} role="option" aria-selected={sameFlight(selected,option)}><button type="button" onClick={()=>{select(option);setOpen(false)}}><FlightSummary option={option} best={index===0} cheapest={option===cheapest}/>{sameFlight(selected,option)&&<Check size={15}/>}</button></li>)}
    <li role="option" aria-selected={!selected}><button type="button" className="flight-skip" onClick={()=>{select(null);setOpen(false)}}>No flight</button></li></ul>
   <a className="flight-source" href={results.searchUrl} target="_blank" rel="noreferrer">See all on Google Flights <ExternalLink size={11}/></a></PopoverContent></Popover>
  <p className="flight-note">Suggestions only. Choosing one fills in an airfare estimate you can edit. Book through your travel office.</p></div>;
}

function FlightSummary({option,best,cheapest}:{option:FlightOption;best:boolean;cheapest:boolean}){
 return <span className="flight-summary"><span className="flight-line"><strong>{option.airline}</strong>{best&&<em>Google pick</em>}{cheapest&&<em className="cheap">Lowest fare</em>}<b>{money(option.price)}</b></span><span className="flight-meta">{option.departTime} – {option.arriveTime} · {stops(option.stops)} · {option.duration}</span></span>;
}
