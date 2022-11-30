import { SourceFile, VariableDeclarationKind } from 'ts-morph'
import {
  Lexicons,
  LexUserType,
  LexObject,
  LexArray,
  LexToken,
} from '@atproto/lexicon'
import { toTitleCase, toScreamingSnakeCase } from './util'

export function genUserType(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
) {
  const def = lexicons.getDefOrThrow(lexUri)
  switch (def.type) {
    case 'array':
      genArray(file, lexicons, lexUri, def)
      break
    case 'token':
      genToken(file, lexicons, lexUri, def)
      break
    case 'object':
      genObject(file, lexicons, lexUri, def)
      break

    case 'blob':
    case 'image':
    case 'video':
    case 'audio':
    case 'boolean':
    case 'number':
    case 'integer':
    case 'string':
    case 'unknown':
      genPrimitiveOrBlob(file, lexicons, lexUri, def)
      break

    default:
      throw new Error(
        `genLexUserType() called with wrong definition type (${def.type}) in ${lexUri}`,
      )
  }
}

export function genObject(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
  def: LexObject,
  ifaceName?: string,
) {
  const iface = file.addInterface({
    name: ifaceName || toTitleCase(getHash(lexUri)),
    isExported: true,
  })
  if (def.properties) {
    for (const propKey in def.properties) {
      const req = def.required?.includes(propKey)
      const propDef = def.properties[propKey]
      if (typeof propDef === 'string' || Array.isArray(propDef)) {
        //= propName: External|External
        const refs = Array.isArray(propDef) ? propDef : [propDef]
        iface.addProperty({
          name: `${propKey}${req ? '' : '?'}`,
          type: refs
            .map((ref) => refToType(ref, stripScheme(stripHash(lexUri))))
            .join('|'),
        })
        continue
      } else if (propDef && typeof propDef === 'object') {
        if (propDef.type === 'array') {
          //= propName: type[]
          if (typeof propDef.items === 'string') {
            iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `${refToType(
                propDef.items,
                stripScheme(stripHash(lexUri)),
              )}[]`,
            })
          } else if (Array.isArray(propDef.items)) {
            const types = propDef.items.map((item) =>
              refToType(item, stripScheme(stripHash(lexUri))),
            )
            iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `(${types.join('|')})[]`,
            })
          } else if (typeof propDef.items === 'object') {
            iface.addProperty({
              name: `${propKey}${req ? '' : '?'}`,
              type: `${primitiveOrBlobToType(propDef.items.type)}[]`,
            })
          } else {
            throw new Error(
              `Unexpected items definition in ${lexUri}: ${typeof propDef.items}`,
            )
          }
        } else {
          //= propName: type
          iface.addProperty({
            name: `${propKey}${req ? '' : '?'}`,
            type: primitiveOrBlobToType(propDef.type),
          })
        }
      } else {
        throw new Error(
          `Unexpected property definition in ${lexUri}: ${typeof propDef}`,
        )
      }
    }
    //= [k: string]: unknown
    iface.addIndexSignature({
      keyName: 'k',
      keyType: 'string',
      returnType: 'unknown',
    })
  }
}

export function genToken(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
  def: LexToken,
) {
  file.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: toScreamingSnakeCase(getHash(lexUri)),
        initializer: `"${stripScheme(lexUri)}"`,
      },
    ],
  })
}

export function genArray(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
  def: LexArray,
) {
  if (typeof def.items === 'string') {
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `${refToType(def.items, stripScheme(stripHash(lexUri)))}[]`,
      isExported: true,
    })
  } else if (Array.isArray(def.items)) {
    const types = def.items.map((item) =>
      refToType(item, stripScheme(stripHash(lexUri))),
    )
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `(${types.join('|')})[]`,
      isExported: true,
    })
  } else if (typeof def.items === 'object') {
    file.addTypeAlias({
      name: toTitleCase(getHash(lexUri)),
      type: `${primitiveOrBlobToType(def.items.type)}[]`,
      isExported: true,
    })
  } else {
    throw new Error(
      `Unexpected items definition in ${lexUri}: ${typeof def.items}`,
    )
  }
}

export function genPrimitiveOrBlob(
  file: SourceFile,
  lexicons: Lexicons,
  lexUri: string,
  def: LexUserType,
) {
  file.addTypeAlias({
    name: toTitleCase(getHash(lexUri)),
    type: primitiveOrBlobToType(def.type),
    isExported: true,
  })
}

export function stripScheme(uri: string): string {
  if (uri.startsWith('lex:')) return uri.slice(4)
  return uri
}

export function stripHash(uri: string): string {
  return uri.split('#')[0] || ''
}

export function getHash(uri: string): string {
  return uri.split('#').pop() || ''
}

export function refToType(ref: string, baseNsid: string): string {
  // TODO: import external types!
  let [refBase, refHash] = ref.split('#')
  refBase = stripScheme(refBase)
  if (!refHash) refHash = 'main'
  if (!refBase || baseNsid === refBase) return toTitleCase(refHash)
  return `${toTitleCase(refBase)}.${toTitleCase(refHash)}`
}

export function primitiveOrBlobToType(type: string): string {
  switch (type) {
    case 'blob':
    case 'image':
    case 'video':
    case 'audio':
      return `{cid: string; mimeType: string; [k: string]: unknown}`
    default:
      return primitiveToType(type)
  }
}

export function primitiveToType(type: string): string {
  switch (type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'unknown':
      return '{}'
    default:
      throw new Error(`Unexpected primitive type: ${type}`)
  }
}
