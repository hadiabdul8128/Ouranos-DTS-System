/**
 * Workspaces where travelers may use "Approve for demo" to skip their approvers while showing the product.
 * Kept in code so it ships with a normal push; DEMO_APPROVAL_ORGANIZATIONS on the server adds to it.
 * Only list workspaces used for demos — anyone in them can approve their own travel.
 */
export const DEMO_WORKSPACES:string[]=[
 'bf49a00f-1fb6-422f-ace7-1213b495307c', // demo workspace on the live site
];
