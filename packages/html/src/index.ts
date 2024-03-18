import { encode } from './encode.js'
import { Html } from './html.js'
import { cssEscaper, javascriptEscaper, jsonEscaper } from './util.js'

type NestedArray<V> = V | readonly NestedArray<V>[]

export { Html }

/**
 * Escapes code to use as a JavaScript string inside a `<script>` tag.
 */
export const javascriptCode = (code: string) =>
  Html.dangerouslyCreate(javascriptEscaper(code))

/**
 * Escapes a value to use as an JSON variable definition inside a `<script>` tag.
 *
 * @see {@link https://redux.js.org/usage/server-rendering#security-considerations}
 */
export const jsonCode = (value: unknown) =>
  Html.dangerouslyCreate(jsonEscaper(value))

/**
 * Escapes a value to use as an CSS variable definition inside a `<style>` tag.
 */
export const cssCode = (code: string) =>
  Html.dangerouslyCreate(cssEscaper(code))

export type HtmlVariable = Html | string | number | null | undefined

export function html(
  htmlFragment: TemplateStringsArray,
  ...values: readonly NestedArray<HtmlVariable>[]
): Html {
  const fragments: Iterable<Html | string> = combineTemplateStringsFragments(
    htmlFragment,
    values,
  )
  return Html.dangerouslyCreate(fragments)
}

function* combineTemplateStringsFragments(
  htmlFragment: TemplateStringsArray,
  values: readonly NestedArray<HtmlVariable>[],
): Generator<string | Html, void, undefined> {
  for (let i = 0; i < htmlFragment.length; i++) {
    yield htmlFragment[i]!
    if (i < values.length) {
      const value = values[i]
      yield* valueToFragment(value)
    }
  }
}

function* valueToFragment(
  value: NestedArray<HtmlVariable>,
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
      yield* valueToFragment(v)
    }
  }
}
