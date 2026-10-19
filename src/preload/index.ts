import { contextBridge, ipcRenderer } from 'electron'
import type { ReaderApi } from '../shared/types'

const api: ReaderApi = {
  listBooks: () => ipcRenderer.invoke('books:list'),
  importBooks: () => ipcRenderer.invoke('books:import'),
  removeBook: (id: string) => ipcRenderer.invoke('books:remove', id),
  readBook: (id: string) => ipcRenderer.invoke('books:read', id),
  updateProgress: (id: string, progress: number) =>
    ipcRenderer.invoke('books:updateProgress', id, progress)
}

contextBridge.exposeInMainWorld('api', api)
