import { bailableWait } from './util'

// reads values from a generator into a list
// NOTE: does not signal generator to close. it *will* continue to produce values
export const readFromGenerator = async <T>(
  gen: AsyncGenerator<T>,
  maxLength = Number.MAX_SAFE_INTEGER,
  timeout = 2000,
): Promise<T[]> => {
  const evts: T[] = []
  while (evts.length < maxLength) {
    const { bail, wait } = bailableWait(timeout)
    const maybeEvt = await Promise.race([gen.next(), wait()])
    bail()
    if (!maybeEvt) break
    const evt = maybeEvt as IteratorResult<T>
    if (evt.done) break
    evts.push(evt.value)
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
