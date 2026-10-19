import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Annotation, NewAnnotation } from '../shared/types'

let cache: Annotation[] | null = null

function storeFilePath(): string {
  return join(app.getPath('userData'), 'annotations.json')
}

function load(): Annotation[] {
  if (cache !== null) return cache
  const file = storeFilePath()
  if (!existsSync(file)) {
    cache = []
    return cache
  }
  try {
    cache = JSON.parse(readFileSync(file, 'utf-8')) as Annotation[]
  } catch {
    cache = []
  }
  return cache
}

function persist(): void {
  writeFileSync(storeFilePath(), JSON.stringify(cache ?? [], null, 2), 'utf-8')
}

export function listAnnotations(bookId: string): Annotation[] {
  return load()
    .filter((a) => a.bookId === bookId)
    .sort((a, b) => a.start - b.start)
}

export function addAnnotation(input: NewAnnotation): Annotation[] {
  const annotation: Annotation = {
    id: randomUUID(),
    bookId: input.bookId,
    start: input.start,
    end: input.end,
    text: input.text,
    note: input.note ?? '',
    createdAt: Date.now()
  }
  load().push(annotation)
  persist()
  return listAnnotations(input.bookId)
}

export function updateAnnotation(id: string, note: string): Annotation[] {
  const found = load().find((a) => a.id === id)
  if (!found) return []
  found.note = note
  persist()
  return listAnnotations(found.bookId)
}

export function removeAnnotation(id: string): Annotation[] {
  const found = load().find((a) => a.id === id)
  if (!found) return []
  cache = load().filter((a) => a.id !== id)
  persist()
  return listAnnotations(found.bookId)
}
