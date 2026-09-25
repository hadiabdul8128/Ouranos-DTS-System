import type {Entity} from '../contracts';
import type {Allowance} from './voucher-adapter';
export interface TravelPackage {
 id:string;status:string;revisionId:string;sha256:string;destination:string;html:string;generatedAt:string;
 perDiem:Allowance|null;documents:Entity[];snapshot:Record<string,unknown>;
 checklist:{steps:Array<{title:string;items:Array<{text:string;evidence?:string;rule?:string;source?:string;warning?:boolean}>}>;receiptLabels:Record<string,string>;gtcc:number};
}
