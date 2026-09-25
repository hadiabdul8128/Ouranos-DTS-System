import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'ocr');
const coreTarget = join(target, 'core');
const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'));
const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
const languageRoot = dirname(require.resolve('@tesseract.js-data/eng/package.json'));
mkdirSync(coreTarget, { recursive: true });
copyFileSync(join(tesseractRoot, 'dist', 'worker.min.js'), join(target, 'worker.min.js'));
copyFileSync(join(languageRoot, '4.0.0_best_int', 'eng.traineddata.gz'), join(target, 'eng.traineddata.gz'));
for (const kind of ['lstm', 'simd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const name = `tesseract-core-${kind}.${extension}`;
    copyFileSync(join(coreRoot, name), join(coreTarget, name));
  }
}
