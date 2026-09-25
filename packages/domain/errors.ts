import type { ErrorCode } from '../contracts/index';
export class DomainError extends Error {
 constructor(public code:ErrorCode,message:string,public status=400,public details?:unknown){super(message);this.name='DomainError'}
}
export function requireCondition(condition:unknown,code:ErrorCode,message:string,status=400):asserts condition {
 if(!condition)throw new DomainError(code,message,status);
}
