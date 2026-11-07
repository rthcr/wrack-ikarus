// PostToolUse-Hook: prüft nach jeder Änderung die JS-Syntax.
//  - .js/.mjs: per `node --check` (src/ ist über src/package.json als ES-Modul markiert)
//  - .html:   alle Inline-<script>-Blöcke (z. B. public/classic/index.html)
// Exit 2 + stderr meldet Fehler an Claude zurück; sonst Exit 0.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input || '{}').tool_input?.file_path ?? '';

if (/\.(m?js)$/.test(file) && !file.includes('node_modules')) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`JS-Syntaxfehler in ${file}:\n\n${(r.stderr || '').trim()}`);
    process.exit(2);
  }
  process.exit(0);
}
if (!file.endsWith('.html')) process.exit(0);

const html = readFileSync(file, 'utf8');
const re = /<script(?![^>]*\b(src|type="module")=?)[^>]*>([\s\S]*?)<\/script>/gi;
const errors = [];

for (let m; (m = re.exec(html)); ) {
  // Zeilenversatz, damit Fehlermeldungen auf die Zeile in der HTML-Datei zeigen
  const lineOffset = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length - 1;
  try {
    new vm.Script(m[2], { filename: file, lineOffset });
  } catch (e) {
    const where = e.stack?.split('\n')[0] ?? file;
    errors.push(`${where}\n${e.name}: ${e.message}`);
  }
}

if (errors.length) {
  console.error(`JS-Syntaxfehler in ${file}:\n\n${errors.join('\n\n')}`);
  process.exit(2);
}
