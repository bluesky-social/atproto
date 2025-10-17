import { LexiconDoc } from './lexicon-document.js'

export interface LexiconIndexer {
  get(nsid: string): Promise<LexiconDoc>

  [Symbol.asyncIterator]?: () => AsyncIterator<LexiconDoc, void, unknown>
  [Symbol.asyncDispose]?: () => Promise<void>
}
