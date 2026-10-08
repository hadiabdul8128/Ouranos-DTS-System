import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('../',import.meta.url))}},test:{include:['platform/tests/**/*.test.ts'],exclude:['platform/tests/**/*.integration.test.ts'],environment:'node',testTimeout:10000}});
