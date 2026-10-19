import type { Chapter } from '../../shared/types'

const NUM = '0-9零〇一二三四五六七八九十百千万两'

// 第X章 / 第X节 / 第X卷 / 第X部 / 第X集（X 为数字或中文数字，可带简短标题）
// 注意：不含「回」，因为「第一回合」「第二回合」等是常见普通词，容易误判
const CHAPTER_RE = new RegExp(`^第\\s*[${NUM}]+\\s*[章节卷部集][^\\n]{0,30}$`)

// 序章、楔子、番外等特殊标题
const SPECIAL_RE = /^(序章|序言|楔子|前言|引子|后记|尾声|番外|外传|附录)[^\n]{0,30}$/

// 英文 Chapter 标题
const ENGLISH_RE = /^Chapter\s+\d+[^\n]{0,30}$/i

/** 扫描正文，识别章节标题并返回标题与起始字符偏移 */
export function detectChapters(content: string): Chapter[] {
  const chapters: Chapter[] = []
  const lines = content.split('\n')
  let offset = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0 && trimmed.length <= 40) {
      const isHeading =
        CHAPTER_RE.test(trimmed) || SPECIAL_RE.test(trimmed) || ENGLISH_RE.test(trimmed)
      if (isHeading) {
        chapters.push({ title: trimmed, start: offset })
      }
    }
    offset += line.length + 1
  }
  return chapters
}
