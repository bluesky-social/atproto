export function clsx(a: string | undefined, b?: string) {
  if (a && b) return `${a} ${b}`
  return a || b
}
