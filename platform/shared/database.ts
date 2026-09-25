import pg, { type PoolClient } from 'pg';
import { type PlatformConfig } from './config';
export const makePool=(config:PlatformConfig)=>new pg.Pool({connectionString:config.DATABASE_URL,max:10,connectionTimeoutMillis:10000,ssl:config.DATABASE_SSL==='verify-full'?{rejectUnauthorized:true}:false});
export async function withActor<T>(pool:pg.Pool,userId:string,organizationId:string|undefined,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
 const db=await pool.connect();
 try{
  await db.query('begin');
  await db.query('set local role ouranos_api');
  await db.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",[userId,JSON.stringify({sub:userId,role:'authenticated'})]);
  if(organizationId){
   // Serialize writes/pulls within an organization so cursor ordering follows commit ordering.
   await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[organizationId]);
  }
  const result=await fn(db);await db.query('commit');return result;
 }catch(error){await db.query('rollback');throw error}finally{db.release()}
}
