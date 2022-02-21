export const wait = (ms: number) => {
  return new Promise((res) => setTimeout(res, ms))
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

export const streamToArray = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const arrays = []
  for await (const chunk of stream) {
    arrays.push(chunk)
  }
  return flattenUint8Arrays(arrays)
}
