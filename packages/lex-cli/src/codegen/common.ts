import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { LexiconDoc } from '@atproto/lexicon'
import prettier from 'prettier'
import { GeneratedFile } from '../types'

const PRETTIER_OPTS = {
  parser: 'typescript',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'all' as const,
}

export const utilTs = (project) =>
  gen(project, '/util.ts', async (file) => {
    file.replaceWithText(`
export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}

export type $Typed<V> = V & { $type: string }

export type $Type<Id extends string, Hash extends string> = Hash extends 'main'
  ? Id | \`\${Id}#\${Hash}\`
  : \`\${Id}#\${Hash}\`

function has$type<V>(v: V): v is $Typed<V & object> {
  return (
    v != null &&
    typeof v === 'object' &&
    '$type' in v &&
    typeof v.$type === 'string'
  )
}

function check$type<Id extends string, Hash extends string>(
  $type: string,
  id: Id,
  hash: Hash,
): $type is $Type<Id, Hash> {
  return $type === id
    ? hash === 'main'
    : // $type === \`\${id}#\${hash}\`
      $type.length === id.length + 1 + hash.length &&
        $type.charCodeAt(id.length) === 35 /* '#' */ &&
        $type.startsWith(id) &&
        $type.endsWith(hash)
}
${
  /**
   * The construct below allows to properly distinguish open unions. Consider
   * the following example:
   *
   * ```ts
   * type Foo = { $type?: $Type<'foo', 'main'>; foo: string }
   * type Bar = { $type?: $Type<'bar', 'main'>; bar: string }
   * type OpenFooBarUnion = $Typed<Foo> | $Typed<Bar> | { $type: string }
   * ```
   *
   * In the context of lexicons, when there is a open union as shown above, the
   * if `$type` if either `foo` or `bar`, then the object IS of type `Foo` or
   * `Bar`.
   *
   * ```ts
   * declare const obj1: OpenFooBarUnion
   * if (is$typed(obj1, 'foo', 'main')) {
   *   obj1.$type // "foo" | "foo#main"
   *   obj1.foo // string
   * }
   * ```
   *
   * Similarly, if an object is of type `unknown`, then the `is$typed` function
   * should only return assurance about the `$type` property, which is what it
   * actually checks:
   *
   * ```ts
   * declare const obj2: unknown
   * if (is$typed(obj2, 'foo', 'main')) {
   *  obj2.$type // "foo" | "foo#main"
   *  // @ts-expect-error
   *  obj2.foo
   * }
   * ```
   *
   * The construct bellow is what makes these two scenarios possible.
   */
  ''
}
export type Is$Typed<V, Id extends string, Hash extends string> = V extends {
  $type?: string
}
  ? Extract<V, { $type: $Type<Id, Hash> }>
  : V & { $type: $Type<Id, Hash> }

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is Is$Typed<V, Id, Hash> {
  return has$type(v) && check$type(v.$type, id, hash)
}
`)
  })

export const lexiconsTs = (project, lexicons: LexiconDoc[]) =>
  gen(project, '/lexicons.ts', async (file) => {
    const nsidToEnum = (nsid: string): string => {
      return nsid
        .split('.')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join('')
    }

    //= import {LexiconDoc} from '@atproto/lexicon'
    file
      .addImportDeclaration({
        moduleSpecifier: '@atproto/lexicon',
      })
      .addNamedImports([{ name: 'LexiconDoc' }, { name: 'Lexicons' }])

    //= export const schemaDict = {...} as const satisfies Record<string, LexiconDoc>
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemaDict',
          initializer:
            JSON.stringify(
              lexicons.reduce(
                (acc, cur) => ({
                  ...acc,
                  [nsidToEnum(cur.id)]: cur,
                }),
                {},
              ),
              null,
              2,
            ) + ' as const satisfies Record<string, LexiconDoc>',
        },
      ],
    })

    //= export const schemas = Object.values(schemaDict)
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemas',
          initializer: 'Object.values(schemaDict)',
        },
      ],
    })

    //= export const lexicons: Lexicons = new Lexicons(schemas)
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'lexicons',
          type: 'Lexicons',
          initializer: 'new Lexicons(schemas)',
        },
      ],
    })

    //= export const ids = {...}
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'ids',
          initializer: `{${lexicons
            .map(
              (lex) => `\n  ${nsidToEnum(lex.id)}: ${JSON.stringify(lex.id)},`,
            )
            .join('')}\n} as const`,
        },
      ],
    })
  })

export async function gen(
  project: Project,
  path: string,
  gen: (file: SourceFile) => Promise<void>,
): Promise<GeneratedFile> {
  const file = project.createSourceFile(path)
  await gen(file)
  file.saveSync()
  const src = project.getFileSystem().readFileSync(path)
  return {
    path: path,
    content: `${banner()}${await prettier.format(src, PRETTIER_OPTS)}`,
  }
}

function banner() {
  return `/**
 * GENERATED CODE - DO NOT MODIFY
 */
`
}
