// Runs `next <args>` with NODE_ENV=production. Hosts that inject NODE_ENV=development
// (e.g. Hostinger copying .env into the build env) otherwise mix React dev/prod builds and
// prerendering crashes with "Cannot read properties of null (reading 'useContext')".
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
const { status } = spawnSync(process.execPath, [nextBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
process.exit(status ?? 1);
