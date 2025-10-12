export class Coalescer {
  private pending: Map<string, Promise<void>> = new Map()
  private resolvers: Map<string, Array<() => void>> = new Map()

  async run(name: string, fn: () => Promise<unknown>): Promise<void> {
    if (this.pending.has(name)) {
      return new Promise<void>((resolve) => {
        const resolverList = this.resolvers.get(name) || []
        resolverList.push(resolve)
        this.resolvers.set(name, resolverList)
      })
    }

    const promise = fn()
      .then(() => undefined)
      .finally(() => {
        this.pending.delete(name)
        const resolverList = this.resolvers.get(name) || []
        this.resolvers.delete(name)
        resolverList.forEach((resolve) => resolve())
      })

    this.pending.set(name, promise)
    return promise
  }
}
