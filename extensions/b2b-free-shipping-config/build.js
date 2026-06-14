import { build } from 'esbuild';
import path from 'path';

const baseDir = path.dirname(new URL(import.meta.url).pathname);
const entry = path.join(baseDir, 'src', 'index.tsx');
const outFile = path.join(baseDir, 'dist', 'b2b-free-shipping-config.js');

async function run() {
  await build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    logLevel: 'info',
    legalComments: 'none',
  });
  console.log('Built', outFile);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
