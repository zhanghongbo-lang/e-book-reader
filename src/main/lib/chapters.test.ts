import { describe, it, expect } from 'vitest'
import { detectChapters } from './chapters'

describe('detectChapters', () => {
  it('识别中文「第X章」标题（含汉字/数字序号与副标题）', () => {
    const content = '第一章 新的开始\n正文内容\n第十二章 冒险\n第123章 数字章节\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual([
      '第一章 新的开始',
      '第十二章 冒险',
      '第123章 数字章节'
    ])
    expect(chapters[0].start).toBe(0)
  })

  it('识别序章/楔子/番外等特殊标题', () => {
    const content = '序章\n正文\n番外 一\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['序章', '番外 一'])
  })

  it('识别英文 Chapter 标题（大小写不敏感）', () => {
    const content = 'Chapter 1 Start\nbody\nCHAPTER 2 Next\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['Chapter 1 Start', 'CHAPTER 2 Next'])
  })

  it('忽略普通正文行', () => {
    const content = '这是一段很长的普通正文内容，不应该被识别为章节标题。\n第一章 标题\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['第一章 标题'])
  })

  it('不把「第X回合」误判为章节', () => {
    const content = '第一回合，双方势均力敌。\n第二回合 更是激烈\n第一章 正文\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['第一章 正文'])
  })

  it('正确记录章节起始字符偏移', () => {
    const content = '第一章\nabc\n第二章\n'
    const chapters = detectChapters(content)
    expect(chapters[0].start).toBe(0)
    expect(chapters[1].start).toBe('第一章\nabc\n'.length)
  })

  it('无标题时返回空数组', () => {
    expect(detectChapters('只有普通正文，没有章节标题。')).toEqual([])
  })
})
