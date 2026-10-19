import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { decodeBuffer, detectEncoding } from './lib/encoding'
import { normalizeNewlines } from './lib/normalize'
import { listBooks, addBook, removeBook, updateProgress, getBook } from './store'
import type { Book, ReadResult } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('books:list', () => listBooks())

  ipcMain.handle('books:import', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: '导入 TXT 文件',
      filters: [{ name: 'TXT 文本文件', extensions: ['txt'] }],
      properties: ['openFile', 'multiSelections']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return listBooks()
    }

    for (const filePath of result.filePaths) {
      const buf = await readFile(filePath)
      const encoding = detectEncoding(buf)
      const book: Book = {
        id: randomUUID(),
        fileName: basename(filePath),
        filePath,
        encoding,
        progress: 0,
        addedAt: Date.now()
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
    const buf = await readFile(book.filePath)
    const { text } = decodeBuffer(buf)
    return {
      id: book.id,
      fileName: book.fileName,
      content: normalizeNewlines(text),
      progress: book.progress
    }
  })

  ipcMain.handle('books:updateProgress', (_e, id: string, progress: number) => {
    updateProgress(id, progress)
  })
}
