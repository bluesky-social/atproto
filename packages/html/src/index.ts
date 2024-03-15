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

export function html(
  htmlFragment: TemplateStringsArray,
  ...values: readonly NestedArray<null | undefined | false | string | Html>[]
): Html {
  const fragments: Iterable<string> = combineTemplateStringsFragments(
    htmlFragment,
    values,
  )
  return Html.dangerouslyCreate(fragments)
}

function* combineTemplateStringsFragments(
  htmlFragment: TemplateStringsArray,
  values: readonly NestedArray<null | undefined | false | string | Html>[],
): Generator<string, void, undefined> {
  for (let i = 0; i < htmlFragment.length; i++) {
    yield htmlFragment[i]!
    if (i < values.length) {
      const value = values[i]
      if (value != null && value !== false) {
        yield* valueToFragment(value)
      }
    }
  }
}

function* valueToFragment(
  value: NestedArray<null | undefined | false | string | Html>,
): Generator<string, void, undefined> {
  if (typeof value === 'string') {
    yield encode(value)
  } else if (value instanceof Html) {
    yield* value.fragments
  } else if (value != null && value !== false) {
    for (const v of value) {
      yield* valueToFragment(v)
    }
  }
}
