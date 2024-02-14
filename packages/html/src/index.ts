type NestedArray<V> = V | readonly NestedArray<V>[]

export function html(
  htmlFragment: TemplateStringsArray,
  ...values: readonly NestedArray<string | TrustedHtml>[]
): TrustedHtml {
  const fragments: string[] = []
  for (let i = 0; i < htmlFragment.length; i++) {
    fragments.push(htmlFragment[i]!)
    if (i < values.length) {
      fragments.push(...valueToFragment(values[i]!))
    }
  }

  return new TrustedHtml(fragments)
}

html.dangerouslyCreate = (fragment: string) => new TrustedHtml([fragment])

html.scriptTag = (fragment: string) =>
  // "</script>" can only appear in javascript strings, so we can safely escape
  // the "<" without breaking the javascript.
  new TrustedHtml([fragment.replace(/<\/script>/g, '\\u003c/script>')])

/**
 * @see {@link https://redux.js.org/usage/server-rendering#security-considerations}
 */
html.jsonForScriptTag = (value: unknown) =>
  new TrustedHtml([JSON.stringify(value).replace(/</g, '\\u003c')])

function* valueToFragment(
  value: NestedArray<string | TrustedHtml>,
): Generator<string, void, undefined> {
  if (typeof value === 'string') {
    yield encode(value)
  } else if (value instanceof TrustedHtml) {
    yield* value.fragments
  } else {
    for (const v of value) {
      yield* valueToFragment(v)
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
function encode(value: string): string {
  return value.replace(specialCharRegExp, (c) => specialCharMap.get(c)!)
}

class TrustedHtml {
  constructor(readonly fragments: readonly string[]) {}
  toString() {
    return this.fragments.join('')
  }
  toBuffer() {
    return Buffer.concat(this.fragments.map((f) => Buffer.from(f)))
  }
}
