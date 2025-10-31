import { LexiconDocument } from './lexicon-document.js'

export interface LexiconIndexer {
  get(nsid: string): Promise<LexiconDocument>

  [Symbol.asyncDispose]?: () => Promise<void>
  [Symbol.asyncIterator]?: () => AsyncIterator<LexiconDocument, void, unknown>
}
