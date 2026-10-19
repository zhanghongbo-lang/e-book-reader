import { useCallback, useEffect, useState } from 'react'
import type { Book } from '../../../shared/types'
import { THEME_LABELS, type ThemeId } from '../settings'

interface Props {
  onOpen: (id: string) => void
  theme: ThemeId
  onCycleTheme: () => void
}

export default function Shelf({ onOpen, theme, onCycleTheme }: Props) {
  const [books, setBooks] = useState<Book[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setBooks(await window.api.listBooks())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleImport = async (): Promise<void> => {
    setBusy(true)
    try {
      setBooks(await window.api.importBooks())
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: string): Promise<void> => {
    setBooks(await window.api.removeBook(id))
  }

  return (
    <div className="shelf">
      <header className="shelf-header">
        <h1>书架</h1>
        <div className="shelf-actions">
          <button onClick={onCycleTheme}>主题：{THEME_LABELS[theme]}</button>
          <button onClick={handleImport} disabled={busy}>
            {busy ? '导入中…' : '导入 TXT'}
          </button>
        </div>
      </header>

      {books.length === 0 ? (
        <div className="empty">还没有书，点击右上角「导入 TXT」添加</div>
      ) : (
        <ul className="book-list">
          {books.map((b) => (
            <li key={b.id} className="book-item">
              <button className="book-main" onClick={() => onOpen(b.id)}>
                <span className="book-name">{b.fileName}</span>
                <span className={`book-badge ${b.progress > 0 ? 'read' : ''}`}>
                  {b.progress > 0 ? '已读' : '未读'}
                </span>
              </button>
              <button className="book-remove" onClick={() => void handleRemove(b.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
