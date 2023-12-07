import { jsonToLex } from '@atproto/lexicon'
import * as ui8 from 'uint8arrays'

export class HydrationMap<T> extends Map<string, T | null> {
  merge(map: HydrationMap<T>): HydrationMap<T> {
    map.forEach((val, key) => {
      this.set(key, val)
    })
    return this
  }
}

export const parseRecord = <T>(bytes: Uint8Array): T | null => {
  if (bytes.byteLength === 0) return null
  const parsed = JSON.parse(ui8.toString(bytes, 'utf8'))
  return parsed ? (jsonToLex(parsed) as T) : null
}
