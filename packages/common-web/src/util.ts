export const noUndefinedVals = <T>(
  obj: Record<string, T>,
): Record<string, T> => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === undefined) {
      delete obj[k]
    }
  })
  return obj
}

export const wait = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms))
}

export const bailableWait = (
  ms: number,
): { bail: () => void; wait: () => Promise<void> } => {
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
