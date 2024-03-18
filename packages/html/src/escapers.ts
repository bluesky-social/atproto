import { Html } from './html.js'
import { NestedArray, stringReplacer } from './util.js'

export function* javascriptEscaper(code: string) {
  // "</script>" can only appear in javascript strings, so we can safely escape
  // the "<" without breaking the javascript.
  yield* stringReplacer(code, '</script>', '\\u003c/script>')
}

export function* jsonEscaper(value: unknown) {
  // https://redux.js.org/usage/server-rendering#security-considerations
  yield* stringReplacer(JSON.stringify(value), '<', '\\u003c')
}

export function* cssEscaper(css: string) {
  yield* stringReplacer(css, '</style>', '\\u003c/style>')
}

export type HtmlVariable = Html | string | number | null | undefined
export type HtmlValue = NestedArray<HtmlVariable>

export function* htmlEscaper(
  htmlFragments: TemplateStringsArray,
  values: readonly HtmlValue[],
): Generator<string | Html, void, undefined> {
  for (let i = 0; i < htmlFragments.length; i++) {
    yield htmlFragments[i]!

    const value = values[i]
    if (value != null) yield* htmlVariableToFragments(value)
  }
}

function* htmlVariableToFragments(
  value: HtmlValue,
): Generator<string | Html, void, undefined> {
  if (value == null) {
    return
  } else if (typeof value === 'number') {
    yield String(value)
  } else if (typeof value === 'string') {
    yield encode(value)
  } else if (value instanceof Html) {
    yield value
  } else if (Array.isArray(value)) {
    for (const v of value) {
      yield* htmlVariableToFragments(v)
    }
  }
}

const specialCharRegExp = /[<>"'&]/g
const specialCharMap = new Map([
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&apos;'],
  ['&', '&amp;'],
])
const specialCharMapGet = (c: string) => specialCharMap.get(c)!
function encode(value: string): string {
  return value.replace(specialCharRegExp, specialCharMapGet)
}
