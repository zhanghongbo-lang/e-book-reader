export interface Match {
  /** 匹配在全文中的起始字符偏移 */
  start: number
  /** 匹配长度（字符数） */
  length: number
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
