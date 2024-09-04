/**
 * Add items to a list, and mark those items as
 * completed. Upon item completion, get list of consecutive
 * items completed at the head of the list. Example:
 *
 * const consecutive = new ConsecutiveList<number>()
 * const item1 = consecutive.push(1)
 * const item2 = consecutive.push(2)
 * const item3 = consecutive.push(3)
 * item2.complete() // []
 * item1.complete() // [1, 2]
 * item3.complete() // [3]
 *
 */
export class ConsecutiveList<T> {
  list: ConsecutiveItem<T>[] = []

  push(value: T) {
    const item = new ConsecutiveItem<T>(this, value)
    this.list.push(item)
    return item
  }

  complete(): T[] {
    let i = 0
    while (this.list[i]?.isComplete) {
      i += 1
    }
    return this.list.splice(0, i).map((item) => item.value)
  }
}

export class ConsecutiveItem<T> {
  isComplete = false
  constructor(
    private consecutive: ConsecutiveList<T>,
    public value: T,
  ) {}

  complete() {
    this.isComplete = true
    return this.consecutive.complete()
  }
}
