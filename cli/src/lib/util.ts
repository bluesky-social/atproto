export const formatDate = (isoStr: string): string => {
  const date = new Date(isoStr)
  return date.toLocaleString('en-us')
}
