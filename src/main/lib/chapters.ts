import type { Chapter } from '../../shared/types'

const NUM = '0-9零〇一二三四五六七八九十百千万两'

// 第X章 / 第X节 / 第X卷 / 第X部 / 第X集（X 为数字或中文数字，可带简短标题）
// 注意：不含「回」「话」，因「第一回合」「第一句话」等是常见普通词，容易误判
const CHAPTER_RE = new RegExp(`^第\\s*[${NUM}]+\\s*[章节卷部集][^\\n]{0,40}$`)

// 数字、标题 形式（如「55、爆裂末班车」「160、玫瑰工厂」）
// 仅用 、（顿号）与 ．（全角句点）作分隔，避免把「3.14」这类小数误判
const NUMBERED_RE = /^(\d{1,4})\s*[、．]\s*(.*)$/

// 序章、楔子、番外等特殊标题
const SPECIAL_RE = /^(序章|序言|楔子|前言|引子|后记|尾声|番外|外传|附录)[^\n]{0,40}$/

// 英文 Chapter 标题
const ENGLISH_RE = /^Chapter\s+\d+[^\n]{0,40}$/i

// 去掉行首尾的纯装饰符（= - * # ~ 与空白）；保留括号，因「（双更）」等是标题的一部分
function stripDecorations(s: string): string {
  return s
    .replace(/^[\s=\-*#~]+/, '')
    .replace(/[\s=\-*#~]+$/, '')
}

/** 扫描正文，识别章节标题并返回标题与起始字符偏移 */
export function detectChapters(content: string): Chapter[] {
  const chapters: Chapter[] = []
  const lines = content.split('\n')
  let offset = 0
  let lastNumberedChapter = -1

  for (const line of lines) {
    const stripped = stripDecorations(line.trim())
    let matched = false

    if (stripped.length > 0) {
      // 「数字、标题」：标题需 ≥2 字，且序号严格递增（过滤正文里的 1、2、3、 列表）
      const numbered = NUMBERED_RE.exec(stripped)
      if (numbered) {
        const num = parseInt(numbered[1], 10)
        const title = numbered[2].trim()
        if (title.length >= 2 && title.length <= 40 && num > lastNumberedChapter) {
          lastNumberedChapter = num
          matched = true
        }
      }

      if (!matched) {
        matched =
          CHAPTER_RE.test(stripped) || SPECIAL_RE.test(stripped) || ENGLISH_RE.test(stripped)
      }
    }

    if (matched) {
      chapters.push({ title: stripped, start: offset })
    }
    offset += line.length + 1
  }
  return chapters
}
