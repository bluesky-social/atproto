export function readBackendData<T>(key: string): T {
  const value = window[key] as T | undefined
  delete window[key] // Prevent accidental usage / potential leaks to dependencies
  if (value !== undefined) return value
  throw new TypeError(`Backend data "${key}" is missing`)
}
