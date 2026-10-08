// Generates docs/demo/sample-cv-raka-pratama.pdf from docs/demo/sample-cv.txt
// with a tiny dependency-free PDF writer (text-based, so CV parsing works).
//   node infra/scripts/make-sample-cv.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lines = readFileSync(resolve(root, 'docs/demo/sample-cv.txt'), 'utf8').replace(/\r/g, '').split('\n');
const HEADINGS = new Set(['SUMMARY', 'EDUCATION', 'EXPERIENCE', 'ORGANIZATIONAL EXPERIENCE', 'PROJECTS', 'COMPETITIONS', 'CERTIFICATIONS', 'SKILLS']);
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function wrap(text, max) {
  const words = text.split(' ');
  const out = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max) {
      out.push(line);
      line = (text.startsWith('- ') ? '  ' : '') + w;
    } else line = (line ? line + ' ' : '') + w;
  }
  if (line) out.push(line);
  return out;
}

let y = 790;
const ops = [];
const text = (font, size, x, str) => ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(str)}) Tj ET`);
lines.forEach((raw, i) => {
  if (!raw.trim()) {
    y -= 6;
    return;
  }
  if (i === 0) {
    text('F2', 20, 56, raw);
    y -= 22;
  } else if (i <= 2) {
    text('F1', 10, 56, raw);
    y -= 14;
  } else if (HEADINGS.has(raw.trim())) {
    y -= 6;
    text('F2', 11, 56, raw);
    ops.push(`0.04 0.71 0.42 RG 0.8 w 56 ${y - 4} m 539 ${y - 4} l S`);
    y -= 17;
  } else {
    const bold = !raw.startsWith('- ') && / - /.test(raw) && raw.length < 90;
    for (const part of wrap(raw, 100)) {
      text(bold ? 'F2' : 'F1', 9.5, raw.startsWith('- ') ? 64 : 56, part);
      y -= 13;
    }
  }
});

const content = ops.join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((o, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(resolve(root, 'docs/demo/sample-cv-raka-pratama.pdf'), pdf, 'latin1');
console.log('Wrote docs/demo/sample-cv-raka-pratama.pdf');
