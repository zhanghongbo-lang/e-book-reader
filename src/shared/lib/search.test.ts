import { describe, it, expect } from 'vitest'
import { findMatches, matchesInLine } from './search'

describe('findMatches', () => {
  it('大小写不敏感地查找所有匹配', () => {
    expect(findMatches('Hello hello HELLO', 'hello')).toEqual([
      { start: 0, length: 5 },
      { start: 6, length: 5 },
      { start: 12, length: 5 }
    ])
  })

  it('空查询与纯空白查询返回空数组', () => {
    expect(findMatches('abc', '')).toEqual([])
    expect(findMatches('abc', '   ')).toEqual([])
  })

  it('匹配不重叠', () => {
    expect(findMatches('aaaaaa', 'aaa')).toEqual([
      { start: 0, length: 3 },
      { start: 3, length: 3 }
    ])
  })

  it('支持中文查询', () => {
    expect(findMatches('这是监视环2，监视环2又出现。', '监视环2')).toEqual([
      { start: 2, length: 4 },
      { start: 7, length: 4 }
    ])
  })

  it('无匹配返回空数组', () => {
    expect(findMatches('abc', 'xyz')).toEqual([])
  })
})

describe('matchesInLine', () => {
  const matches = [
    { start: 0, length: 2 },
    { start: 5, length: 2 },
    { start: 12, length: 2 },
    { start: 20, length: 2 }
  ]

  it('只返回落在行范围内的匹配', () => {
    expect(matchesInLine(matches, 4, 7)).toEqual([{ start: 5, length: 2 }])
  })

  it('包含恰好落在行首与行尾的匹配', () => {
    expect(matchesInLine(matches, 5, 15)).toEqual([
      { start: 5, length: 2 },
      { start: 12, length: 2 }
    ])
  })

  it('行范围内无匹配时返回空数组', () => {
    expect(matchesInLine(matches, 30, 5)).toEqual([])
  })
})
