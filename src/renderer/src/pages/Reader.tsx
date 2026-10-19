import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Annotation, ReadResult } from '../../../shared/types'
import { findMatches, type Match } from '../../../shared/lib/search'
import { splitRichLine } from '../../../shared/lib/annotations'
import {
  clamp,
  FONT_LABELS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_STACKS,
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
  onCycleFont: () => void
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

function ancestorPara(node: Node): Element | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return el ? el.closest('.para') : null
}

/** 段落内相对偏移（从段首到 container/offset 的文本长度） */
function relOffset(para: Element, container: Node, offset: number): number {
  const r = document.createRange()
  r.selectNodeContents(para)
  r.setEnd(container, offset)
  return r.toString().length
}

/** 把当前选区映射为全文字符偏移（选区需落在阅读器段落内） */
function getSelectionOffsets(): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)

  const startPara = ancestorPara(range.startContainer)
  const endPara = ancestorPara(range.endContainer)
  if (!startPara || !endPara) return null

  const startBase = Number(startPara.getAttribute('data-start') ?? NaN)
  const endBase = Number(endPara.getAttribute('data-start') ?? NaN)
  if (!Number.isFinite(startBase) || !Number.isFinite(endBase)) return null

  const start = startBase + relOffset(startPara, range.startContainer, range.startOffset)
  const end = endBase + relOffset(endPara, range.endContainer, range.endOffset)
  if (end <= start) return null
  return { start, end }
}

/** 把一行文本按搜索命中与批注渲染为高亮节点 */
function renderParaText(
  text: string,
  start: number,
  matches: Match[],
  currentMatchStart: number | null,
  annotations: Annotation[]
): ReactNode {
  // 空行不渲染占位文本，改由 CSS 的 .para:empty::after 提供，
  // 保证 DOM 文本与内容严格一致，选区偏移映射不产生偏差
  if (text.length === 0) return null
  if (matches.length === 0 && annotations.length === 0) return text
  const segments = splitRichLine(text, start, matches, currentMatchStart, annotations)
  return segments.map((seg, i) => {
    const classes: string[] = []
    if (seg.annotation) classes.push(seg.hasNote ? 'annotation has-note' : 'annotation')
    if (seg.search) classes.push(seg.current ? 'search-hit current' : 'search-hit')
    if (classes.length === 0) return <span key={i}>{seg.text}</span>
    return (
      <mark key={i} className={classes.join(' ')}>
        {seg.text}
      </mark>
    )
  })
}

export default function Reader({ bookId, onBack, settings, onUpdateSettings, onCycleTheme, onCycleFont }: Props) {
  const [data, setData] = useState<ReadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null
  )
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [draftNote, setDraftNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')

  const parentRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)
  const lastOffsetRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef<ReadResult | null>(null)
  const noteModeRef = useRef(false)

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

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    noteModeRef.current = noteMode
  }, [noteMode])

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

  // 加载批注
  useEffect(() => {
    let cancelled = false
    window.api.listAnnotations(bookId).then((list) => {
      if (!cancelled) setAnnotations(list)
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

  // 监听文本选区，显示浮动工具栏
  useEffect(() => {
    const handleUp = () => {
      if (noteModeRef.current) return
      const s = getSelectionOffsets()
      if (!s) {
        setSelection(null)
        setToolbarPos(null)
        return
      }
      const range = window.getSelection()?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      if (!rect) return
      const text = dataRef.current?.content.slice(s.start, s.end) ?? ''
      setSelection({ start: s.start, end: s.end, text })
      setToolbarPos({
        x: Math.min(Math.max(rect.left + rect.width / 2, 100), window.innerWidth - 100),
        y: Math.max(rect.top - 8, 8)
      })
    }
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('keyup', handleUp)
    return () => {
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('keyup', handleUp)
    }
  }, [])

  const saveProgress = useCallback(
    (offset: number) => {
      void window.api.updateProgress(bookId, offset)
    },
    [bookId]
  )

  const handleScroll = useCallback(() => {
    setSelection(null)
    setToolbarPos(null)
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

  const clearSelection = useCallback(() => {
    setSelection(null)
    setToolbarPos(null)
    setNoteMode(false)
    setDraftNote('')
  }, [])

  const addAnnotationAndRefresh = useCallback(
    async (start: number, end: number, text: string, note: string) => {
      const list = await window.api.addAnnotation({ bookId, start, end, text, note })
      setAnnotations(list)
    },
    [bookId]
  )

  const handleHighlight = useCallback(() => {
    if (!selection) return
    void addAnnotationAndRefresh(selection.start, selection.end, selection.text, '')
    clearSelection()
  }, [selection, addAnnotationAndRefresh, clearSelection])

  const startNote = useCallback(() => {
    setNoteMode(true)
    setDraftNote('')
  }, [])

  const saveNote = useCallback(() => {
    if (!selection) return
    void addAnnotationAndRefresh(selection.start, selection.end, selection.text, draftNote.trim())
    clearSelection()
  }, [selection, draftNote, addAnnotationAndRefresh, clearSelection])

  const removeAnnotation = useCallback(async (id: string) => {
    const list = await window.api.removeAnnotation(id)
    setAnnotations(list)
    setEditingId(null)
  }, [])

  const jumpToAnnotation = useCallback(
    (start: number) => {
      virtualizer.scrollToIndex(findParaIndex(paras, start), { align: 'start' })
      setShowAnnotations(false)
    },
    [paras, virtualizer]
  )

  const startEdit = useCallback((a: Annotation) => {
    setEditingId(a.id)
    setEditingNote(a.note)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const list = await window.api.updateAnnotation(editingId, editingNote.trim())
    setAnnotations(list)
    setEditingId(null)
  }, [editingId, editingNote])

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
        <button onClick={() => setShowAnnotations((v) => !v)}>
          批注{annotations.length > 0 ? `(${annotations.length})` : ''}
        </button>
        <span className="reader-title">{data?.fileName ?? ''}</span>
        <button onClick={onCycleTheme}>主题：{THEME_LABELS[settings.theme]}</button>
        <button onClick={onCycleFont}>字体：{FONT_LABELS[settings.fontFamily]}</button>
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

      {showAnnotations && (
        <div className="annotations-panel">
          <div className="toc-header">
            <span>批注</span>
            <button onClick={() => setShowAnnotations(false)}>关闭</button>
          </div>
          {annotations.length === 0 ? (
            <div className="empty">还没有批注，选中文字后点「高亮」或「批注」添加</div>
          ) : (
            <ul className="annotation-list">
              {annotations.map((a) => (
                <li key={a.id} className="annotation-item">
                  <button
                    className="annotation-main"
                    onClick={() => jumpToAnnotation(a.start)}
                    title={a.text}
                  >
                    <span className="annotation-text">{a.text || a.note}</span>
                    {a.note && <span className="annotation-note">{a.note}</span>}
                  </button>
                  {editingId === a.id ? (
                    <div className="annotation-edit">
                      <textarea
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        autoFocus
                      />
                      <div className="annotation-edit-actions">
                        <button onClick={() => void saveEdit()}>保存</button>
                        <button onClick={() => setEditingId(null)}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="annotation-actions">
                      <button onClick={() => startEdit(a)}>编辑</button>
                      <button onClick={() => void removeAnnotation(a.id)}>删除</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
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
              data-start={paras[vi.index].start}
              ref={virtualizer.measureElement}
              className="para"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                fontFamily: FONT_STACKS[settings.fontFamily]
              }}
            >
              {renderParaText(
                paras[vi.index].text,
                paras[vi.index].start,
                matches,
                currentMatchStart,
                annotations
              )}
            </div>
          ))}
        </div>
      </div>

      {toolbarPos && selection && (
        <div className="selection-toolbar" style={{ left: toolbarPos.x, top: toolbarPos.y }}>
          {noteMode ? (
            <div className="note-form">
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="输入批注…"
                autoFocus
              />
              <div className="note-form-actions">
                <button onMouseDown={(e) => e.preventDefault()} onClick={saveNote}>
                  保存
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={clearSelection}>
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="toolbar-actions">
              <button onMouseDown={(e) => e.preventDefault()} onClick={handleHighlight}>
                高亮
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={startNote}>
                批注
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
