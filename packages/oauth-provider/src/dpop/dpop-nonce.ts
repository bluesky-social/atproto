import { createHmac, randomBytes } from 'node:crypto'

import { DPOP_NONCE_MAX_AGE } from '../constants.js'

function numTo64bits(num: number) {
  const arr = new Uint8Array(8)
  arr[7] = (num = num | 0) & 0xff
  arr[6] = (num >>= 8) & 0xff
  arr[5] = (num >>= 8) & 0xff
  arr[4] = (num >>= 8) & 0xff
  arr[3] = (num >>= 8) & 0xff
  arr[2] = (num >>= 8) & 0xff
  arr[1] = (num >>= 8) & 0xff
  arr[0] = (num >>= 8) & 0xff
  return arr
}

export type DpopNonceInput = string | Uint8Array | DpopNonce

export class DpopNonce {
  #secret: Uint8Array
  #counter: number

  #prev: string
  #now: string
  #next: string

  constructor(
    protected readonly secret: Uint8Array,
    protected readonly step: number,
  ) {
    if (secret.length !== 32) throw new TypeError('Expected 32 bytes')
    if (this.step < 0 || this.step > DPOP_NONCE_MAX_AGE / 3) {
      throw new TypeError('Invalid step')
    }

    this.#secret = Uint8Array.from(secret)
    this.#counter = (Date.now() / step) | 0

    this.#prev = this.compute(this.#counter - 1)
    this.#now = this.compute(this.#counter)
    this.#next = this.compute(this.#counter + 1)
  }

  protected rotate() {
    const counter = (Date.now() / this.step) | 0
    switch (counter - this.#counter) {
      case 0:
        // counter === this.#counter => nothing to do
        return
      case 1:
        // Optimization: avoid recomputing #prev & #now
        this.#prev = this.#now
        this.#now = this.#next
        this.#next = this.compute(counter + 1)
        break
      case 2:
        // Optimization: avoid recomputing #prev
        this.#prev = this.#next
        this.#now = this.compute(counter)
        this.#next = this.compute(counter + 1)
        break
      default:
        // All nonces are outdated, so we recompute all of them
        this.#prev = this.compute(counter - 1)
        this.#now = this.compute(counter)
        this.#next = this.compute(counter + 1)
        break
    }
    this.#counter = counter
  }

  protected compute(counter: number) {
    return createHmac('sha256', this.#secret)
      .update(numTo64bits(counter))
      .digest()
      .toString('base64url')
  }

  public next() {
    this.rotate()
    return this.#next
  }

  public check(nonce: string) {
    return this.#next === nonce || this.#now === nonce || this.#prev === nonce
  }

  static from(
    input: DpopNonceInput = randomBytes(32),
    step = DPOP_NONCE_MAX_AGE / 3,
  ): DpopNonce {
    if (input instanceof DpopNonce) {
      return input
    }
    if (input instanceof Uint8Array) {
      return new DpopNonce(input, step)
    }
    if (typeof input === 'string') {
      return new DpopNonce(Buffer.from(input, 'hex'), step)
    }
    return new DpopNonce(input, step)
  }
}
