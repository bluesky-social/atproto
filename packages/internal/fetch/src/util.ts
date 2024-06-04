// @TODO: Move some of these to a shared package ?

export type JsonScalar = string | number | boolean | null
export type Json = JsonScalar | Json[] | { [key: string]: undefined | Json }
export type JsonObject = { [key: string]: Json }
export type JsonArray = Json[]

export function isIp(hostname: string) {
  // IPv4
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return true

  // IPv6
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true

  return false
}

const plainObjectProto = Object.prototype
export const ifObject = <V>(v: V) => {
  if (typeof v === 'object' && v != null && !Array.isArray(v)) {
    const proto = Object.getPrototypeOf(v)
    if (proto === null || proto === plainObjectProto) {
      // eslint-disable-next-line @typescript-eslint/ban-types
      return v as V extends JsonScalar | JsonArray | Function | symbol
        ? never
        : V extends Json
          ? V
          : // Plain object are (mostly) safe to access using a string index
            Record<string, unknown>
    }
  }

  return undefined
}

export const ifString = <V>(v: V) => (typeof v === 'string' ? v : undefined)

export class MaxBytesTransformStream extends TransformStream<
  Uint8Array,
  Uint8Array
> {
  constructor(maxBytes: number) {
    // Note: negation accounts for invalid value types (NaN, non numbers)
    if (!(maxBytes >= 0)) {
      throw new TypeError('maxBytes must be a non-negative number')
    }

    let bytesRead = 0

    super({
      transform: (
        chunk: Uint8Array,
        ctrl: TransformStreamDefaultController<Uint8Array>,
      ) => {
        if ((bytesRead += chunk.length) <= maxBytes) {
          ctrl.enqueue(chunk)
        } else {
          ctrl.error(new Error('Response too large'))
        }
      },
    })
  }
}
