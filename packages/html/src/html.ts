const symbol = Symbol('Html.dangerouslyCreate')

/**
 * This class represents trusted HTML that can be safely embedded in a web page,
 * or used as fragments to build a larger HTML document.
 */
export class Html {
  #fragments: Iterable<string>

  private constructor(fragments: Iterable<string>, guard: symbol) {
    if (guard !== symbol) {
      // Force developers to use `Html.dangerouslyCreate` to create an Html
      // instance, to make it clear that the content needs to be trusted.
      throw new TypeError(
        'Use Html.dangerouslyCreate to create an Html instance',
      )
    }

    this.#fragments = fragments
  }

  /**
   * Returns the HTML fragments as an array of strings. If the fragments are
   * not already an array, they are lazily consumed into an array.
   */
  get fragments(): readonly string[] {
    if (!Array.isArray(this.#fragments)) {
      const array = Array.from(this.#fragments)
      this.#fragments = array
      return array
    }

    return this.#fragments
  }

  toString(): string {
    const { fragments } = this

    // Lazily join the fragments when they are used, to avoid unnecessary
    // intermediate strings when concatenating multiple Html as fragments.
    if (fragments.length > 1) {
      const string = fragments.join('')
      this.#fragments = [string]
      return string
    }

    return fragments.join('')
  }

  toBuffer(): Buffer {
    return Buffer.from(this.toString(), 'utf8')
  }

  static dangerouslyCreate(fragments: Iterable<string>): Html {
    return new Html(fragments, symbol)
  }
}
