import { relative } from 'node:path'

export function memoize<T extends (arg: string) => NonNullable<unknown> | null>(
  fn: T,
): T {
  const cache = new Map<string, NonNullable<unknown> | null>()
  return ((arg: string) => {
    const cached = cache.get(arg)
    if (cached !== undefined) return cached
    const result = fn(arg)
    cache.set(arg, result)
    return result
  }) as T
}

export function startsWithLower(str: string) {
  const code = str.charCodeAt(0)
  return code >= 97 && code <= 122 // 'a' to 'z'
}

export function ucFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function lcFirst(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

export function toPascalCase(str: string): string {
  return extractWords(str).map(toLowerCase).map(ucFirst).join('')
}

export function toCamelCase(str: string): string {
  return lcFirst(toPascalCase(str))
}

export function toConstantCase(str: string): string {
  return extractWords(str).map(toUpperCase).join('_')
}

export function toLowerCase(str: string): string {
  return str.toLowerCase()
}

export function toUpperCase(str: string): string {
  return str.toUpperCase()
}

function extractWords(str: string): string[] {
  const processedStr = str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // split camelCase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2') // split ALLCAPSWords
    .replace(/([0-9])([A-Za-z])/g, '$1 $2') // split number followed by letter
    .replace(/[^a-zA-Z0-9]+/g, ' ') // replace non-alphanumeric with space
    .trim() // trim leading/trailing spaces

  return processedStr
    ? processedStr.split(/\s+/) // split by spaces
    : [] // Avoid returning [''] for empty strings
}

export function asRelativePath(from: string, to: string) {
  const relPath = relative(from, to)
  return relPath.startsWith('./') || relPath.startsWith('../')
    ? relPath
    : `./${relPath}`
}

export function startsWithDigit(str: string) {
  const code = str.charCodeAt(0)
  return code >= 48 && code <= 57 // '0' to '9'
}
