export type Schema = {
  prevCurrentAccountDid: string | null
}

export function set<T extends keyof Schema>(key: T, value: Schema[T]) {
  localStorage.setItem(key, JSON.stringify({ data: value }))
}

export function get<T extends keyof Schema>(key: T): Schema[T] | null {
  const item = localStorage.getItem(key)
  if (!item) {
    return null
  }
  return JSON.parse(item).data
}

export function remove<T extends keyof Schema>(key: T) {
  localStorage.removeItem(key)
}
