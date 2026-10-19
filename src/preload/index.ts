import { contextBridge, ipcRenderer } from 'electron'
import type { NewAnnotation, ReaderApi } from '../shared/types'

const api: ReaderApi = {
  listBooks: () => ipcRenderer.invoke('books:list'),
  importBooks: () => ipcRenderer.invoke('books:import'),
  removeBook: (id: string) => ipcRenderer.invoke('books:remove', id),
  readBook: (id: string) => ipcRenderer.invoke('books:read', id),
  updateProgress: (id: string, progress: number) =>
    ipcRenderer.invoke('books:updateProgress', id, progress),
  listAnnotations: (bookId: string) => ipcRenderer.invoke('annotations:list', bookId),
  addAnnotation: (input: NewAnnotation) => ipcRenderer.invoke('annotations:add', input),
  updateAnnotation: (id: string, note: string) => ipcRenderer.invoke('annotations:update', id, note),
  removeAnnotation: (id: string) => ipcRenderer.invoke('annotations:remove', id)
}

contextBridge.exposeInMainWorld('api', api)
