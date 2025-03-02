export const parseIntArg = (arg: string): number => {
  const parsed = parseInt(arg, 10)
  if (isNaN(parsed)) {
    throw new Error(`Invalid arg, expected number: ${arg}`)
  }
  return parsed
}
