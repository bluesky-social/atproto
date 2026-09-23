export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Partial<Pick<T, K>>
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result as Pick<T, K>
}
