export const isErrnoException = (
  err: unknown,
): err is NodeJS.ErrnoException => {
  return !!err && err['code']
}
