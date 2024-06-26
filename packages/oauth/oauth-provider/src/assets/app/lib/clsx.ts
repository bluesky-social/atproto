export function clsx(
  a?: string,
  ...args: readonly (string | undefined)[]
): string | undefined {
  if (args.length === 0) return a
  const b = clsx(...args)
  if (a && b) return `${a} ${b}`
  return a || b
}
