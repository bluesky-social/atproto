import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { LexiconDoc, lexiconDoc } from '../../doc/index.js'
import { LexiconStreamIndexer } from './lexicon-stream-indexer.js'

export type LexiconDirectoryIndexerOptions = {
  in: string
  ignoreErrors?: boolean
}

export class LexiconDirectoryIndexer extends LexiconStreamIndexer {
  constructor(options: LexiconDirectoryIndexerOptions) {
    super(readLexicons(options))
  }
}

async function* readLexicons(
  options: LexiconDirectoryIndexerOptions,
): AsyncGenerator<LexiconDoc, void, unknown> {
  for await (const filePath of listFiles(options.in)) {
    if (filePath.endsWith('.json')) {
      try {
        const data = await readFile(filePath, 'utf8')
        yield lexiconDoc.$parse(JSON.parse(data))
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
