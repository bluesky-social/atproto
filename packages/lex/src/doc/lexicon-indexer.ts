import { LexiconDoc } from './lexicon-document.js'

export interface LexiconIndexer
  extends Partial<AsyncIterable<LexiconDoc>>,
    Partial<Iterable<LexiconDoc>> {
  get(nsid: string): Promise<LexiconDoc>
}
