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

  constructor() {
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
    this.resetPromise()
  }

  async nextEvent(): Promise<T> {
    const [first, ...rest] = this.buffer
    if (first) {
      this.buffer = rest
      return first
    } else {
      await this.promise
      return this.nextEvent()
    }
  }
}
