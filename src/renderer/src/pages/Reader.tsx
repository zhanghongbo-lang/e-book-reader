import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReadResult } from '../../../shared/types'

interface Props {
  bookId: string
  onBack: () => void
}

interface Para {
  text: string
  start: number
}

export default function Reader({ bookId, onBack }: Props) {
  const [data, setData] = useState<ReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.8)

  const parentRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const lastOffsetRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  // 段落切分，记录每段起始字符偏移
  const paras = useMemo<Para[]>(() => {
    if (!data) return []
    const lines = data.content.split('\n')
    let offset = 0
    return lines.map((text) => {
      const p: Para = { text, start: offset }
      offset += text.length + 1
      return p
    })
  }, [data])

  const virtualizer = useVirtualizer({
    count: paras.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 20
  })

  // 加载书籍内容
  useEffect(() => {
    let cancelled = false
    window.api.readBook(bookId).then((res) => {
      if (cancelled) return
      if (!res) {
        setError('无法读取该书')
        return
      }
      lastOffsetRef.current = res.progress
      setData(res)
    })
    return () => {
      cancelled = true
    }
  }, [bookId])

  // 恢复到上次进度
  useEffect(() => {
    if (!data || paras.length === 0 || restoredRef.current) return
    restoredRef.current = true
    const target = data.progress
    if (target <= 0) return
    let idx = 0
    for (let i = 0; i < paras.length; i++) {
      if (paras[i].start <= target) idx = i
      else break
    }
    virtualizer.scrollToIndex(idx, { align: 'start' })
  }, [data, paras, virtualizer])

  const saveProgress = useCallback(
    (offset: number) => {
      void window.api.updateProgress(bookId, offset)
    },
    [bookId]
  )

  const handleScroll = useCallback(() => {
    const item = virtualizer.getVirtualItemForOffset(virtualizer.scrollOffset ?? 0)
    if (!item) return
    lastOffsetRef.current = paras[item.index]?.start ?? 0
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      saveProgress(lastOffsetRef.current)
    }, 300)
  }, [virtualizer, paras, saveProgress])

  const handleBack = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    saveProgress(lastOffsetRef.current)
    onBack()
  }, [saveProgress, onBack])

  if (error) {
    return (
      <div className="reader">
        <div className="reader-topbar">
          <button onClick={onBack}>返回</button>
        </div>
        <div className="empty">{error}</div>
      </div>
    )
  }

  return (
    <div className="reader">
      <div className="reader-topbar">
        <button onClick={handleBack}>返回</button>
        <span className="reader-title">{data?.fileName ?? ''}</span>
        <div className="reader-controls">
          <button onClick={() => setFontSize((n) => Math.max(12, n - 1))}>字号-</button>
          <button onClick={() => setFontSize((n) => Math.min(32, n + 1))}>字号+</button>
          <button onClick={() => setLineHeight((n) => Math.max(1.2, n - 0.2))}>行距-</button>
          <button onClick={() => setLineHeight((n) => Math.min(3, n + 0.2))}>行距+</button>
        </div>
      </div>

      <div className="reader-scroll" ref={parentRef} onScroll={handleScroll}>
        <div
          className="reader-inner"
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vi) => (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="para"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
                fontSize: `${fontSize}px`,
                lineHeight
              }}
            >
              {paras[vi.index].text || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
