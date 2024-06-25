const knownSizes = new WeakMap<object, number>()

/**
 * @see {@link https://stackoverflow.com/a/11900218/356537}
 */
export function roughSizeOfObject(value: unknown): number {
  const objectList = new Set()
  const stack = [value] // This would be more efficient using a circular buffer
  let bytes = 0

  while (stack.length) {
    const value = stack.pop()

    // > All objects on the heap start with a shape descriptor, which takes one
    // > pointer size (usually 4 bytes these days, thanks to "pointer
    // > compression" on 64-bit platforms).

    switch (typeof value) {
      // Types are ordered by frequency
      case 'string':
        // https://stackoverflow.com/a/68791382/356537
        bytes += 12 + 4 * Math.ceil(value.length / 4)
        break
      case 'number':
        bytes += 12 // Shape descriptor + double
        break
      case 'boolean':
        bytes += 4 // Shape descriptor
        break
      case 'object':
        bytes += 4 // Shape descriptor

        if (value === null) {
          break
        }

        if (knownSizes.has(value)) {
          bytes += knownSizes.get(value)!
          break
        }

        if (objectList.has(value)) continue
        objectList.add(value)

        if (Array.isArray(value)) {
          bytes += 4
          stack.push(...value)
        } else {
          bytes += 8
          const keys = Object.getOwnPropertyNames(value)
          for (let i = 0; i < keys.length; i++) {
            bytes += 4
            const key = keys[i]
            const val = value[key]
            if (val !== undefined) stack.push(val)
            stack.push(key)
          }
        }
        break
      case 'function':
        bytes += 8 // Shape descriptor + pointer (assuming functions are shared)
        break
      case 'symbol':
        bytes += 8 // Shape descriptor + pointer
        break
      case 'bigint':
        bytes += 16 // Shape descriptor + BigInt
        break
    }
  }

  if (typeof value === 'object' && value !== null) {
    knownSizes.set(value, bytes)
  }

  return bytes
}
