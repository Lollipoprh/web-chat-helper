import { describe, expect, it } from 'vitest'
import { mimeForDownload, resolveDownloadName } from './file-tools'

describe('mimeForDownload', () => {
  it('给 Markdown 文件返回与扩展名一致的 MIME', () => {
    // Chrome 会按 MIME 修正扩展名：text/plain 会把 report.md 存成 report.txt
    expect(mimeForDownload('report.md')).toBe('text/markdown')
    expect(mimeForDownload('README.MARKDOWN')).toBe('text/markdown')
  })

  it('常见文本格式各有对应 MIME', () => {
    expect(mimeForDownload('notes.txt')).toBe('text/plain')
    expect(mimeForDownload('data.json')).toBe('application/json')
    expect(mimeForDownload('table.csv')).toBe('text/csv')
    expect(mimeForDownload('page.html')).toBe('text/html')
  })

  it('没有把握的类型回落到 octet-stream，避免 Chrome 改写扩展名', () => {
    expect(mimeForDownload('script.py')).toBe('application/octet-stream')
    expect(mimeForDownload('config.yml')).toBe('application/octet-stream')
    expect(mimeForDownload('Makefile')).toBe('application/octet-stream')
  })
})

describe('resolveDownloadName', () => {
  it('没写扩展名时补 .md', () => {
    expect(resolveDownloadName('weekly-report')).toBe('weekly-report.md')
    expect(resolveDownloadName('notes/todo')).toBe('notes/todo.md')
  })

  it('保留调用方给的扩展名', () => {
    expect(resolveDownloadName('data.csv')).toBe('data.csv')
    expect(resolveDownloadName('notes/todo.md')).toBe('notes/todo.md')
  })

  it('通用名换成会话标题', () => {
    expect(resolveDownloadName('下载', '周报汇总')).toBe('周报汇总.md')
    expect(resolveDownloadName('download.md', 'Weekly report')).toBe('Weekly report.md')
  })

  it('标题里的路径分隔符不会把文件带进子目录', () => {
    expect(resolveDownloadName('下载', 'a/b')).toBe('a_b.md')
  })

  it('拒绝非法路径', () => {
    expect(resolveDownloadName('../escape.md')).toBeNull()
    expect(resolveDownloadName('')).toBeNull()
  })
})
