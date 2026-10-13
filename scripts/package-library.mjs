import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pruneAssets } from './prune-assets.mjs';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const directory = 'release-assets';
mkdirSync(directory, { recursive: true });
execFileSync('npm', ['pack', '--pack-destination', directory], { stdio: 'inherit' });
const filename = `${manifest.name.replace(/^@/, '').replaceAll('/', '-')}-${manifest.version}.tgz`;
const archive = join(directory, filename);
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(`${archive}.sha256`, `${checksum}  ${filename}\n`);
console.log(`Archive and SHA256: ${archive}`);
// Only this release and the one before it stay in the folder.
const prefix = filename.slice(0, -`${manifest.version}.tgz`.length);
for (const name of pruneAssets(directory, manifest.version, [prefix]))
  console.log(`Removed ${name}`);
