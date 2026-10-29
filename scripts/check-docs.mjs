import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = ['AGENTS.md'];
const docsRoot = path.join(ROOT, 'docs', 'ai');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
  });
}

files.push(...walk(docsRoot).map((file) => path.relative(ROOT, file)));
const pathPattern = /`([^`]+)`/g;
const errors = [];
let checked = 0;

for (const relativeFile of files) {
  const filePath = path.join(ROOT, relativeFile);
  if (!fs.existsSync(filePath)) continue;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let inFence = false;
  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    for (const match of line.matchAll(pathPattern)) {
      const token = match[1].replace(/:\d+$/, '');
      if (!/^(apps|packages|docs|scripts)\//.test(token) || /[\s*]/.test(token)) continue;
      checked += 1;
      if (token === 'docs/adr/') continue;
      if (!fs.existsSync(path.join(ROOT, token))) errors.push(`${relativeFile}:${index + 1} — 引用了不存在的路径: ${token}`);
    }
  });
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log(`docs 指针校验通过（${checked} 条）`);
}
