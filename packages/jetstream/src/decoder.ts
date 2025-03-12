import { Decoder } from '@toondepauw/node-zstd'
import { readFile } from 'node:fs/promises'

export const getDecoder = (() => {
  let promise: Promise<Decoder> | null = null
  return () =>
    (promise ??= readFile(
      new URL(import.meta.resolve('../dict/zstd_dictionary')),
    ).then((dict) => new Decoder(dict)))
})()
