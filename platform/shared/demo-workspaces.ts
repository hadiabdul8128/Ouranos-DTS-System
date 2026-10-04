/**
 * Legacy allowlist used when global demo access is disabled. Travelers in these workspaces may use "Approve for demo" to skip their approvers while showing the product.
 * Kept in code so it ships with a normal push; DEMO_APPROVAL_ORGANIZATIONS on the server adds to it.
 * Global demo access is on by default, so this list no longer limits the live demo action.
 */
export const DEMO_WORKSPACES:string[]=[
 'bf49a00f-1fb6-422f-ace7-1213b495307c', // demo workspace on the live site
];
