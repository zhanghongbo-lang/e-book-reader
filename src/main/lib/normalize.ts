/** 把 \r\n、\r 统一成 \n，避免按行切分出错 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}
