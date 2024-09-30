export const noUndefinedVals = <T>(
  obj: Record<string, T | undefined>,
): Record<string, T> => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) {
      delete obj[k]
    }
  })
  return obj as Record<string, T>
}

/**
 * Creates a copy of the object with the specified keys omitted. If the object
 * is `undefined`, it returns `undefined`. If the object did not have any of the
 * keys to omit, it returns the same object.
 */
export function omit<
  T extends undefined | Record<string, unknown>,
  K extends keyof NonNullable<T>,
>(obj: T, keys: readonly K[]): T extends undefined ? undefined : Omit<T, K>
export function omit(
  obj: Record<string, unknown>,
  keys: readonly string[],
): undefined | Record<string, unknown> {
  // Hot path
  if (obj) {
    const objKeys = Object.keys(obj)
    for (let i = 0; i < objKeys.length; i++) {
      // If the key at position i must be excluded
      if (keys.includes(keys[i])) {
        // Create a copy
        const newObj = {}

        // Copy all the keys already visited (that did not have to be excluded),
        // without re-checking if they need to be excluded.
        for (let j = 0; j < i; j++) {
          const key = objKeys[j]
          newObj[key] = obj[key]
        }

        // Copy all the remaining keys, excluding the ones that need to be
        // excluded.
        for (let j = i + 1; j < objKeys.length; j++) {
          const key = objKeys[j]
          if (!keys.includes(key)) newObj[key] = obj[key]
        }

        return newObj
      }
    }
  }

  return obj
}

export const jitter = (maxMs: number) => {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}

export const wait = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms))
}

export type BailableWait = {
  bail: () => void
  wait: () => Promise<void>
}

export const bailableWait = (ms: number): BailableWait => {
  let bail
  const waitPromise = new Promise<void>((res) => {
    const timeout = setTimeout(res, ms)
    bail = () => {
      clearTimeout(timeout)
      res()
    }
  })
  return { bail, wait: () => waitPromise }
}

export const flattenUint8Arrays = (arrs: Uint8Array[]): Uint8Array => {
  const length = arrs.reduce((acc, cur) => {
    return acc + cur.length
  }, 0)
  const flattened = new Uint8Array(length)
  let offset = 0
  arrs.forEach((arr) => {
    flattened.set(arr, offset)
    offset += arr.length
  })
  return flattened
}

export const streamToBuffer = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const arrays: Uint8Array[] = []
  for await (const chunk of stream) {
    arrays.push(chunk)
  }
  return flattenUint8Arrays(arrays)
}

const S32_CHAR = '234567abcdefghijklmnopqrstuvwxyz'

export const s32encode = (i: number): string => {
  let s = ''
  while (i) {
    const c = i % 32
    i = Math.floor(i / 32)
    s = S32_CHAR.charAt(c) + s
  }
  return s
}

export const s32decode = (s: string): number => {
  let i = 0
  for (const c of s) {
    i = i * 32 + S32_CHAR.indexOf(c)
  }
  return i
}

export const asyncFilter = async <T>(
  arr: T[],
  fn: (t: T) => Promise<boolean>,
) => {
  const results = await Promise.all(arr.map((t) => fn(t)))
  return arr.filter((_, i) => results[i])
}

export const isErrnoException = (
  err: unknown,
): err is NodeJS.ErrnoException => {
  return !!err && err['code']
}

export const errHasMsg = (err: unknown, msg: string): boolean => {
  return !!err && typeof err === 'object' && err['message'] === msg
}

export const chunkArray = <T>(arr: T[], chunkSize: number): T[][] => {
  return arr.reduce((acc, cur, i) => {
    const chunkI = Math.floor(i / chunkSize)
    if (!acc[chunkI]) {
      acc[chunkI] = []
    }
    acc[chunkI].push(cur)
    return acc
  }, [] as T[][])
}

export const range = (num: number): number[] => {
  const nums: number[] = []
  for (let i = 0; i < num; i++) {
    nums.push(i)
  }
  return nums
}

export const dedupeStrs = (strs: string[]): string[] => {
  return [...new Set(strs)]
}

export const parseIntWithFallback = <T>(
  value: string | undefined,
  fallback: T,
): number | T => {
  const parsed = parseInt(value || '', 10)
  return isNaN(parsed) ? fallback : parsed
}
