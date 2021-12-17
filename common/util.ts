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
