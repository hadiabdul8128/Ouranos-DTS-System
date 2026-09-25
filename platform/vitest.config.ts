import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['platform/tests/**/*.test.ts'],exclude:['platform/tests/**/*.integration.test.ts'],environment:'node',testTimeout:10000}});
