import {z} from 'zod';
import {uuid} from './index';

/** Approve the caller's own submitted authorization at every level, in a workspace marked for demos. */
export const demoApproveInput=z.object({organizationId:uuid,authorizationId:uuid}).strict();
export const DEMO_APPROVAL_COMMENT='Approved for demo';
