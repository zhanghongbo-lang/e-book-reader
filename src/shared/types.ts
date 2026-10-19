export interface Book {
  id: string
  fileName: string
  filePath: string
  encoding: string
  progress: number
  addedAt: number
}

export interface Chapter {
  title: string
  start: number
}

export interface ReadResult {
  id: string
  fileName: string
  content: string
  progress: number
  chapters: Chapter[]
}

/** preload 通过 contextBridge 暴露给渲染进程的 API */
export interface ReaderApi {
  listBooks: () => Promise<Book[]>
  importBooks: () => Promise<Book[]>
  removeBook: (id: string) => Promise<Book[]>
  readBook: (id: string) => Promise<ReadResult | null>
  updateProgress: (id: string, progress: number) => Promise<void>
}
