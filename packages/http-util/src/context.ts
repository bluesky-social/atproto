export type SubCtx<Parent, Child> = Child & Omit<Parent, keyof Child>

export function subCtx<T, K extends string, V>(
  ctx: T,
  key: K,
  value: V,
): SubCtx<T, { [_ in K]: V }> {
  return Object.create(typeof ctx === 'object' ? ctx : null, {
    [key]: { value, enumerable: true, writable: false },
  })
}
