type NonReadonly<T> = { -readonly [K in keyof T]: T[K] }

export type WithDefaults<
  TOptions extends Record<string, unknown>,
  TDefaults extends Record<string, unknown>[],
> = TDefaults extends [infer First, ...infer Rest extends any[]]
  ? TOptions & WithDefaults<NonReadonly<First>, Rest>
  : TOptions

export function applyDefaults<
  TOptions extends Readonly<Record<string, unknown>>,
  TDefaults extends Readonly<Record<string, unknown>>[],
>(
  options: TOptions,
  ...defaults: TDefaults
): WithDefaults<TOptions, TDefaults> {
  const combined: Record<string, unknown> = { ...options }

  // @NOTE We make sure that options with an explicit `undefined` value get the
  // default, since spreading doesn't override with `undefined`. When multiple
  // defaults define the same key, the first defined value wins.
  for (const def of defaults) {
    for (const key of Object.keys(def) as (keyof typeof def)[]) {
      if (combined[key] === undefined) {
        combined[key] = def[key]
      }
    }
  }

  return combined as WithDefaults<TOptions, TDefaults>
}
