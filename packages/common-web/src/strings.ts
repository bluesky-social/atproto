import Graphemer from 'graphemer'
import * as ui8 from 'uint8arrays'

// counts the number of bytes in a utf8 string
export const utf8Len = (str: string): number => {
  return new TextEncoder().encode(str).byteLength
}

// counts the number of graphemes (user-displayed characters) in a string
export const graphemeLen = (str: string): number => {
  const splitter = new Graphemer()
  return splitter.countGraphemes(str)
}

export const utf8ToB64Url = (utf8: string): string => {
  return ui8.toString(ui8.fromString(utf8, 'utf8'), 'base64url')
}

export const b64UrlToUtf8 = (b64: string): string => {
  return ui8.toString(ui8.fromString(b64, 'base64url'), 'utf8')
}
