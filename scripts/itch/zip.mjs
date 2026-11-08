// Packt dist-itch/ in wrack-ikarus-itch.zip (zum Hochladen auf itch.io; index.html liegt im ZIP ganz oben).
// Ohne zusätzliche Pakete: einfacher ZIP-Schreiber mit Deflate aus node:zlib.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const SRC = 'dist-itch', OUT = 'wrack-ikarus-itch.zip';
const files = [];
// Ohne die klassische Fassung (nur auf der eigenen Seite) und ohne Linkvorschau-Bild
const SKIP = new Set(['classic', 'og.png']);
(function walk(d) { for (const n of readdirSync(d).sort()) { if (d === SRC && SKIP.has(n)) continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(SRC);

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const parts = [], central = []; let off = 0;
// feste Zeit (1.1.2026), damit gleiche Dateien ein gleiches ZIP ergeben
const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
for (const f of files) {
  const name = Buffer.from(relative(SRC, f).split('\\').join('/')), data = readFileSync(f), crc = crc32(data);
  const comp = deflateRawSync(data, { level: 9 }), useDeflate = comp.length < data.length, body = useDeflate ? comp : data;
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(useDeflate ? 8 : 0, 8);
  h.writeUInt16LE(dosTime, 10); h.writeUInt16LE(dosDate, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  parts.push(h, name, body);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(useDeflate ? 8 : 0, 10);
  c.writeUInt16LE(dosTime, 12); c.writeUInt16LE(dosDate, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
  central.push(c, name);
  off += h.length + name.length + body.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
writeFileSync(OUT, Buffer.concat([...parts, cd, end]));
console.log(`${OUT}: ${files.length} Dateien, ${(statSync(OUT).size / 1048576).toFixed(1)} MB`);
