// PostToolUse-Hook: prüft die Syntax aller Inline-<script>-Blöcke in bearbeiteten HTML-Dateien.
// Exit 2 + stderr meldet Fehler an Claude zurück; sonst Exit 0.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input || '{}').tool_input?.file_path ?? '';
if (!file.endsWith('.html')) process.exit(0);

const html = readFileSync(file, 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const errors = [];

for (let m; (m = re.exec(html)); ) {
  // Zeilenversatz, damit Fehlermeldungen auf die Zeile in der HTML-Datei zeigen
  const lineOffset = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length - 1;
  try {
    new vm.Script(m[1], { filename: file, lineOffset });
  } catch (e) {
    const where = e.stack?.split('\n')[0] ?? file;
    errors.push(`${where}\n${e.name}: ${e.message}`);
  }
}

if (errors.length) {
  console.error(`JS-Syntaxfehler in ${file}:\n\n${errors.join('\n\n')}`);
  process.exit(2);
}
