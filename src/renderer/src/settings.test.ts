import { describe, it, expect } from 'vitest'
import {
  clamp,
  DEFAULT_SETTINGS,
  loadSettings,
  nextFont,
  nextTheme,
  saveSettings,
  STORAGE_KEY,
  type SettingsStorage
} from './settings'

function createStorage(initial: Record<string, string> = {}): SettingsStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value)
    }
  }
}

describe('loadSettings', () => {
  it('无存储时返回默认值', () => {
    expect(loadSettings(createStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('读回已保存的值', () => {
    const storage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ theme: 'dark', fontSize: 22, lineHeight: 2, fontFamily: 'serif' })
    })
    expect(loadSettings(storage)).toEqual({ theme: 'dark', fontSize: 22, lineHeight: 2, fontFamily: 'serif' })
  })

  it('越界字号/行距被 clamp 到合法范围', () => {
    const storage = createStorage({
      [STORAGE_KEY]: JSON.stringify({ fontSize: 999, lineHeight: 0.1 })
    })
    const loaded = loadSettings(storage)
    expect(loaded.fontSize).toBe(32)
    expect(loaded.lineHeight).toBe(1.2)
  })

  it('非法 theme 回退默认', () => {
    const storage = createStorage({ [STORAGE_KEY]: JSON.stringify({ theme: 'oops' }) })
    expect(loadSettings(storage).theme).toBe('light')
  })

  it('非法 fontFamily 回退默认', () => {
    const storage = createStorage({ [STORAGE_KEY]: JSON.stringify({ fontFamily: 'oops' }) })
    expect(loadSettings(storage).fontFamily).toBe('system')
  })

  it('损坏的 JSON 回退默认', () => {
    const storage = createStorage({ [STORAGE_KEY]: 'not-json' })
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
  })
})

describe('saveSettings 与 loadSettings 往返', () => {
  it('保存后能读回一致数据', () => {
    const storage = createStorage()
    saveSettings({ theme: 'sepia', fontSize: 20, lineHeight: 1.6, fontFamily: 'mono' }, storage)
    expect(loadSettings(storage)).toEqual({
      theme: 'sepia',
      fontSize: 20,
      lineHeight: 1.6,
      fontFamily: 'mono'
    })
  })
})

describe('clamp', () => {
  it('把值钳制到 [min, max]', () => {
    expect(clamp(5, 10, 20)).toBe(10)
    expect(clamp(15, 10, 20)).toBe(15)
    expect(clamp(25, 10, 20)).toBe(20)
  })
})

describe('nextTheme', () => {
  it('按浅色 → 米黄 → 深色循环', () => {
    expect(nextTheme('light')).toBe('sepia')
    expect(nextTheme('sepia')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })
})

describe('nextFont', () => {
  it('按系统默认 → 衬线 → 无衬线 → 等宽循环', () => {
    expect(nextFont('system')).toBe('serif')
    expect(nextFont('serif')).toBe('sans')
    expect(nextFont('sans')).toBe('mono')
    expect(nextFont('mono')).toBe('system')
  })
})
