/** Only routes the request. Never creates records or sends anything externally. */
export function workspaceIntent(text:string):'/dashboard/travel'|'/dashboard/transition'|'/dashboard/help'|'/dashboard/meetings'|null {
 if(/\b(don't|do not|not|no|cancel)\b/i.test(text))return null;
 if(/\b(meeting|meetings|meet|call|calls|conference|conferencing|video chat)\b/i.test(text))return '/dashboard/meetings';
 if(/\b(transition|civilian|career|careers|job|jobs|veteran|veterans|after (?:the )?military)\b/i.test(text))return '/dashboard/transition';
 if(/\b(help|guide|guides|how (?:do|to|does|can))\b/i.test(text))return '/dashboard/help';
 if(/\b(travel(?:ing|ling)?|trip|trips|dts|flight|flights|voucher|reimbursement|tdy)\b/i.test(text))return '/dashboard/travel';
 return null;
}
