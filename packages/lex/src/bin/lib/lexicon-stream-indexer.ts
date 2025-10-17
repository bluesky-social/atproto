import EventEmitter, { on } from 'node:events'
import { Readable } from 'node:stream'
import { LexiconDoc, LexiconIndexer } from '../../doc/index.js'

/**
 * (Lazily) indexes lexicon documents from an iterable source.
 */
export class LexiconStreamIndexer
  extends EventEmitter<{
    add: [LexiconDoc]
    end: []
    error: [Error]
  }>
  implements LexiconIndexer
{
  readonly #lexicons: Map<string, LexiconDoc> = new Map()
  readonly #stream: Readable

  constructor(
    readonly source: AsyncIterable<LexiconDoc> | Iterable<LexiconDoc>,
  ) {
    super()
    this.#stream =
      source instanceof Readable
        ? source
        : Readable.from(source, { objectMode: true })
    this.#stream.pause()
    this.#stream.on('data', (doc: LexiconDoc) => {
      if (this.#lexicons.has(doc.id)) {
        this.#stream.destroy(
          new Error(`Duplicate lexicon document ID encountered: ${doc.id}`),
        )
        return
      }

      this.#lexicons.set(doc.id, doc)
      this.emit('add', doc)
    })
    this.#stream.on('end', () => {
      this.emit('end')
    })
    this.#stream.on('error', (err) => {
      this.emit('error', err)
    })
    this.#stream.pause()
  }

  get ended() {
    return this.#stream.readableEnded
  }

  resume() {
    if (this.#tailingCount++ >= 0) {
      this.#stream.resume()
    }
  }

  pause() {
    if (--this.#tailingCount <= 0) {
      this.#stream.pause()
    }
  }

  #tailingCount = 0
  async *tail(): AsyncGenerator<LexiconDoc> {
    if (this.ended) return

    // We could use the following here, but we want to pause the input stream
    // whenever yielding control back to the caller.

    // yield* on(this, 'add', { close: ['end'] })

    const it = on(this, 'add', { close: ['end'] })
    try {
      while (!this.ended) {
        this.resume()
        const next = await it.next().finally(() => this.pause())
        if (next.done) break
        yield next.value[0] as LexiconDoc
      }
    } finally {
      it.return?.()
    }
  }

  async get(id: string): Promise<LexiconDoc> {
    const cached = this.#lexicons.get(id)
    if (cached) return cached

    this.resume()
    try {
      for await (const doc of this.tail()) {
        if (doc.id === id) return doc
      }
    } finally {
      this.pause()
    }

    throw new Error(`Lexicon ${id} not found`)
  }

  async *[Symbol.asyncIterator](): AsyncIterator<LexiconDoc, void, undefined> {
    const returned = new Set<string>()

    for (const doc of this.#lexicons.values()) {
      returned.add(doc.id)
      yield doc
    }

    for await (const doc of this.tail()) {
      if (!returned.has(doc.id)) {
        returned.add(doc.id)
        yield doc
      }
    }
  }
}
