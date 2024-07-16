export class TransformedResponse extends Response {
  #response: Response

  constructor(response: Response, transform: TransformStream) {
    if (!response.body) {
      throw new TypeError('Response body is not available')
    }
    if (response.bodyUsed) {
      throw new TypeError('Response body is already used')
    }

    super(response.body.pipeThrough(transform), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })

    this.#response = response
  }

  /**
   * Some props can't be set through ResponseInit, so we need to proxy them
   */
  get url() {
    return this.#response.url
  }
  get redirected() {
    return this.#response.redirected
  }
  get type() {
    return this.#response.type
  }
  get statusText() {
    return this.#response.statusText
  }
}
