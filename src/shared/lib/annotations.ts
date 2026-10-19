import type { Annotation } from '../types'
import { matchesInLine, type Match } from './search'

export interface RichSegment {
  text: string
  /** 是否为搜索命中 */
  search: boolean
  /** 是否为当前搜索命中 */
  current: boolean
  /** 是否为批注/高亮区域 */
  annotation: boolean
  /** 批注区域是否带有批注文字 */
  hasNote: boolean
}

/** 返回与 [lineStart, lineStart + textLength) 相交的批注区间（裁剪到该行，annotations 需按 start 升序） */
export function annotationsInLine(
  annotations: Annotation[],
  lineStart: number,
  textLength: number
): Array<{ start: number; end: number; hasNote: boolean }> {
  const lineEnd = lineStart + textLength
  const result: Array<{ start: number; end: number; hasNote: boolean }> = []
  for (const a of annotations) {
    if (a.end <= lineStart) continue
    if (a.start >= lineEnd) break
    const s = Math.max(a.start, lineStart)
    const e = Math.min(a.end, lineEnd)
    if (s < e) result.push({ start: s, end: e, hasNote: a.note.trim() !== '' })
  }
  return result
}

/** 把一行文本同时按搜索命中与批注切分为片段，供高亮渲染 */
export function splitRichLine(
  text: string,
  lineStart: number,
  searchMatches: Match[],
  currentMatchStart: number | null,
  annotations: Annotation[]
): RichSegment[] {
  const n = text.length
  if (n === 0) return []

  const searchFlag = new Array<boolean>(n).fill(false)
  const currentFlag = new Array<boolean>(n).fill(false)
  const annoFlag = new Array<boolean>(n).fill(false)
  const noteFlag = new Array<boolean>(n).fill(false)

  for (const m of matchesInLine(searchMatches, lineStart, n)) {
    const s = Math.max(0, m.start - lineStart)
    const e = Math.min(n, s + m.length)
    const cur = m.start === currentMatchStart
    for (let i = s; i < e; i++) {
      searchFlag[i] = true
      if (cur) currentFlag[i] = true
    }
  }

  for (const r of annotationsInLine(annotations, lineStart, n)) {
    const s = Math.max(0, r.start - lineStart)
    const e = Math.min(n, r.end - lineStart)
    for (let i = s; i < e; i++) {
      annoFlag[i] = true
      if (r.hasNote) noteFlag[i] = true
    }
  }

  const segments: RichSegment[] = []
  let i = 0
  while (i < n) {
    let j = i + 1
    while (
      j < n &&
      searchFlag[j] === searchFlag[i] &&
      currentFlag[j] === currentFlag[i] &&
      annoFlag[j] === annoFlag[i] &&
      noteFlag[j] === noteFlag[i]
    ) {
      j++
    }
    segments.push({
      text: text.slice(i, j),
      search: searchFlag[i],
      current: currentFlag[i],
      annotation: annoFlag[i],
      hasNote: noteFlag[i]
    })
    i = j
  }
  return segments
}
