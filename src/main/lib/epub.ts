import JSZip from 'jszip'
import type { Chapter } from '../../shared/types'
import { normalizeNewlines } from './normalize'
import { detectChapters } from './chapters'

export interface OpfInfo {
  title: string | null
  /** spine 中的 idref 顺序 */
  spine: string[]
  /** manifest：id -> href */
  manifest: Map<string, string>
}

export interface EpubParseResult {
  title: string | null
  content: string
  chapters: Chapter[]
}

/** 解码常见的 HTML 实体与数字实体 */
export function decodeEntities(s: string): string {
  const toChar = (code: number): string => {
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
    try {
      return String.fromCodePoint(code)
    } catch {
      return ''
    }
  }
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => toChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => toChar(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

/** 把 EPUB 的 XHTML 片段提取为纯文本段落（每段一行） */
export function htmlToText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head\b[\s\S]*?<\/head>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  const withNewlines = cleaned
    .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr|table|figcaption)\b[^>]*>/gi, '\n')
  const noTags = withNewlines.replace(/<[^>]+>/g, '')
  return decodeEntities(noTags)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  const m = re.exec(tag)
  return m ? decodeEntities(m[1]).trim() : null
}

/** 从 container.xml 中定位 OPF 文件路径 */
export function findOpfPath(containerXml: string): string | null {
  const m = /<rootfile\b[^>]*full-path\s*=\s*["']([^"']+)["']/i.exec(containerXml)
  return m ? decodeEntities(m[1]).trim() : null
}

/** 解析 OPF：标题、manifest、spine 阅读顺序 */
export function parseOpf(opfXml: string): OpfInfo {
  const titleMatch = /<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opfXml)
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() || null : null

  const manifest = new Map<string, string>()
  const itemRe = /<item\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(opfXml)) !== null) {
    const id = attr(m[0], 'id')
    const href = attr(m[0], 'href')
    if (id && href) manifest.set(id, href)
  }

  const spine: string[] = []
  const itemrefRe = /<itemref\b[^>]*>/gi
  while ((m = itemrefRe.exec(opfXml)) !== null) {
    const idref = attr(m[0], 'idref')
    if (idref) spine.push(idref)
  }

  return { title, spine, manifest }
}

function dirnameZip(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx < 0 ? '' : p.slice(0, idx)
}

function stripFragment(href: string): string {
  const idx = href.indexOf('#')
  return idx < 0 ? href : href.slice(0, idx)
}

function decodeUri(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** 把 OPF 内相对 href 解析为 zip 内的规范路径 */
export function resolveRelative(baseDir: string, href: string): string {
  const clean = stripFragment(decodeUri(href))
  const joined = baseDir ? `${baseDir}/${clean}` : clean
  const out: string[] = []
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

/** 解析 EPUB 归档，返回统一文本内容与章节 */
export async function parseEpub(buf: Buffer): Promise<EpubParseResult> {
  const zip = await JSZip.loadAsync(buf)

  const containerEntry = zip.file('META-INF/container.xml')
  if (!containerEntry) throw new Error('EPUB 缺少 container.xml')
  const containerXml = await containerEntry.async('string')
  const opfPath = findOpfPath(containerXml)
  if (!opfPath) throw new Error('EPUB 无法定位 OPF 文件')

  const opfEntry = zip.file(opfPath)
  if (!opfEntry) throw new Error('EPUB 找不到 OPF 文件')
  const opfXml = await opfEntry.async('string')
  const opf = parseOpf(opfXml)
  const opfDir = dirnameZip(opfPath)

  const parts: string[] = []
  for (const idref of opf.spine) {
    const href = opf.manifest.get(idref)
    if (!href) continue
    const entry = zip.file(resolveRelative(opfDir, href))
    if (!entry) continue
    const html = await entry.async('string')
    const text = htmlToText(html)
    if (text) parts.push(text)
  }

  const content = normalizeNewlines(parts.join('\n'))
  return { title: opf.title, content, chapters: detectChapters(content) }
}
