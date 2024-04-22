// TODO: Move to a shared package ?

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

// TODO: Move to a shared package ?

const plainObjectProto = Object.prototype
export const ifObject = <V>(v?: V) => {
  if (typeof v === 'object' && v != null && !Array.isArray(v)) {
    const proto = Object.getPrototypeOf(v)
    if (proto === null || proto === plainObjectProto) {
      // eslint-disable-next-line @typescript-eslint/ban-types
      return v as V extends JsonScalar | JsonArray | Function | symbol
        ? never
        : V extends Json
          ? V
          : // Plain object are (mostly) safe to access as Json
            { [key: string]: unknown }
    }
  }

  return undefined
}

export const ifArray = <V>(v?: V) => (Array.isArray(v) ? v : undefined)
export const ifScalar = <V>(v?: V) => {
  switch (typeof v) {
    case 'string':
    case 'number':
    case 'boolean':
      return v
    default:
      if (v === null) return null as V & null
      return undefined as V extends JsonScalar ? never : undefined
  }
}
export const ifBoolean = <V>(v?: V) => (typeof v === 'boolean' ? v : undefined)
export const ifString = <V>(v?: V) => (typeof v === 'string' ? v : undefined)
export const ifNumber = <V>(v?: V) => (typeof v === 'number' ? v : undefined)
export const ifNull = <V>(v?: V) => (v === null ? v : undefined)
