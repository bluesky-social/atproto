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
