import { escape } from 'html-escaper'

export const toArrayBuffer = (str: string) => {
  const enc = new TextEncoder()
  const buf = enc.encode(str)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  // const buf = new ArrayBuffer(str.length * 2) // 2 bytes for each char
  // const bufView = new Uint16Array(buf)
  // for (let i = 0, strLen = str.length; i < strLen; i++) {
  //   bufView[i] = str.charCodeAt(i)
  // }
  // return buf
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
