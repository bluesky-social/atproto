import { isString } from './util'

const symbol = Symbol('Html.dangerouslyCreate')

/**
 * This class represents trusted HTML that can be safely embedded in a web page,
 * or used as fragments to build a larger HTML document.
 */
export class Html {
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
    // Lazily compute & join the fragments when they are used, to avoid
    // unnecessary intermediate strings when concatenating multiple Html as
    // fragments.
    if (
      !Array.isArray(this.#fragments) ||
      this.#fragments.length > 1 ||
      !this.#fragments.every(isString)
    ) {
      // Will call `toString` recursively, as well as generating iterator
      // results.
      const fragment = Array.from(this.#fragments, String).join('')
      this.#fragments = [fragment] // Cache result for future calls
      return fragment
    }

    return this.#fragments.join('')
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
    // Using toString() here to use the optimized path for string concatenation
    yield this.toString()
  }

  static dangerouslyCreate(fragments: Iterable<Html | string>): Html {
    return new Html(fragments, symbol)
  }
}
