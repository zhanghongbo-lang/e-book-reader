import { useCallback, useEffect, useState } from 'react'
import Shelf from './pages/Shelf'
import Reader from './pages/Reader'
import {
  applyTheme,
  loadSettings,
  nextTheme,
  saveSettings,
  type ReaderSettings
} from './settings'

export default function App() {
  const [bookId, setBookId] = useState<string | null>(null)
  const [settings, setSettings] = useState<ReaderSettings>(() => loadSettings())

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const updateSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  const cycleTheme = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, theme: nextTheme(prev.theme) }
      saveSettings(next)
      return next
    })
  }, [])

  if (bookId === null) {
    return (
      <Shelf
        onOpen={(id) => setBookId(id)}
        theme={settings.theme}
        onCycleTheme={cycleTheme}
      />
    )
  }
  return (
    <Reader
      bookId={bookId}
      onBack={() => setBookId(null)}
      settings={settings}
      onUpdateSettings={updateSettings}
      onCycleTheme={cycleTheme}
    />
  )
}
