import { type LexUserType, type LexiconDoc } from '@atproto/lexicon'
import { NSID } from '@atproto/syntax'

export interface DefTreeNodeUserType {
  nsid: string
  def: LexUserType
}

export interface DefTreeNode {
  name: string
  className: string
  propName: string
  children: DefTreeNode[]
  userTypes: DefTreeNodeUserType[]
}

export function lexiconsToDefTree(lexicons: LexiconDoc[]): DefTreeNode[] {
  const tree: DefTreeNode[] = []
  for (const lexicon of lexicons) {
    if (!lexicon.defs.main) {
      continue
    }
    const node = getOrCreateNode(tree, lexicon.id.split('.').slice(0, -1))
    node.userTypes.push({ nsid: lexicon.id, def: lexicon.defs.main })
  }
  return tree
}

function getOrCreateNode(tree: DefTreeNode[], path: string[]): DefTreeNode {
  let node: DefTreeNode | undefined
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]
    node = tree.find((v) => v.name === segment)
    if (!node) {
      node = {
        name: segment,
        className: `${toTitleCase(path.slice(0, i + 1).join('-'))}NS`,
        propName: toCamelCase(segment),
        children: [],
        userTypes: [],
      } as DefTreeNode
      tree.push(node)
    }
    tree = node.children
  }
  if (!node) throw new Error(`Invalid schema path: ${path.join('.')}`)
  return node
}

export function schemasToNsidTokens(
  lexiconDocs: LexiconDoc[],
): Record<string, string[]> {
  const nsidTokens: Record<string, string[]> = {}
  for (const lexiconDoc of lexiconDocs) {
    const nsidp = NSID.parse(lexiconDoc.id)
    if (!nsidp.name) continue
    for (const defId in lexiconDoc.defs) {
      const def = lexiconDoc.defs[defId]
      if (def.type !== 'token') continue
      const authority = nsidp.segments.slice(0, -1).join('.')
      nsidTokens[authority] ??= []
      nsidTokens[authority].push(
        nsidp.name + (defId === 'main' ? '' : `#${defId}`),
      )
    }
  }
  return nsidTokens
}

export function toTitleCase(v: string): string {
  v = v.replace(/^([a-z])/gi, (_, g) => g.toUpperCase()) // upper-case first letter
  v = v.replace(/[.#-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash, dot, or hash segments
  return v.replace(/[.-]/g, '') // remove lefover dashes or dots
}

export function toCamelCase(v: string): string {
  v = v.replace(/[.#-]([a-z])/gi, (_, g) => g.toUpperCase()) // uppercase any dash, dot, or hash segments
  return v.replace(/[.-]/g, '') // remove lefover dashes or dots
}

export function toScreamingSnakeCase(v: string): string {
  v = v.replace(/[.#-]+/gi, '_') // convert dashes, dots, and hashes into underscores
  return v.toUpperCase() // and scream!
}
