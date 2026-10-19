export type ThemeId = 'light' | 'sepia' | 'dark'
export type FontId = 'system' | 'serif' | 'sans' | 'mono'

export interface ReaderSettings {
  theme: ThemeId
  fontSize: number
  lineHeight: number
  fontFamily: FontId
}

export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const THEMES: ThemeId[] = ['light', 'sepia', 'dark']

export const THEME_LABELS: Record<ThemeId, string> = {
  light: '浅色',
  sepia: '米黄',
  dark: '深色'
}

export const FONTS: FontId[] = ['system', 'serif', 'sans', 'mono']

export const FONT_LABELS: Record<FontId, string> = {
  system: '系统默认',
  serif: '衬线',
  sans: '无衬线',
  mono: '等宽'
}

export const FONT_STACKS: Record<FontId, string> = {
  system: '-apple-system, "Segoe UI", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", SimSun, "Noto Serif CJK SC", serif',
  sans: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  mono: '"Courier New", Consolas, "Noto Mono CJK SC", monospace'
}

export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 32
export const LINE_HEIGHT_MIN = 1.2
export const LINE_HEIGHT_MAX = 3

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.8,
  fontFamily: 'system'
}

export const STORAGE_KEY = 'reader-settings'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function nextTheme(theme: ThemeId): ThemeId {
  const idx = THEMES.indexOf(theme)
  return THEMES[(idx + 1) % THEMES.length]
}

export function nextFont(font: FontId): FontId {
  const idx = FONTS.indexOf(font)
  return FONTS[(idx + 1) % FONTS.length]
}

function clampSettings(s: ReaderSettings): ReaderSettings {
  const fontSize = Number(s.fontSize)
  const lineHeight = Number(s.lineHeight)
  return {
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    fontFamily: FONTS.includes(s.fontFamily) ? s.fontFamily : DEFAULT_SETTINGS.fontFamily,
    fontSize: Number.isFinite(fontSize)
      ? clamp(fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX)
      : DEFAULT_SETTINGS.fontSize,
    lineHeight: Number.isFinite(lineHeight)
      ? clamp(lineHeight, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX)
      : DEFAULT_SETTINGS.lineHeight
  }
}

export function loadSettings(storage: SettingsStorage = window.localStorage): ReaderSettings {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    return clampSettings({ ...DEFAULT_SETTINGS, ...parsed })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(
  settings: ReaderSettings,
  storage: SettingsStorage = window.localStorage
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
}
