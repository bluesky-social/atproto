import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  LexiconDocument,
  LexiconIterableIndexer,
  lexiconDocumentSchema,
} from '@atproto/lex-document'

export type LexiconDirectoryIndexerOptions = ReadLexiconsOptions

export class LexiconDirectoryIndexer extends LexiconIterableIndexer {
  constructor(options: LexiconDirectoryIndexerOptions) {
    super(readLexicons(options))
  }
}

type ReadLexiconsOptions = {
  lexicons: string | string[]
  ignoreErrors?: boolean
}

async function* readLexicons(
  options: ReadLexiconsOptions,
): AsyncGenerator<LexiconDocument, void, unknown> {
  const dirs = Array.isArray(options.lexicons)
    ? options.lexicons
    : [options.lexicons]
  for (const dir of dirs) {
    for await (const filePath of listFiles(dir)) {
      if (filePath.endsWith('.json')) {
        try {
          const data = await readFile(filePath, 'utf8')
          yield lexiconDocumentSchema.$parse(JSON.parse(data))
        } catch (cause) {
          const message = `Error parsing lexicon document ${filePath}`
          if (options.ignoreErrors) console.error(`${message}:`, cause)
          else throw new Error(message, { cause })
        }
      }
    }
  }
}

async function* listFiles(dir: string): AsyncGenerator<string> {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* listFiles(res)
    } else if (dirent.isFile() || dirent.isSymbolicLink()) {
      yield res
    }
  }
}
