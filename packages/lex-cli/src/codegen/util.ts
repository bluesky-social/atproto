import { Schema } from '@atproto/lexicon'

export interface NsidNS {
  name: string
  className: string
  propName: string
  children: NsidNS[]
  schemas: Schema[]
}

export function schemasToNsidTree(schemas: Schema[]): NsidNS[] {
  const tree: NsidNS[] = []
  for (const schema of schemas) {
    const node = getOrCreateNode(tree, schema.id.split('.').slice(0, -1))
    node.schemas.push(schema)
  }
  return tree
}

function getOrCreateNode(tree: NsidNS[], path: string[]): NsidNS {
  let node: NsidNS | undefined
  for (const segment of path) {
    node = tree.find((v) => v.name === segment)
    if (!node) {
      node = {
        name: segment,
        className: `${toTitleCase(segment)}NS`,
        propName: toCamelCase(segment),
        children: [],
        schemas: [],
      } as NsidNS
      tree.push(node)
    }
    tree = node.children
  }
  if (!node) throw new Error(`Invalid schema path: ${path.join('.')}`)
  return node
}

export function toTitleCase(v: string): string {
  v = v.replace(/^([a-z])/gi, (_, g) => g.toUpperCase()) // upper-case first letter
  v = v.replace(/[\.-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash or dot segments
  return v.replace(/[\.-]/g, '') // remove lefover dashes or dots
}

export function toCamelCase(v: string): string {
  v = v.replace(/[\.-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash or dot segments
  return v.replace(/[\.-]/g, '') // remove lefover dashes or dots
}
