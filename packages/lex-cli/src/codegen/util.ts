import { Schema } from '@atproto/lexicon'
import { NSID } from '@atproto/nsid'

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
    if (schema.type === 'token') continue
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

export function schemasToNsidTokens(
  schemas: Schema[],
): Record<string, string[]> {
  const nsidTokens: Record<string, string[]> = {}
  for (const schema of schemas) {
    if (schema.type !== 'token') {
      continue
    }
    const nsidp = NSID.parse(schema.id)
    if (!nsidp.name) continue
    const authority = nsidp.segments.slice(0, -1).join('.')
    nsidTokens[authority] ??= []
    nsidTokens[authority].push(nsidp.name)
  }
  return nsidTokens
}

export function toTitleCase(v: string): string {
  v = v.replace(/^([a-z])/gi, (_, g) => g.toUpperCase()) // upper-case first letter
  v = v.replace(/[.-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash or dot segments
  return v.replace(/[.-]/g, '') // remove lefover dashes or dots
}

export function toCamelCase(v: string): string {
  v = v.replace(/[.-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash or dot segments
  return v.replace(/[.-]/g, '') // remove lefover dashes or dots
}

export function toScreamingSnakeCase(v: string): string {
  v = v.replace(/[.-]+/gi, '_') // convert dashes and dots into underscores
  return v.toUpperCase() // and scream!
}
