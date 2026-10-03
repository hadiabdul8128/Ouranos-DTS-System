import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { DEMO_WORKSPACES } from './demo-workspaces';
loadEnv({path:process.env.OURANOS_ENV_FILE || '.env.platform',quiet:true});
const environment=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 PORT:z.coerce.number().default(4100),HOST:z.string().default('127.0.0.1'),
 DATABASE_URL:z.string().min(1),DATABASE_SSL:z.enum(['disable','verify-full']).default('verify-full'),
 DATABASE_CA_CERT:z.string().optional(),
 SUPABASE_URL:z.string().url(),SUPABASE_PUBLISHABLE_KEY:z.string().min(1),SUPABASE_SECRET_KEY:z.string().min(1),
 ALLOWED_ORIGINS:z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
 OCR_PROVIDER:z.enum(['disabled','http']).default('disabled'),OCR_URL:z.string().url().optional(),OCR_TOKEN:z.string().optional(),
 SCAN_PROVIDER:z.enum(['disabled','http']).default('disabled'),SCAN_URL:z.string().url().optional(),SCAN_TOKEN:z.string().optional(),
 DTS_PROVIDER:z.enum(['disabled','mock']).default('disabled'),
 APPROVAL_MODE:z.enum(['required','preview','automatic']).default('required'),
 WORKER_POLL_MS:z.coerce.number().min(100).default(2000),
 // Workspaces (comma-separated IDs) where a traveler may approve their own authorization for a demo. Empty means nowhere.
 DEMO_APPROVAL_ORGANIZATIONS:z.string().default('').transform(value=>value.split(',').map(id=>id.trim()).filter(Boolean)).pipe(z.array(z.string().uuid())),
});
export type PlatformConfig=z.infer<typeof environment>;
export function readConfig():PlatformConfig {
 const c=environment.parse(process.env);
 c.DEMO_APPROVAL_ORGANIZATIONS=[...new Set([...DEMO_WORKSPACES,...c.DEMO_APPROVAL_ORGANIZATIONS])];
 // Production Authorization requires the assigned human review sequence.
 // Retain alternative modes only for development; a stale deployment variable
 // must not silently bypass approval after restoring the production workflow.
 if(c.NODE_ENV==='production')c.APPROVAL_MODE='required';
 if(c.NODE_ENV==='production'&&c.DATABASE_SSL!=='verify-full')throw new Error('Production requires verified database TLS');
 if(c.NODE_ENV==='production'&&c.DTS_PROVIDER==='mock')throw new Error('Mock DTS is development-only');
 if(c.OCR_PROVIDER==='http'&&!c.OCR_URL)throw new Error('OCR_URL required');
 if(c.SCAN_PROVIDER==='http'&&!c.SCAN_URL)throw new Error('SCAN_URL required');
 return c;
}
