export type SubCtx<Parent extends object | void, Child extends object> = Child &
  Omit<Parent, keyof Child>

export function subCtx<Parent extends object | void, Child extends object>(
  parent: Parent,
  child: Child,
): SubCtx<Parent, Child> {
  const proto = typeof parent === 'object' ? parent : null
  const entries = Object.entries(child)

  // Optimization for small objects
  switch (entries.length) {
    case 0:
      return Object.create(proto)
    case 1: {
      const e0 = entries[0]
      return Object.create(proto, {
        [e0[0]]: valueDescriptor(e0[1]),
      })
    }
    case 2: {
      const e0 = entries[0]
      const e1 = entries[1]
      return Object.create(proto, {
        [e0[0]]: valueDescriptor(e0[1]),
        [e1[0]]: valueDescriptor(e1[1]),
      })
    }
  }

  return Object.create(proto, Object.fromEntries(entries.map(entryToEntryDesc)))
}

function entryToEntryDesc(
  entry: [string, unknown],
): [string, PropertyDescriptor] {
  return [entry[0], valueDescriptor(entry[1])]
}

function valueDescriptor(value: unknown): PropertyDescriptor {
  return { value, enumerable: true, writable: false }
}
