import {housingSupportPhone,transitionResources} from '@/packages/domain/transition/resources';
export function TransitionSupport({open=false}:{open?:boolean}){
 return <details className="transition-support" open={open||undefined}>
  <summary>Need help with housing right now?</summary>
  <div><p>You can get support without finishing this plan. If you are a veteran without stable housing or at risk of losing it, a VA counselor can help you explore options.</p>
  <a className="transition-call" href={housingSupportPhone.href}>Call {housingSupportPhone.label}</a><span>Free, confidential support · available 24/7</span>
  <p><a href={transitionResources.housing.url} target="_blank" rel="noopener noreferrer">Chat with VA or learn about housing support ↗</a></p></div>
 </details>;
}
