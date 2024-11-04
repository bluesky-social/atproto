import { isString } from './util'

const symbol = Symbol('Html.dangerouslyCreate')

/**
 * This class represents trusted HTML that can be safely embedded in a web page,
 * or used as fragments to build a larger HTML document.
 */
export class Html implements Iterable<string> {
  #fragments: Iterable<Html | string>

  private constructor(fragments: Iterable<Html | string>, guard: symbol) {
    if (guard !== symbol) {
      // Force developers to use `Html.dangerouslyCreate` to create an Html
      // instance, to make it clear that the content needs to be trusted.
      throw new TypeError(
        'Use Html.dangerouslyCreate() to create an Html instance',
      )
    }

    this.#fragments = fragments
  }

  toString(): string {
    let result = ''
    for (const fragment of this) result += fragment

    // Cache result for future calls
    if (
      !Array.isArray(this.#fragments) ||
      this.#fragments.length > 1 ||
      !this.#fragments.every(isString)
    ) {
      this.#fragments = result ? [result] : []
    }

    return result
  }

  [Symbol.toPrimitive](hint): string {
    switch (hint) {
      case 'string':
      case 'default':
        return this.toString()
      default:
        throw new TypeError(`Cannot convert Html to a ${hint}`)
    }
  }

  *[Symbol.iterator](): IterableIterator<string> {
    for (const fragment of this.#fragments) {
      if (typeof fragment === 'string') {
        yield fragment
      } else {
        yield* fragment
      }
    }
  }

  static dangerouslyCreate(fragments: Iterable<Html | string>): Html {
    return new Html(fragments, symbol)
  }
}
