import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { ReadResult } from '../../../shared/types'
import { findMatches, splitLine, type Match } from '../../../shared/lib/search'
import {
  clamp,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  THEME_LABELS,
  type ReaderSettings
} from '../settings'

interface Props {
  bookId: string
  onBack: () => void
  settings: ReaderSettings
  onUpdateSettings: (patch: Partial<ReaderSettings>) => void
  onCycleTheme: () => void
}

interface Para {
  text: string
  start: number
}

function findParaIndex(paras: Para[], offset: number): number {
  let idx = 0
  for (let i = 0; i < paras.length; i++) {
    if (paras[i].start <= offset) idx = i
    else break
  }
  return idx
}

/** 把一行文本按匹配渲染为带高亮的节点 */
function renderParaText(
  text: string,
  start: number,
  matches: Match[],
  currentMatchStart: number | null
): ReactNode {
  if (text.length === 0) return '\u00A0'
  if (matches.length === 0) return text
  const segments = splitLine(text, start, matches)
  return segments.map((seg, i) => {
    if (!seg.match) return <span key={i}>{seg.text}</span>
    const isCurrent = seg.start === currentMatchStart
    return (
      <mark key={i} className={isCurrent ? 'search-hit current' : 'search-hit'}>
        {seg.text}
      </mark>
    )
  })
}

export default function Reader({ bookId, onBack, settings, onUpdateSettings, onCycleTheme }: Props) {
  const [data, setData] = useState<ReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  const parentRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const lastOffsetRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const chapters = data?.chapters ?? []

  const matches = useMemo(() => (data ? findMatches(data.content, query) : []), [data, query])
  const currentMatchStart = matches[currentIndex]?.start ?? null

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
    virtualizer.scrollToIndex(findParaIndex(paras, target), { align: 'start' })
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

  const changeFontSize = useCallback(
    (delta: number) => {
      onUpdateSettings({ fontSize: clamp(settings.fontSize + delta, FONT_SIZE_MIN, FONT_SIZE_MAX) })
    },
    [settings.fontSize, onUpdateSettings]
  )

  const changeLineHeight = useCallback(
    (delta: number) => {
      const next = Math.round((settings.lineHeight + delta) * 10) / 10
      onUpdateSettings({ lineHeight: clamp(next, LINE_HEIGHT_MIN, LINE_HEIGHT_MAX) })
    },
    [settings.lineHeight, onUpdateSettings]
  )

  const jumpToChapter = useCallback(
    (start: number) => {
      virtualizer.scrollToIndex(findParaIndex(paras, start), { align: 'start' })
      setShowToc(false)
    },
    [paras, virtualizer]
  )

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length))
  }, [matches.length])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length))
  }, [matches.length])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setCurrentIndex(0)
  }, [])

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      closeSearch()
    } else {
      setSearchOpen(true)
    }
  }, [searchOpen, closeSearch])

  const handleSearchKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) goPrev()
        else goNext()
      } else if (e.key === 'Escape') {
        closeSearch()
      }
    },
    [goPrev, goNext, closeSearch]
  )

  // 定位到当前匹配（查询变化时跳到首个匹配，导航时跳到对应匹配）
  useEffect(() => {
    if (matches.length === 0) return
    const target = matches[currentIndex]?.start
    if (target === undefined) return
    virtualizer.scrollToIndex(findParaIndex(paras, target), { align: 'start' })
  }, [currentIndex, matches, paras, virtualizer])

  // 打开搜索时聚焦输入框
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

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
        {chapters.length > 0 && <button onClick={() => setShowToc((v) => !v)}>目录</button>}
        <button onClick={toggleSearch}>搜索</button>
        <span className="reader-title">{data?.fileName ?? ''}</span>
        <button onClick={onCycleTheme}>主题：{THEME_LABELS[settings.theme]}</button>
        <div className="reader-controls">
          <button onClick={() => changeFontSize(-1)}>字号-</button>
          <button onClick={() => changeFontSize(1)}>字号+</button>
          <button onClick={() => changeLineHeight(-0.2)}>行距-</button>
          <button onClick={() => changeLineHeight(0.2)}>行距+</button>
        </div>
      </div>

      {searchOpen && (
        <div className="search-bar">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索正文…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCurrentIndex(0)
            }}
            onKeyDown={handleSearchKey}
          />
          <span className="search-count">
            {query.trim() === ''
              ? ''
              : matches.length > 0
                ? `${currentIndex + 1}/${matches.length}`
                : '无结果'}
          </span>
          <button onClick={goPrev} disabled={matches.length === 0}>
            上一个
          </button>
          <button onClick={goNext} disabled={matches.length === 0}>
            下一个
          </button>
          <button onClick={closeSearch}>关闭</button>
        </div>
      )}

      {showToc && chapters.length > 0 && (
        <div className="toc-panel">
          <div className="toc-header">
            <span>目录</span>
            <button onClick={() => setShowToc(false)}>关闭</button>
          </div>
          <ul className="toc-list">
            {chapters.map((c, i) => (
              <li key={i}>
                <button className="toc-item" onClick={() => jumpToChapter(c.start)}>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight
              }}
            >
              {renderParaText(paras[vi.index].text, paras[vi.index].start, matches, currentMatchStart)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
