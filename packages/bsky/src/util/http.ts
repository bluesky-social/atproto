export function isSuccessStatus(status: number) {
  return status >= 200 && status < 300
}
