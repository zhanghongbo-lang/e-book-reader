declare module 'jschardet' {
  export interface IDetectedMap {
    encoding: string
    confidence: number
  }

  export function detect(buffer: Uint8Array | string): IDetectedMap | null
  export function detectAll(buffer: Uint8Array | string): IDetectedMap[]

  const jschardet: {
    detect: typeof detect
    detectAll: typeof detectAll
  }
  export default jschardet
}
