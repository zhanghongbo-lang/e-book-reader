import jschardet from 'jschardet'
import iconv from 'iconv-lite'

/** 判断 buffer 是否为合法 UTF-8（无 BOM） */
export function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return true
  } catch {
    return false
  }
}

/** 把检测到的编码名统一成 iconv-lite 支持的名称 */
export function normalizeEncoding(enc: string): string {
  const e = enc.toLowerCase()
  if (e.includes('gb') || e.includes('2312') || e.includes('18030') || e.includes('936')) {
    return 'gb18030'
  }
  if (e.includes('big5') || e.includes('950')) return 'big5'
  if (e.includes('utf')) return 'utf-8'
  if (e.includes('ascii') || e.includes('8859') || e.includes('latin')) return 'utf-8'
  return 'gb18030'
}

/** 检测文本编码，优先 UTF-8，再 jschardet，兜底 GB18030 */
export function detectEncoding(buf: Buffer): string {
  // 1. UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return 'utf-8'
  }
  // 2. 无 BOM 但内容合法 UTF-8
  if (isValidUtf8(buf)) return 'utf-8'
  // 3. jschardet 检测
  const det = jschardet.detect(buf)
  const raw = det && det.encoding ? det.encoding : 'gb18030'
  return normalizeEncoding(raw)
}

/** 把 buffer 解码为 UTF-16 字符串 */
export function decodeBuffer(buf: Buffer): { text: string; encoding: string } {
  const encoding = detectEncoding(buf)
  let text: string
  if (encoding === 'utf-8') {
    const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    text = hasBom ? buf.toString('utf8', 3) : buf.toString('utf8')
  } else {
    text = iconv.decode(buf, encoding)
  }
  return { text, encoding }
}
