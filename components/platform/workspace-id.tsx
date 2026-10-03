'use client';
import {useState} from 'react';
import {Check,Copy} from 'lucide-react';
import './workspace-id.css';

/** The current workspace's ID with a copy button, for settings that are keyed by workspace (like demo approval). */
export function WorkspaceId({id,demoApproval}:{id:string;demoApproval:boolean}){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(id);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{setCopied(false)}}
 return <div className="workspace-id">
  <span>Workspace ID</span>
  <div><code>{id}</code><button type="button" onClick={()=>void copy()} aria-label="Copy workspace ID">{copied?<Check size={14}/>:<Copy size={14}/>}{copied?'Copied':'Copy'}</button></div>
  <small>{demoApproval?'Demo approval is on for this workspace.':'To turn on demo approval, add this ID to DEMO_APPROVAL_ORGANIZATIONS on the API in Railway.'}</small>
 </div>;
}
