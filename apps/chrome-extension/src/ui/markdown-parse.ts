// Markdown 解析：把模型回复切成块级结构，再切成行内片段。
//
// 为什么自己写而不引三方库：
// 1. 侧栏只需要模型实际会产出的一小撮语法（代码块、列表、标题、表格、强调、链接）；
// 2. 渲染层直接用 React 元素拼装，全程不碰 innerHTML，模型输出不可能注入 HTML；
// 3. 少一个依赖，bundle 不涨。
//
// 解析结果是纯数据，渲染与安全校验都在 ../ui/Markdown.tsx 里，便于单测。

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'del'; text: string }
  | { type: 'link'; text: string; href: string }

export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'table'; header: string[]; rows: string[][] }

const FENCE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/
const HEADING = /^\s*(#{1,6})\s+(.*)$/
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/
const QUOTE = /^\s*>\s?(.*)$/
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

/**
 * 把 Markdown 源码切成块。
 * 未闭合的代码围栏（流式输出中途）按「到结尾都是代码」处理，避免内容闪烁。
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const lang = fence[2] ?? ''
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith(marker)) {
        code.push(lines[index])
        index += 1
      }
      // 跳过闭合围栏（如果有）
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
      })
      index += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []
      while (index < lines.length) {
        const match = QUOTE.exec(lines[index])
        if (!match) break
        quoted.push(match[1])
        index += 1
      }
      blocks.push({ type: 'quote', text: quoted.join('\n') })
      continue
    }

    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line)
      const items: string[] = []
      while (index < lines.length) {
        const match = LIST_ITEM.exec(lines[index])
        if (!match) break
        const isOrdered = /^\s*\d+[.)]/.test(lines[index])
        if (isOrdered !== ordered) break
        items.push(match[2])
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    if (line.includes('|') && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      const header = splitRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    // 段落：吃到空行或下一个块级起始行为止
    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index]
      if (!current.trim()) break
      if (paragraph.length > 0 && startsBlock(current)) break
      paragraph.push(current.trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
  }

  return blocks
}

function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    LIST_ITEM.test(line)
  )
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * 快速判断源码里有没有表格块。
 * 气泡据此放宽宽度：表格比普通段落更吃横向空间，被 88% 的宽度限制住只会更容易溢出。
 * 这里只扫一遍行、不做完整解析；误判的代价只是气泡宽了一点。
 */
export function containsTable(source: string): boolean {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  for (let index = 0; index + 1 < lines.length; index += 1) {
    if (lines[index].includes('|') && TABLE_DIVIDER.test(lines[index + 1])) return true
  }
  return false
}

/**
 * 行内解析。代码片段优先匹配，避免把 `a * b` 里的星号当成强调。
 * 不支持嵌套（例如加粗里再斜体），模型输出里极少出现，代价不值得。
 */
export function parseInline(source: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let rest = source

  while (rest.length > 0) {
    const code = /^`([^`\n]+)`/.exec(rest)
    if (code) {
      tokens.push({ type: 'code', text: code[1] })
      rest = rest.slice(code[0].length)
      continue
    }

    const link = /^\[([^\]\n]+)\]\(([^()\s]+)\)/.exec(rest)
    if (link) {
      tokens.push({ type: 'link', text: link[1], href: link[2] })
      rest = rest.slice(link[0].length)
      continue
    }

    const strong = /^(\*\*|__)([\s\S]+?)\1/.exec(rest)
    if (strong) {
      tokens.push({ type: 'strong', text: strong[2] })
      rest = rest.slice(strong[0].length)
      continue
    }

    const strike = /^~~([\s\S]+?)~~/.exec(rest)
    if (strike) {
      tokens.push({ type: 'del', text: strike[1] })
      rest = rest.slice(strike[0].length)
      continue
    }

    const em = /^(\*|_)([^*_\n]+?)\1/.exec(rest)
    if (em) {
      tokens.push({ type: 'em', text: em[2] })
      rest = rest.slice(em[0].length)
      continue
    }

    // 普通文本：吃到下一个可能开启行内标记的字符
    const nextSpecial = rest.slice(1).search(/[`[*_~]/)
    const size = nextSpecial < 0 ? rest.length : nextSpecial + 1
    tokens.push({ type: 'text', text: rest.slice(0, size) })
    rest = rest.slice(size)
  }

  // 合并相邻的纯文本片段，减少没必要的节点
  const merged: InlineToken[] = []
  for (const token of tokens) {
    if (token.type === 'text') {
      const previous = merged[merged.length - 1]
      if (previous && previous.type === 'text') {
        previous.text += token.text
        continue
      }
    }
    merged.push(token)
  }

  return merged
}

/** 只允许 http(s) 与 mailto；其余（javascript:、data:、file:…）按纯文本处理 */
export function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim())
}
