import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { decodeBuffer, detectEncoding } from './lib/encoding'
import { normalizeNewlines } from './lib/normalize'
import { detectChapters } from './lib/chapters'
import { parseEpub } from './lib/epub'
import { listBooks, addBook, removeBook, updateProgress, getBook } from './store'
import { listAnnotations, addAnnotation, updateAnnotation, removeAnnotation } from './annotations'
import type { Book, BookFormat, NewAnnotation, ReadResult } from '../shared/types'

function detectFormat(filePath: string): BookFormat {
  return filePath.toLowerCase().endsWith('.epub') ? 'epub' : 'txt'
}

export function registerIpcHandlers(): void {
  ipcMain.handle('books:list', () => listBooks())

  ipcMain.handle('books:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: '导入电子书',
      filters: [
        { name: '电子书文件', extensions: ['txt', 'epub'] },
        { name: 'TXT 文本文件', extensions: ['txt'] },
        { name: 'EPUB 电子书', extensions: ['epub'] }
      ],
      properties: ['openFile', 'multiSelections']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return listBooks()
    }

    for (const filePath of result.filePaths) {
      const format = detectFormat(filePath)
      const book: Book = {
        id: randomUUID(),
        fileName: basename(filePath),
        filePath,
        encoding: 'utf-8',
        format,
        progress: 0,
        addedAt: Date.now()
      }

      if (format === 'txt') {
        const buf = await readFile(filePath)
        book.encoding = detectEncoding(buf)
      } else {
        try {
          const parsed = await parseEpub(await readFile(filePath))
          book.title = parsed.title ?? undefined
        } catch {
          // 解析失败仍入库，读取时再报错并展示
        }
      }
      addBook(book)
    }
    return listBooks()
  })

  ipcMain.handle('books:remove', (_e, id: string) => {
    removeBook(id)
    return listBooks()
  })

  ipcMain.handle('books:read', async (_e, id: string): Promise<ReadResult | null> => {
    const book = getBook(id)
    if (!book) return null
    try {
      const format = book.format ?? detectFormat(book.filePath)
      let content: string
      let chapters
      if (format === 'epub') {
        const parsed = await parseEpub(await readFile(book.filePath))
        content = parsed.content
        chapters = parsed.chapters
      } else {
        const buf = await readFile(book.filePath)
        const { text } = decodeBuffer(buf)
        content = normalizeNewlines(text)
        chapters = detectChapters(content)
      }
      return {
        id: book.id,
        fileName: book.fileName,
        content,
        progress: book.progress,
        chapters
      }
    } catch {
      return null
    }
  })

  ipcMain.handle('books:updateProgress', (_e, id: string, progress: number) => {
    updateProgress(id, progress)
  })

  ipcMain.handle('annotations:list', (_e, bookId: string) => listAnnotations(bookId))

  ipcMain.handle('annotations:add', (_e, input: NewAnnotation) => addAnnotation(input))

  ipcMain.handle('annotations:update', (_e, id: string, note: string) => updateAnnotation(id, note))

  ipcMain.handle('annotations:remove', (_e, id: string) => removeAnnotation(id))
}
