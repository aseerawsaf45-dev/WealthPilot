/**
 * Copies browser-side worker/wasm files for document reading into public/vendor (self-hosted, so the
 * CSP needs no third-party script hosts). Runs on postinstall; the output is gitignored.
 * The OCR language file (public/vendor/tesseract/lang/eng.traineddata.gz) is committed.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public', 'vendor');
const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract/core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'pdfjs/pdf.worker.min.js'], // .js, not .mjs: some hosts serve .mjs as text/plain and browsers refuse module workers
];
let copied = 0;
for (const [from, to] of copies) {
  const src = path.join(root, from);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-vendor] missing ${from} (document reading will be unavailable)`);
    continue;
  }
  const dest = path.join(out, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}
console.log(`[copy-vendor] ${copied}/${copies.length} files → public/vendor`);
