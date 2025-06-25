import { readFile } from 'node:fs/promises'
import { Decoder } from '@toondepauw/node-zstd'

export const getDecoder = (() => {
  let promise: Promise<Decoder> | null = null
  return () =>
    (promise ??= readFile(
      new URL('../../dict/zstd_dictionary', import.meta.url),
    ).then((dict) => new Decoder(dict)))
})()
