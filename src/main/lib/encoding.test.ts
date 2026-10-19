import { describe, it, expect } from 'vitest'
import iconv from 'iconv-lite'
import { decodeBuffer, detectEncoding, isValidUtf8 } from './encoding'

describe('decodeBuffer', () => {
  it('解码 UTF-8 无 BOM 文本', () => {
    const buf = Buffer.from('你好，世界 hello', 'utf8')
    const { text, encoding } = decodeBuffer(buf)
    expect(encoding).toBe('utf-8')
    expect(text).toBe('你好，世界 hello')
  })

  it('解码 UTF-8 带 BOM 文本并去掉 BOM', () => {
    const body = Buffer.from('带 BOM 的内容', 'utf8')
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body])
    const { text, encoding } = decodeBuffer(buf)
    expect(encoding).toBe('utf-8')
    expect(text).toBe('带 BOM 的内容')
    expect(text.charCodeAt(0)).not.toBe(0xfeff)
  })

  it('解码 GBK 中文文本', () => {
    const buf = iconv.encode('这是一段 GBK 编码的小说内容', 'gbk')
    const { text, encoding } = decodeBuffer(buf)
    expect(text).toBe('这是一段 GBK 编码的小说内容')
    expect(encoding).toBe('gb18030')
  })

  it('空 buffer 兜底为 gb18030', () => {
    const { text } = decodeBuffer(Buffer.alloc(0))
    expect(text).toBe('')
  })
})

describe('detectEncoding / isValidUtf8', () => {
  it('识别 GBK 为 gb18030', () => {
    const buf = iconv.encode('中文', 'gbk')
    expect(detectEncoding(buf)).toBe('gb18030')
  })

  it('非法 UTF-8 序列被判为 false', () => {
    const buf = iconv.encode('中文', 'gbk')
    expect(isValidUtf8(buf)).toBe(false)
  })
})
