// Prepare a clean source snapshot without changing or deleting working-tree files.
// No database, upload, operator handoff or unrelated download enters the snapshot.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const destination = path.resolve(root, 'output', 'cloud-release', 'software');
if (fs.existsSync(destination)) throw new Error('Release snapshot already exists; use a new reviewed destination, never overwrite it');
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).toString().split('\0');
const allowedRoots = ['backend-typescript/', 'frontend/', 'deploy/', 'scripts/', 'docs/'];
const allowedRootFiles = ['.gitignore', '.dockerignore', '.env.example', 'AGENTS.md', 'AI_CONTEXT.md', 'README.md', 'netlify.toml', 'render.yaml'];
const exclude = /(?:^|\/)(?:node_modules|dist|build|storage|uploads|test-results|playwright-report|\.astro|\.gradle|\.local-backups|output|tmp)(?:\/|$)|^docs\/(?:Downloads|vyapar_ref|review-support|design|EVOLIX_Intelligence_Day0_Pack)(?:\/|$)/i;
const secretFile = /(?:^|\/)(?:\.env(?:\..*)?|\.operator-access\..*|local\.properties|.*\.(?:jks|keystore|dump|backup|pgdump|log|zip|mp4|pdf|docx|tsbuildinfo))$/i;
const checks = [
  ['google-client-secret', /GOCSPX-[\w-]{12,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['github-token', /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}\b/g],
  ['database-password-url', /postgres(?:ql)?:\/\/[^\s"'<>/]+:[^\s"'<>/@]+@/g],
];
const selected = [], findings = [];
for (const relative of [...new Set(files)].filter(Boolean).sort()) {
  if (!(allowedRoots.some(prefix => relative.startsWith(prefix)) || allowedRootFiles.includes(relative))) continue;
  if (['backend-typescript/drop.js', 'backend-typescript/drop2.js'].includes(relative)) continue; // Unguarded legacy one-off SQL utilities, not deployment tools.
  if (exclude.test(relative) && !relative.startsWith('backend-typescript/src/attachments/storage/')) continue;
  if (secretFile.test(relative) && !relative.endsWith('.env.example') && !relative.endsWith('.env.production.example')) continue;
  const source = path.join(root, relative);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
  const bytes = fs.readFileSync(source);
  if (!bytes.includes(0)) {
    const text = bytes.toString('utf8');
    for (const [rule, expression] of checks) {
      for (const match of text.matchAll(expression)) {
        // Explicit placeholder connections and disposable tests are not live credentials.
        if (rule === 'database-password-url' && /USER:PASSWORD|user:pass|runtime:password|test:test|app:app|restricted:password/i.test(match[0])) continue;
        if (rule === 'database-password-url' && relative.startsWith('backend-typescript/test/') && /^database\.invalid\//.test(text.slice(match.index + match[0].length))) continue;
        findings.push({ file: relative, line: text.slice(0, match.index).split('\n').length, rule });
      }
    }
  }
  selected.push(relative);
}
if (findings.length) {
  console.log(JSON.stringify({ status: 'BLOCKED', findings }, null, 2));
  process.exit(1);
}
for (const relative of selected) {
  const target = path.join(destination, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, relative), target);
}
console.log(JSON.stringify({ status: 'PREPARED', destination, files: selected.length, secretScan: 'no flagged patterns; manual review still required', excludes: ['old Git history', 'legacy archive', 'personal downloads', 'credentials', 'customer data', 'generated artifacts'] }, null, 2));
