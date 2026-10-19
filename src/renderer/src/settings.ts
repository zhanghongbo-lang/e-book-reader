export type ThemeId = 'light' | 'sepia' | 'dark'

export interface ReaderSettings {
  theme: ThemeId
  fontSize: number
  lineHeight: number
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

export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 32
export const LINE_HEIGHT_MIN = 1.2
export const LINE_HEIGHT_MAX = 3

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontSize: 18,
  lineHeight: 1.8
}

export const STORAGE_KEY = 'reader-settings'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function nextTheme(theme: ThemeId): ThemeId {
  const idx = THEMES.indexOf(theme)
  return THEMES[(idx + 1) % THEMES.length]
}

function clampSettings(s: ReaderSettings): ReaderSettings {
  const fontSize = Number(s.fontSize)
  const lineHeight = Number(s.lineHeight)
  return {
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
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
