export const keyBy = <T>(arr: T[], key: string): Record<string, T> => {
  return arr.reduce(
    (acc, cur) => {
      acc[cur[key]] = cur
      return acc
    },
    {} as Record<string, T>,
  )
}

export const mapDefined = <T, S>(
  arr: T[],
  fn: (obj: T) => S | undefined,
): S[] => {
  const output: S[] = []
  for (const item of arr) {
    const val = fn(item)
    if (val !== undefined) {
      output.push(val)
    }
  }
  return output
}
