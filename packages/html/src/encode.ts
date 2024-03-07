const specialCharRegExp = /[<>"'&]/g
const specialCharMap = new Map([
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&apos;'],
  ['&', '&amp;'],
])
const specialCharMapGet = (c: string) => specialCharMap.get(c)!
export function encode(value: string): string {
  return value.replace(specialCharRegExp, specialCharMapGet)
}
