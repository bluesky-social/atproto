import { bailableWait } from './util'

// reads values from a generator into a list
// breaks when isDone signals `true` AND `waitFor` completes OR when a max length is reached
// NOTE: does not signal generator to close. it *will* continue to produce values
export const readFromGenerator = async <T>(
  gen: AsyncGenerator<T>,
  isDone: (last?: T) => Promise<boolean> | boolean,
  waitFor: Promise<unknown> = Promise.resolve(),
  maxLength = Number.MAX_SAFE_INTEGER,
): Promise<T[]> => {
  const evts: T[] = []
  let bail: undefined | (() => void)
  let hasBroke = false
  const awaitDone = async () => {
    if (await isDone(evts.at(-1))) {
      return true
    }
    const bailable = bailableWait(20)
    await bailable.wait()
    bail = bailable.bail
    if (hasBroke) return false
    return await awaitDone()
  }
  const breakOn: Promise<void> = new Promise((resolve) => {
    waitFor.then(() => {
      awaitDone().then(() => resolve())
    })
  })

  try {
    while (evts.length < maxLength) {
      const maybeEvt = await Promise.race([gen.next(), breakOn])
      if (!maybeEvt) break
      const evt = maybeEvt as IteratorResult<T>
      if (evt.done) break
      evts.push(evt.value)
    }
  } finally {
    hasBroke = true
    bail && bail()
  }
  return evts
}

export type Deferrable = {
  resolve: () => void
  complete: Promise<void>
}

export const createDeferrable = (): Deferrable => {
  let resolve
  const promise: Promise<void> = new Promise((res) => {
    resolve = () => res()
  })
  return { resolve, complete: promise }
}

export const createDeferrables = (count: number): Deferrable[] => {
  const list: Deferrable[] = []
  for (let i = 0; i < count; i++) {
    list.push(createDeferrable())
  }
  return list
}

export const allComplete = async (deferrables: Deferrable[]): Promise<void> => {
  await Promise.all(deferrables.map((d) => d.complete))
}

export class AsyncBuffer<T> {
  private buffer: T[] = []
  private promise: Promise<void>
  private resolve: () => void

  constructor(public maxSize?: number) {
    // Initializing to satisfy types/build, immediately reset by resetPromise()
    this.promise = Promise.resolve()
    this.resolve = () => null
    this.resetPromise()
  }

  get curr(): T[] {
    return this.buffer
  }

  get size(): number {
    return this.buffer.length
  }

  resetPromise() {
    this.promise = new Promise<void>((r) => (this.resolve = r))
  }

  push(item: T) {
    this.buffer.push(item)
    this.resolve()
  }

  pushMany(items: T[]) {
    items.forEach((i) => this.buffer.push(i))
    this.resolve()
  }

  async *events(): AsyncGenerator<T> {
    while (true) {
      await this.promise
      if (this.maxSize && this.size > this.maxSize) {
        throw new AsyncBufferFullError(this.maxSize)
      }
      const [first, ...rest] = this.buffer
      if (first) {
        this.buffer = rest
        yield first
      } else {
        this.resetPromise()
      }
    }
  }
}

export class AsyncBufferFullError extends Error {
  constructor(maxSize: number) {
    super(`ReachedMaxBufferSize: ${maxSize}`)
  }
}
