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
