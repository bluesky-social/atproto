export type Defferable = {
  resolve: () => void
  complete: Promise<void>
}

export const createDeferrable = (): Defferable => {
  let resolve
  const promise: Promise<void> = new Promise((res) => {
    resolve = () => res()
  })
  return { resolve, complete: promise }
}

export const createDeferrables = (count: number): Defferable[] => {
  const list: Defferable[] = []
  for (let i = 0; i < count; i++) {
    list.push(createDeferrable())
  }
  return list
}

export const allComplete = async (defferables: Defferable[]): Promise<void> => {
  await Promise.all(defferables.map((d) => d.complete))
}
