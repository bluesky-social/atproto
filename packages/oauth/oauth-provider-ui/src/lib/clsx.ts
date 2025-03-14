type ClsxArg = string | false | undefined

export function clsx(...args: [ClsxArg, ...ClsxArg[]]): string | undefined {
  const filtered = args.filter(Boolean) as string[]
  return filtered.length > 0 ? filtered.join(' ') : undefined
}
