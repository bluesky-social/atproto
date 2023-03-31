// counts the number of bytes in a utf8 string
export const utf8Len = (str: string): number => {
  return new TextEncoder().encode(str).byteLength
}

// counts the number of graphemes (user-displayed characters) in a string
export const graphemeLen = (str: string): number => {
  return [...new Intl.Segmenter().segment(str)].length
}
