import { describe, expect, it } from 'vitest'
import { containsTable, isSafeHref, parseInline, parseMarkdown } from './markdown-parse'

describe('parseMarkdown 块级结构', () => {
  it('把围栏代码块原样保留，并带上语言', () => {
    const blocks = parseMarkdown('说明：\n\n```ts\nconst a = 1\nconst b = 2\n```\n')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({ type: 'paragraph', text: '说明：' })
    expect(blocks[1]).toEqual({ type: 'code', lang: 'ts', code: 'const a = 1\nconst b = 2' })
  })

  it('流式输出里未闭合的围栏按代码吃到结尾', () => {
    const blocks = parseMarkdown('```js\nconsole.log(1)')
    expect(blocks).toEqual([{ type: 'code', lang: 'js', code: 'console.log(1)' }])
  })

  it('识别标题、分隔线、引用与列表', () => {
    const blocks = parseMarkdown('## 结论\n\n> 一句引用\n\n- 第一项\n- 第二项\n\n---')
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'quote',
      'list',
      'rule',
    ])
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: '结论' })
    expect(blocks[2]).toEqual({ type: 'list', ordered: false, items: ['第一项', '第二项'] })
  })

  it('区分有序列表', () => {
    const blocks = parseMarkdown('1. 打开页面\n2. 读取快照')
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: true, items: ['打开页面', '读取快照'] })
  })

  it('解析管道表格', () => {
    const blocks = parseMarkdown('| 工具 | 结果 |\n| --- | --- |\n| click | 成功 |')
    expect(blocks[0]).toEqual({
      type: 'table',
      header: ['工具', '结果'],
      rows: [['click', '成功']],
    })
  })

  it('相邻普通行合成一个段落', () => {
    const blocks = parseMarkdown('第一行\n第二行')
    expect(blocks).toEqual([{ type: 'paragraph', text: '第一行\n第二行' }])
  })

  it('空输入不产生块', () => {
    expect(parseMarkdown('   \n\n')).toEqual([])
  })
})

describe('containsTable', () => {
  it('识别带分隔行的表格', () => {
    expect(containsTable('| a | b |\n| --- | --- |\n| 1 | 2 |')).toBe(true)
  })

  it('普通段落里的竖线不算表格', () => {
    expect(containsTable('用 a | b 表示或运算')).toBe(false)
  })

  it('只有分隔行没有表头不算表格', () => {
    expect(containsTable('| --- | --- |')).toBe(false)
  })
})

describe('parseInline 行内标记', () => {
  it('代码片段优先，星号不当强调', () => {
    expect(parseInline('用 `a * b` 计算')).toEqual([
      { type: 'text', text: '用 ' },
      { type: 'code', text: 'a * b' },
      { type: 'text', text: ' 计算' },
    ])
  })

  it('加粗、斜体、删除线与链接', () => {
    expect(parseInline('**粗** _斜_ ~~删~~ [文档](https://example.com)')).toEqual([
      { type: 'strong', text: '粗' },
      { type: 'text', text: ' ' },
      { type: 'em', text: '斜' },
      { type: 'text', text: ' ' },
      { type: 'del', text: '删' },
      { type: 'text', text: ' ' },
      { type: 'link', text: '文档', href: 'https://example.com' },
    ])
  })

  it('未闭合的标记保持纯文本', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', text: '2 * 3 = 6' }])
  })
})

describe('isSafeHref', () => {
  it('只放行 http(s) 与 mailto', () => {
    expect(isSafeHref('https://example.com')).toBe(true)
    expect(isSafeHref('http://example.com')).toBe(true)
    expect(isSafeHref('mailto:a@b.com')).toBe(true)
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
    expect(isSafeHref('data:text/html,<script>')).toBe(false)
    expect(isSafeHref('/relative/path')).toBe(false)
  })
})
