export function mergeDefaults<T extends object>(
  defaults: T,
  ...overrides: (T | undefined)[]
): T {
  // @NOTE Not using the spread operator here because TS allows "undefined"
  // values to be spread, which can lead to defaults being overwritten with
  // "undefined". This function ensures that only defined values in "options"
  // will overwrite the corresponding values in "defaults".
  if (!overrides.length) return defaults
  if (!overrides.some(Boolean)) return defaults
  const result: T = { ...defaults } as T
  for (const options of overrides) {
    if (options) {
      for (const key in options) {
        const value = options[key]
        if (value !== undefined) {
          result[key] = value
        }
      }
    }
  }
  return result
}
