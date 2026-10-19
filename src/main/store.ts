import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Book } from '../shared/types'

let cache: Book[] | null = null

function storeFilePath(): string {
  return join(app.getPath('userData'), 'books.json')
}

export function listBooks(): Book[] {
  if (cache !== null) return cache
  const file = storeFilePath()
  if (!existsSync(file)) {
    cache = []
    return cache
  }
  try {
    cache = JSON.parse(readFileSync(file, 'utf-8')) as Book[]
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  writeFileSync(storeFilePath(), JSON.stringify(cache ?? [], null, 2), 'utf-8')
}

export function addBook(book: Book): void {
  listBooks().push(book)
  persist()
}

export function removeBook(id: string): void {
  cache = listBooks().filter((b) => b.id !== id)
  persist()
}

export function updateProgress(id: string, progress: number): void {
  const book = listBooks().find((b) => b.id === id)
  if (book) {
    book.progress = Math.max(0, Math.floor(progress))
    persist()
  }
}

export function getBook(id: string): Book | undefined {
  return listBooks().find((b) => b.id === id)
}
