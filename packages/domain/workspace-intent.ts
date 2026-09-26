/** Only routes the request. Never creates records or sends anything externally. */
export function workspaceIntent(text:string):'/dashboard/travel'|'/dashboard/transition'|'/dashboard/financial-readiness'|null {
 if(/\b(don't|do not|not|no|cancel)\b/i.test(text))return null;
 if(/\b(financial|finance|budget|budgeting|money|paycheck|paychecks|savings|saving|tsp)\b/i.test(text))return '/dashboard/financial-readiness';
 if(/\b(transition|civilian|career|careers|job|jobs|veteran|veterans|after (?:the )?military)\b/i.test(text))return '/dashboard/transition';
 if(/\b(travel(?:ing|ling)?|trip|trips|dts|flight|flights|voucher|reimbursement|tdy)\b/i.test(text))return '/dashboard/travel';
 return null;
}
