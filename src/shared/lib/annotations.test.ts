import { describe, it, expect } from 'vitest'
import { annotationsInLine, splitRichLine } from './annotations'
import type { Annotation } from '../types'

function ann(start: number, end: number, note = ''): Annotation {
  return { id: String(start), bookId: 'b1', start, end, text: '', note, createdAt: 0 }
}

describe('annotationsInLine', () => {
  const anns = [ann(2, 5), ann(8, 12, '备注'), ann(20, 25)]

  it('返回与行相交的批注并裁剪到行内', () => {
    expect(annotationsInLine(anns, 0, 10)).toEqual([
      { start: 2, end: 5, hasNote: false },
      { start: 8, end: 10, hasNote: true }
    ])
  })

  it('不包含完全在行外的批注', () => {
    expect(annotationsInLine(anns, 14, 3)).toEqual([])
  })

  it('hasNote 依据批注文字是否为空白', () => {
    expect(annotationsInLine([ann(0, 3), ann(4, 6, '  ')], 0, 6)).toEqual([
      { start: 0, end: 3, hasNote: false },
      { start: 4, end: 6, hasNote: false }
    ])
  })
})

describe('splitRichLine', () => {
  it('无搜索无批注时整行一个普通片段', () => {
    expect(splitRichLine('abcd', 0, [], null, [])).toEqual([
      { text: 'abcd', search: false, current: false, annotation: false, hasNote: false }
    ])
  })

  it('只标记搜索命中', () => {
    const matches = [{ start: 1, length: 2 }]
    expect(splitRichLine('abcd', 0, matches, 1, [])).toEqual([
      { text: 'a', search: false, current: false, annotation: false, hasNote: false },
      { text: 'bc', search: true, current: true, annotation: false, hasNote: false },
      { text: 'd', search: false, current: false, annotation: false, hasNote: false }
    ])
  })

  it('只标记批注', () => {
    const anns = [ann(1, 3, '备注')]
    expect(splitRichLine('abcd', 0, [], null, anns)).toEqual([
      { text: 'a', search: false, current: false, annotation: false, hasNote: false },
      { text: 'bc', search: false, current: false, annotation: true, hasNote: true },
      { text: 'd', search: false, current: false, annotation: false, hasNote: false }
    ])
  })

  it('搜索与批注重叠时合并标记', () => {
    const matches = [{ start: 1, length: 3 }]
    const anns = [ann(2, 4)]
    expect(splitRichLine('abcd', 0, matches, 1, anns)).toEqual([
      { text: 'a', search: false, current: false, annotation: false, hasNote: false },
      { text: 'b', search: true, current: true, annotation: false, hasNote: false },
      { text: 'cd', search: true, current: true, annotation: true, hasNote: false }
    ])
  })
})
