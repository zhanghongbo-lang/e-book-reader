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

  it('识别「数字、标题」形式的章节', () => {
    const content = '55、爆裂末班车（双更）\n正文\n160、玫瑰工厂\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['55、爆裂末班车（双更）', '160、玫瑰工厂'])
  })

  it('识别带 === 装饰符的章节并去掉装饰', () => {
    const content = '===第113章 勇敢的姑娘===\n正文\n===第114章===\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['第113章 勇敢的姑娘', '第114章'])
  })

  it('识别序号与标题间有多余空格的「第X章」', () => {
    const content = '第736章  远方的战将\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['第736章  远方的战将'])
  })

  it('通过序号递增过滤正文里的数字列表', () => {
    const content = [
      '55、爆裂末班车',
      '正文',
      '160、玫瑰工厂',
      '===第120章 生肖飞升对赌合同===',
      '1、第一点',
      '2、第二点',
      '3、第三点',
      '161、下一章'
    ].join('\n')
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual([
      '55、爆裂末班车',
      '160、玫瑰工厂',
      '第120章 生肖飞升对赌合同',
      '161、下一章'
    ])
  })

  it('不把裸的「1、」「2、」误判为章节', () => {
    expect(detectChapters('1、\n2、\n3、\n')).toEqual([])
  })

  it('番外后序号重新编号也能识别', () => {
    const content = [
      '160、玫瑰工厂',
      '正文',
      '番外一',
      '正文',
      '1、番外第一个小故事',
      '2、番外第二个小故事',
      '正文'
    ].join('\n')
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual([
      '160、玫瑰工厂',
      '番外一',
      '1、番外第一个小故事',
      '2、番外第二个小故事'
    ])
  })

  it('识别短标题加尾部序号的章节（如监视环2、逛超市3）', () => {
    const content = '监视环2\n正文\n逛超市3\n正文\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['监视环2', '逛超市3'])
  })

  it('识别短标题加分卷括号的章节（如入职（上））', () => {
    const content = '入职（上）\n正文\n入职（下）\n入职（一）\n入职（1）\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual([
      '入职（上）',
      '入职（下）',
      '入职（一）',
      '入职（1）'
    ])
  })

  it('识别番外后直接跟数字的章节（番外1）', () => {
    const content = '番外1\n正文\n番外2\n'
    const chapters = detectChapters(content)
    expect(chapters.map((c) => c.title)).toEqual(['番外1', '番外2'])
  })

  it('不把含标点的普通正文误判为章节', () => {
    const content = '这是一段普通正文，结尾没有序号。\n他今年三十岁了。\n'
    expect(detectChapters(content)).toEqual([])
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
