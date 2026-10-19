import JSZip from 'jszip'
import type { Chapter } from '../../shared/types'
import { normalizeNewlines } from './normalize'
import { detectChapters } from './chapters'

export interface TocEntry {
  label: string
  href: string
}

export interface OpfInfo {
  title: string | null
  /** spine 中的 idref 顺序 */
  spine: string[]
  /** manifest：id -> href */
  manifest: Map<string, string>
  /** EPUB2 NCX 路径（相对 OPF） */
  ncxHref: string | null
  /** EPUB3 nav 文档路径（相对 OPF） */
  navHref: string | null
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

/** 解析 OPF：标题、manifest、spine 阅读顺序、NCX/nav 路径 */
export function parseOpf(opfXml: string): OpfInfo {
  const titleMatch = /<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opfXml)
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() || null : null

  const items: string[] = []
  const itemRe = /<item\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(opfXml)) !== null) items.push(m[0])

  const manifest = new Map<string, string>()
  for (const tag of items) {
    const id = attr(tag, 'id')
    const href = attr(tag, 'href')
    if (id && href) manifest.set(id, href)
  }

  const spine: string[] = []
  const itemrefRe = /<itemref\b[^>]*>/gi
  while ((m = itemrefRe.exec(opfXml)) !== null) {
    const idref = attr(m[0], 'idref')
    if (idref) spine.push(idref)
  }

  // NCX：优先 spine 的 toc 属性，其次 media-type 为 ncx 的 item
  let ncxId: string | null = null
  const tocAttr = /<spine\b[^>]*toc\s*=\s*["']([^"']+)["']/i.exec(opfXml)
  if (tocAttr) ncxId = tocAttr[1]
  // nav：properties 含 "nav" 的 item（EPUB3）
  let navId: string | null = null
  for (const tag of items) {
    const id = attr(tag, 'id')
    if (!id) continue
    const mediaType = attr(tag, 'media-type') ?? ''
    const props = attr(tag, 'properties') ?? ''
    if (!ncxId && mediaType === 'application/x-dtbncx+xml') ncxId = id
    if (!navId && /(^|\s)nav(\s|$)/.test(props)) navId = id
  }

  return {
    title,
    spine,
    manifest,
    ncxHref: ncxId ? (manifest.get(ncxId) ?? null) : null,
    navHref: navId ? (manifest.get(navId) ?? null) : null
  }
}

/** 解析 EPUB2 NCX 的 navMap，展平为文档顺序的目录项（含嵌套） */
export function parseNcx(ncxXml: string): TocEntry[] {
  const navMapMatch = /<navMap\b[\s\S]*?<\/navMap>/i.exec(ncxXml)
  const scope = navMapMatch ? navMapMatch[0] : ncxXml

  const openRe = /<navPoint\b[^>]*>/g
  const closeRe = /<\/navPoint>/g
  const tokens: { index: number; type: 'open' | 'close' }[] = []
  let m: RegExpExecArray | null
  while ((m = openRe.exec(scope))) tokens.push({ index: m.index, type: 'open' })
  while ((m = closeRe.exec(scope))) tokens.push({ index: m.index, type: 'close' })
  tokens.sort((a, b) => a.index - b.index)

  const closeOf: Record<number, number> = {}
  const stack: number[] = []
  for (const t of tokens) {
    if (t.type === 'open') stack.push(t.index)
    else {
      const openIdx = stack.pop()
      if (openIdx !== undefined) closeOf[openIdx] = t.index
    }
  }

  const entries: TocEntry[] = []
  for (const t of tokens) {
    if (t.type !== 'open') continue
    const closeIdx = closeOf[t.index]
    if (closeIdx === undefined) continue
    const body = scope.slice(t.index, closeIdx)
    const label = /<text>([\s\S]*?)<\/text>/i.exec(body)
    const src = /<content\b[^>]*src\s*=\s*["']([^"']+)["']/i.exec(body)
    if (label && src) {
      const text = decodeEntities(stripTags(label[1])).trim()
      if (text) entries.push({ label: text, href: src[1] })
    }
  }
  return entries
}

/** 解析 EPUB3 nav 文档里的 TOC（<nav epub:type="toc"> 内的链接） */
export function parseNavToc(navHtml: string): TocEntry[] {
  const navMatch = /<nav\b[^>]*epub:type\s*=\s*["']toc["'][^>]*>([\s\S]*?)<\/nav>/i.exec(navHtml)
  const scope = navMatch ? navMatch[1] : navHtml
  const entries: TocEntry[] = []
  const aRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = aRe.exec(scope))) {
    const label = decodeEntities(stripTags(m[2])).trim()
    if (label) entries.push({ label, href: m[1] })
  }
  return entries
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

/** 把相对 href 解析为 zip 内的规范路径（去掉锚点片段） */
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

/** 读取 EPUB 内置目录（优先 NCX，其次 nav），并把 href 解析为 zip 内规范路径 */
async function extractToc(zip: JSZip, opf: OpfInfo, opfDir: string): Promise<TocEntry[]> {
  if (opf.ncxHref) {
    const ncxPath = resolveRelative(opfDir, opf.ncxHref)
    const ncxEntry = zip.file(ncxPath)
    if (ncxEntry) {
      const ncxXml = await ncxEntry.async('string')
      const entries = parseNcx(ncxXml)
      if (entries.length > 0) {
        const base = dirnameZip(ncxPath)
        return entries.map((e) => ({ label: e.label, href: resolveRelative(base, e.href) }))
      }
    }
  }
  if (opf.navHref) {
    const navPath = resolveRelative(opfDir, opf.navHref)
    const navEntry = zip.file(navPath)
    if (navEntry) {
      const navHtml = await navEntry.async('string')
      const entries = parseNavToc(navHtml)
      if (entries.length > 0) {
        const base = dirnameZip(navPath)
        return entries.map((e) => ({ label: e.label, href: resolveRelative(base, e.href) }))
      }
    }
  }
  return []
}

/** 把目录项映射到正文字符偏移（按文件级；同一文件内多个条目指向同一偏移） */
function mapTocToChapters(entries: TocEntry[], offsets: Map<string, number>): Chapter[] {
  const chapters: Chapter[] = []
  for (const e of entries) {
    const off = offsets.get(e.href)
    if (off !== undefined) chapters.push({ title: e.label, start: off })
  }
  return chapters
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

  // 按 spine 顺序读取内容，并记录每个文件在正文中的起始偏移
  const parts: string[] = []
  const offsets = new Map<string, number>()
  let offset = 0
  for (const idref of opf.spine) {
    const href = opf.manifest.get(idref)
    if (!href) continue
    const resolved = resolveRelative(opfDir, href)
    const entry = zip.file(resolved)
    if (!entry) continue
    const html = await entry.async('string')
    const text = htmlToText(html)
    if (!text) continue
    if (!offsets.has(resolved)) offsets.set(resolved, offset)
    parts.push(text)
    offset += text.length + 1
  }

  const content = normalizeNewlines(parts.join('\n'))

  // 优先使用内置目录；没有或映射为空时回退到正则识别
  const tocEntries = await extractToc(zip, opf, opfDir)
  let chapters = mapTocToChapters(tocEntries, offsets)
  if (chapters.length === 0) chapters = detectChapters(content)

  return { title: opf.title, content, chapters }
}
