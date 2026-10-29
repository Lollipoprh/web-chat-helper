import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// 使用应用包作为解析锚点，兼容 workspace 未将 TypeScript 提升到根 node_modules 的情况。
const require = createRequire(new URL('../apps/chrome-extension/package.json', import.meta.url));
const ts = require('typescript');

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUT = path.join(ROOT, 'docs', 'ai', 'codemap');
const HEADER = '<!-- 由 pnpm map 生成，请勿手工编辑；一致性由 pnpm map:check 保证 -->';
const WORKSPACE_PACKAGES = new Set(['agent-core', 'llm-client', 'browser-tools']);
const GROUPS = [
  { file: 'llm-client.md', match: ['packages/llm-client/src/'] },
  { file: 'agent-core.md', match: ['packages/agent-core/src/'] },
  { file: 'browser-tools.md', match: ['packages/browser-tools/src/'] },
  { file: 'ext-sidepanel.md', match: ['apps/chrome-extension/src/sidepanel/'] },
  { file: 'ext-options.md', match: ['apps/chrome-extension/src/options/'] },
  { file: 'ext-background.md', match: ['apps/chrome-extension/src/background/'] },
  { file: 'ext-content.md', match: ['apps/chrome-extension/src/content/'] },
  { file: 'ext-shared.md', match: ['apps/chrome-extension/src/shared/'] },
  {
    file: 'ext-config.md',
    match: ['apps/chrome-extension/manifest.config.ts', 'apps/chrome-extension/vite.config.ts'],
  },
];
const ALL_GROUPS = [...GROUPS, { file: 'ext-misc.md', match: [] }];

function posix(value) {
  return value.split(path.sep).join('/');
}

function relativePath(filePath) {
  return posix(path.relative(ROOT, filePath));
}

function lineCount(text) {
  return text === '' ? 0 : text.split(/\r?\n/).length;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.test\.ts$|\.d\.ts$/.test(entry.name) || /(?:node_modules|dist|\.screenshots)/.test(fullPath)) return [];
    return [fullPath];
  });
}

function sourceFiles() {
  const files = fs.readdirSync(ROOT, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || !['apps', 'packages'].includes(entry.name)) return [];
    const parent = path.join(ROOT, entry.name);
    return fs.readdirSync(parent, { withFileTypes: true }).flatMap((unit) => {
      if (!unit.isDirectory()) return [];
      return walk(path.join(parent, unit.name, 'src'));
    });
  });
  for (const config of ['apps/chrome-extension/manifest.config.ts', 'apps/chrome-extension/vite.config.ts']) {
    const fullPath = path.join(ROOT, config);
    if (fs.existsSync(fullPath)) files.push(fullPath);
  }
  return files.sort();
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function declarationName(node) {
  return node.name?.getText() ?? null;
}

function getSummary(source, firstStatement) {
  if (!firstStatement) return '';
  const leading = source.slice(0, firstStatement.getFullStart());
  const comments = [...leading.matchAll(/(?:^|\n)\s*(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g)];
  if (comments.length === 0) return '';
  const raw = comments[comments.length - 1][1]
    .replace(/^\/\/\s?/, '')
    .replace(/^\/\*[\s\S]*?\*\/$/, '')
    .replace(/^\s*\* ?/gm, '')
    .trim();
  const sentence = raw.split(/(?<=[.!?。！？])\s+/)[0];
  return sentence.slice(0, 60);
}

function resolveImport(filePath, specifier) {
  const base = path.resolve(path.dirname(filePath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
  const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return match ? relativePath(match) : null;
}

function importInfo(filePath, sourceFile) {
  const internal = new Set();
  const workspace = new Set();
  const external = new Set();
  const reexports = new Set();
  for (const statement of sourceFile.statements) {
    const moduleSpecifier = statement.moduleSpecifier?.text;
    if (typeof moduleSpecifier !== 'string') continue;
    if (moduleSpecifier.startsWith('.')) {
      const resolved = resolveImport(filePath, moduleSpecifier);
      if (resolved) internal.add(resolved);
      if (ts.isExportDeclaration(statement)) reexports.add(moduleSpecifier);
      continue;
    }
    const packageName = moduleSpecifier.startsWith('@')
      ? moduleSpecifier.split('/').slice(0, 2).join('/')
      : moduleSpecifier.split('/')[0];
    if (WORKSPACE_PACKAGES.has(packageName)) workspace.add(packageName);
    else external.add(packageName);
    if (ts.isExportDeclaration(statement)) reexports.add(moduleSpecifier);
  }
  return { internal, workspace, external, reexports };
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
  const symbols = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) continue;
    const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals === false) symbols.push({ name: 'default', line });
      continue;
    }
    if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
        symbols.push({ name: 'default', line });
        continue;
      }
      const name = declarationName(statement);
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.name && ts.isIdentifier(declaration.name)) symbols.push({ name: declaration.name.text, line });
        }
      } else if (name) symbols.push({ name, line });
    }
  }
  const imports = importInfo(filePath, sourceFile);
  return {
    path: relativePath(filePath),
    lines: lineCount(source),
    summary: getSummary(source, sourceFile.statements[0]),
    symbols,
    imports,
  };
}

function groupFor(filePath) {
  const match = GROUPS.find((group) => group.match.some((prefix) => filePath === prefix || filePath.startsWith(prefix)));
  return match ?? ALL_GROUPS[ALL_GROUPS.length - 1];
}

function unitName(filePath) {
  const parts = filePath.split('/');
  return parts[0] === 'packages' ? `packages/${parts[1]}` : `apps/${parts[1]}`;
}

function displayPath(filePath) {
  const unit = unitName(filePath);
  return filePath.startsWith(`${unit}/`) ? filePath.slice(unit.length + 1) : filePath;
}

function formatList(values) {
  return values.length ? values.map((value) => `\`${value}\``).join(', ') : '-';
}

function renderGroup(group, records, reverse) {
  const units = [...new Set(records.map((record) => unitName(record.path)))];
  const heading = units.length === 1 ? units[0] : '多模块文件';
  const totalLines = records.reduce((sum, record) => sum + record.lines, 0);
  const output = [HEADER, '', `# ${heading}（${records.length} 文件 / 约 ${totalLines} 行）`, ''];
  for (const record of records.sort((a, b) => a.path.localeCompare(b.path))) {
    output.push(`## ${displayPath(record.path)} (${record.lines} 行)`);
    if (record.summary) output.push(`摘要：${record.summary}`);
    for (const symbol of record.symbols) output.push(`- :${symbol.line} — \`${symbol.name}\``);
    if (record.imports.reexports.size) output.push(`reexports: ${formatList([...record.imports.reexports].sort())}`);
    output.push(`imports: ${formatList([...record.imports.internal, ...record.imports.workspace].sort())}`);
    const usedBy = reverse.get(record.path) ?? [];
    output.push(`used by: ${formatList(usedBy.sort())}`, '');
  }
  return `${output.join('\n').trimEnd()}\n`;
}

function renderOverview(records) {
  const units = new Map();
  for (const record of records) {
    const unit = unitName(record.path);
    const item = units.get(unit) ?? { files: 0, lines: 0, deps: new Set() };
    item.files += 1;
    item.lines += record.lines;
    for (const dependency of record.imports.workspace) item.deps.add(dependency);
    units.set(unit, item);
  }
  const output = [HEADER, '', '# 模块总览', '', '| 单元 | 文件数 | 行数 | 依赖（workspace 内） |', '| --- | ---: | ---: | --- |'];
  for (const [unit, item] of units) output.push(`| ${unit} | ${item.files} | ${item.lines} | ${formatList([...item.deps].sort())} |`);
  output.push('', '## 依赖方向（由 import 推导）');
  for (const [unit, item] of units) {
    if (item.deps.size) output.push(`- ${unit} → ${[...item.deps].sort().join(', ')}`);
  }
  output.push('', '## 热文件（行数降序 Top 10）', '', '| 路径 | 行数 |', '| --- | ---: |');
  for (const record of [...records].sort((a, b) => b.lines - a.lines).slice(0, 10)) output.push(`| ${record.path} | ${record.lines} |`);
  return `${output.join('\n')}\n`;
}

function buildOutputs() {
  const records = sourceFiles().map(inspectFile);
  const known = new Set(records.map((record) => record.path));
  const reverse = new Map(records.map((record) => [record.path, []]));
  for (const record of records) {
    for (const imported of record.imports.internal) {
      if (known.has(imported)) reverse.get(imported).push(record.path);
    }
  }
  const grouped = new Map(ALL_GROUPS.map((group) => [group.file, []]));
  for (const record of records) grouped.get(groupFor(record.path).file).push(record);
  const assigned = [...grouped.values()].reduce((sum, group) => sum + group.length, 0);
  if (assigned !== records.length) throw new Error(`文件分组不完整：${assigned}/${records.length}`);
  const outputs = new Map([['_overview.md', renderOverview(records)]]);
  for (const group of ALL_GROUPS) outputs.set(group.file, renderGroup(group, grouped.get(group.file), reverse));
  return outputs;
}

function main() {
  const check = process.argv.includes('--check');
  const outputs = buildOutputs();
  fs.mkdirSync(OUTPUT, { recursive: true });
  const existing = new Set(fs.readdirSync(OUTPUT).filter((name) => name.endsWith('.md')));
  let failed = false;
  for (const [name, content] of outputs) {
    const target = path.join(OUTPUT, name);
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (check) {
      if (current !== content) {
        failed = true;
        console.error(`${name}: 内容不一致`);
      }
    } else {
      fs.writeFileSync(target, content);
    }
    existing.delete(name);
  }
  for (const extra of existing) {
    failed = true;
    if (check) console.error(`${extra}: 多余生成文件`);
    else fs.unlinkSync(path.join(OUTPUT, extra));
  }
  if (check) {
    if (failed) process.exitCode = 1;
    else console.log(`codemap 一致性通过（${outputs.size} 个文件）`);
  } else {
    console.log(`已生成 ${outputs.size} 个 codemap 文件`);
  }
}

main();
