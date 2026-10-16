import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const marker = JSON.parse(readFileSync(new URL('../public/release.json', import.meta.url), 'utf8'));
const revision = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('A valid source revision is required for the release marker');
writeFileSync(new URL('../dist/release.json', import.meta.url), JSON.stringify({ ...marker, source_commit: revision }, null, 2) + '\n');
