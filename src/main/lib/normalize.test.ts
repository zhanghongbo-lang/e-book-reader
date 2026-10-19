import { describe, it, expect } from 'vitest'
import { normalizeNewlines } from './normalize'

describe('normalizeNewlines', () => {
  it('把 CRLF 归一化为 LF', () => {
    expect(normalizeNewlines('第一行\r\n第二行\r\n')).toBe('第一行\n第二行\n')
  })

  it('把独立 CR 归一化为 LF', () => {
    expect(normalizeNewlines('a\rb\rc')).toBe('a\nb\nc')
  })

  it('混合换行符全部归一化', () => {
    expect(normalizeNewlines('a\r\nb\nc\rd')).toBe('a\nb\nc\nd')
  })
})
