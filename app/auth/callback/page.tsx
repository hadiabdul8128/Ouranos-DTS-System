'use client';
import {useEffect,useState} from 'react';
import {browserAuth} from '@/lib/platform/browser';
export default function Callback(){
 const [message,setMessage]=useState('Completing sign in…');
 useEffect(()=>{
  const auth=browserAuth();if(!auth){setMessage('Authentication is not configured');return}
  let cancelled=false;
  void(async()=>{
   try{
    const query=new URLSearchParams(window.location.search),hash=new URLSearchParams(window.location.hash.slice(1));
    if(query.has('error')||hash.has('error'))throw new Error(query.get('error_description')||hash.get('error_description')||'This sign-in link is invalid or expired. Request a new link.');
    // browserAuth enables detectSessionInUrl. Its initialization exchanges the
    // PKCE code once; a second exchange here would reuse an already-spent code.
    const {error:initializationError}=await auth.auth.initialize();
    if(initializationError)throw initializationError;
    const {data,error}=await auth.auth.getSession();
    if(error)throw error;
    if(!data.session)throw new Error('This sign-in link is invalid or expired. Request a new link.');
    if(!cancelled)window.location.replace('/dashboard');
   }catch(e){if(!cancelled)setMessage(e instanceof Error?e.message:'Sign in failed')}
  })();
  return()=>{cancelled=true};
 },[]);
 return <main className="quiet-page"><div className="platform-loading"><p role="status">{message}</p><a href="/">Back to sign in</a></div></main>
}
