import Dexie,{type EntityTable} from 'dexie';
import type {Command,Entity,ApiError} from '../contracts/index';
export interface LocalRecord {key:string;kind:Entity['kind'];id:string;server?:Entity;local:Entity}
export interface PendingCommand {sequence?:number;commandId:string;entityKey:string;command:Command;state:'pending'|'blocked';attempts:number;error?:ApiError;createdAt:string}
export interface LocalFile {id:string;blob:Blob;mediaType:string;state:'pending'|'uploaded'|'blocked';error?:string}
export class OuranosDatabase extends Dexie {
 entities!:EntityTable<LocalRecord,'key'>;
 outbox!:EntityTable<PendingCommand,'sequence'>;
 files!:EntityTable<LocalFile,'id'>;
 meta!:EntityTable<{key:string;value:string},'key'>;
 constructor(scope:string){super(`ouranos-platform-v1:${scope}`);this.version(1).stores({entities:'key,kind,id',outbox:'++sequence,&commandId,entityKey,state',files:'id,state',meta:'key'})}
}
export const entityKey=(kind:string,id:string)=>`${kind}:${id}`;
