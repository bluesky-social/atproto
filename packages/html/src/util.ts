export function* stringReplacer(
  source: string,
  searchValue: string,
  replaceValue: string,
) {
  let previousIndex = 0
  let index = source.indexOf(searchValue)
  while (index !== -1) {
    yield source.slice(previousIndex, index)
    yield replaceValue
    previousIndex = index + searchValue.length
    index = source.indexOf(searchValue, previousIndex)
  }
  yield source.slice(previousIndex)
}

/**
 * "</script>" can only appear in javascript strings, so we can safely escape
 * the "<" without breaking the javascript.
 */
export function* javascriptEscaper(code: string) {
  yield* stringReplacer(code, '</script>', '\\u003c/script>')
}

/**
 * @see {@link https://redux.js.org/usage/server-rendering#security-considerations}
 */
export function* jsonEscaper(value: unknown) {
  yield* stringReplacer(JSON.stringify(value), '<', '\\u003c')
}
