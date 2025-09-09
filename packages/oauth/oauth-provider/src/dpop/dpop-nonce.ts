import { createHmac, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { DPOP_NONCE_MAX_AGE } from '../constants.js'

const MAX_ROTATION_INTERVAL = DPOP_NONCE_MAX_AGE / 3
const MIN_ROTATION_INTERVAL = Math.min(1000, MAX_ROTATION_INTERVAL)

export const rotationIntervalSchema = z
  .number()
  .int()
  .min(MIN_ROTATION_INTERVAL)
  .max(MAX_ROTATION_INTERVAL)

const SECRET_BYTE_LENGTH = 32

export const secretBytesSchema = z
  .instanceof(Uint8Array)
  .refine((secret) => secret.length === SECRET_BYTE_LENGTH, {
    message: `Secret must be exactly ${SECRET_BYTE_LENGTH} bytes long`,
  })

export const secretHexSchema = z
  .string()
  .regex(
    /^[0-9a-f]+$/i,
    `Secret must be a ${SECRET_BYTE_LENGTH * 2} chars hex string`,
  )
  .length(SECRET_BYTE_LENGTH * 2)
  .transform((hex): Uint8Array => Buffer.from(hex, 'hex'))

export const dpopSecretSchema = z.union([secretBytesSchema, secretHexSchema])
export type DpopSecret = z.input<typeof dpopSecretSchema>

export class DpopNonce {
  readonly #rotationInterval: number
  readonly #secret: Uint8Array

  // Nonce state
  #counter: number
  #prev: string
  #now: string
  #next: string

  constructor(
    secret: DpopSecret = randomBytes(SECRET_BYTE_LENGTH),
    rotationInterval = MAX_ROTATION_INTERVAL,
  ) {
    this.#rotationInterval = rotationIntervalSchema.parse(rotationInterval)
    this.#secret = Uint8Array.from(dpopSecretSchema.parse(secret))

    this.#counter = this.currentCounter
    this.#prev = this.compute(this.#counter - 1)
    this.#now = this.compute(this.#counter)
    this.#next = this.compute(this.#counter + 1)
  }

  /**
   * Returns the number of full rotations since the epoch
   */
  protected get currentCounter() {
    return (Date.now() / this.#rotationInterval) | 0
  }

  protected rotate() {
    const counter = this.currentCounter
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
}

function numTo64bits(num: number) {
  const arr = new Uint8Array(8)
  // @NOTE Assigning to an uint8 will only keep the last 8 int bits
  arr[7] = num |= 0
  arr[6] = num >>= 8
  arr[5] = num >>= 8
  arr[4] = num >>= 8
  arr[3] = num >>= 8
  arr[2] = num >>= 8
  arr[1] = num >>= 8
  arr[0] = num >>= 8
  return arr
}
