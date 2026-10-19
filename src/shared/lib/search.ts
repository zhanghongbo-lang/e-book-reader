export interface Match {
  /** 匹配在全文中的起始字符偏移 */
  start: number
  /** 匹配长度（字符数） */
  length: number
}

export interface TextSegment {
  text: string
  match: boolean
  /** 匹配片段在全文中的起始偏移；非匹配片段为 -1 */
  start: number
}

/**
 * 大小写不敏感地找出 query 在 content 中的所有出现位置（不重叠）。
 * query 会先 trim，空白查询返回空数组。
 */
export function findMatches(content: string, query: string): Match[] {
  const q = query.trim()
  if (q === '') return []
  const lowerContent = content.toLowerCase()
  const lowerQuery = q.toLowerCase()
  const matches: Match[] = []
  let from = 0
  for (;;) {
    const idx = lowerContent.indexOf(lowerQuery, from)
    if (idx === -1) break
    matches.push({ start: idx, length: q.length })
    from = idx + lowerQuery.length
  }
  return matches
}

/** 返回位于 [lineStart, lineStart + textLength) 范围内的匹配（matches 需按 start 升序） */
export function matchesInLine(matches: Match[], lineStart: number, textLength: number): Match[] {
  let lo = 0
  let hi = matches.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (matches[mid].start < lineStart) lo = mid + 1
    else hi = mid
  }
  const result: Match[] = []
  const end = lineStart + textLength
  for (let i = lo; i < matches.length; i++) {
    if (matches[i].start >= end) break
    result.push(matches[i])
  }
  return result
}

/** 把一行文本按匹配切分为片段，供高亮渲染 */
export function splitLine(text: string, lineStart: number, matches: Match[]): TextSegment[] {
  const inLine = matchesInLine(matches, lineStart, text.length)
  const segments: TextSegment[] = []
  let cursor = 0
  for (const m of inLine) {
    const off = m.start - lineStart
    if (off > cursor) {
      segments.push({ text: text.slice(cursor, off), match: false, start: -1 })
    }
    segments.push({ text: text.slice(off, off + m.length), match: true, start: m.start })
    cursor = off + m.length
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false, start: -1 })
  }
  return segments
}
