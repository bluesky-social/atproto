import { escape } from 'html-escaper'

export const toArrayBuffer = (str: string) => {
  const enc = new TextEncoder()
  const buf = enc.encode(str)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

export const html = (
  val: Array<string> | string | number | null | undefined,
) => {
  if (typeof val === 'string') {
    return escape(val)
  }
  if (typeof val === 'number') {
    return escape(val.toLocaleString())
  }
  if (Array.isArray(val)) {
    return val.join('\n') // this is a container, assumes inner values are already escaped
  }
  return ''
}
