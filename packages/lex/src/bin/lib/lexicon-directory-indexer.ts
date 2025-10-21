import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  LexiconDocument,
  LexiconIterableIndexer,
  lexiconDocumentSchema,
} from '../../doc/index.js'

export type LexiconDirectoryIndexerOptions = ReadLexiconsOptions

export class LexiconDirectoryIndexer extends LexiconIterableIndexer {
  constructor(options: LexiconDirectoryIndexerOptions) {
    super(readLexicons(options))
  }
}

type ReadLexiconsOptions = {
  in: string
  ignoreErrors?: boolean
}

async function* readLexicons(
  options: ReadLexiconsOptions,
): AsyncGenerator<LexiconDocument, void, unknown> {
  for await (const filePath of listFiles(options.in)) {
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
