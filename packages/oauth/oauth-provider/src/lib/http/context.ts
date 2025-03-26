export type SubCtx<Parent, Child extends object> = Child &
  (Parent extends object ? Omit<Parent, keyof Child> : unknown)

export function subCtx<Parent, Child extends object>(
  parent: Parent,
  child: Child,
): SubCtx<Parent, Child> {
  const proto = typeof parent === 'object' ? parent : null
  const entries = Object.entries(child)

  // Optimization for small objects
  switch (entries.length) {
    case 0:
      return proto as SubCtx<Parent, Child>
    case 1: {
      const entry = entries[0]
      return Object.create(proto, {
        [entry[0]]: toPropDesc(entry[1]),
      })
    }
    case 2: {
      const entry0 = entries[0]
      const entry1 = entries[1]
      return Object.create(proto, {
        [entry0[0]]: toPropDesc(entry0[1]),
        [entry1[0]]: toPropDesc(entry1[1]),
      })
    }
  }

  return Object.create(proto, Object.fromEntries(entries.map(entryToEntryDesc)))
}

function entryToEntryDesc(
  entry: [string, unknown],
): [string, PropertyDescriptor] {
  return [entry[0], toPropDesc(entry[1])]
}

function toPropDesc(value: unknown): PropertyDescriptor {
  return { value, enumerable: true, writable: false }
}
