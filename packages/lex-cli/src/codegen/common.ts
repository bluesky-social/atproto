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

function isObject<V>(v: V): v is V & object {
  return v != null && typeof v === 'object'
}

function check$type<Id extends string, Hash extends string>(
  $type: unknown,
  id: Id,
  hash: Hash,
): $type is $Type<Id, Hash> {
  return $type === id
    ? hash === 'main'
    : // $type === \`\${id}#\${hash}\`
      typeof $type === 'string' &&
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
  $type: $Type<Id, Hash>
}
  ? V
  : V extends { $type?: string }
    ? V extends { $type?: $Type<Id, Hash> }
      ? $Typed<V>
      : never
    : V & { $type: $Type<Id, Hash> }

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is Is$Typed<V, Id, Hash> {
  return isObject(v) && '$type' in v && check$type(v.$type, id, hash)
}

export function maybe$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is V & object & { $type?: $Type<Id, Hash> } {
  return (
    isObject(v) &&
    ('$type' in v
      ? v.$type === undefined || check$type(v.$type, id, hash)
      : true)
  )
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
      .addNamedImports([
        { name: 'LexiconDoc' },
        { name: 'Lexicons' },
        { name: 'ValidationError' },
        { name: 'ValidationResult' },
      ])

    //= import {is$typed, maybe$typed, $Typed} from './util'
    file
      .addImportDeclaration({
        moduleSpecifier: './util',
      })
      .addNamedImports([
        { name: '$Typed' },
        { name: 'is$typed' },
        { name: 'maybe$typed' },
      ])

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

    file.addFunction({
      isExported: true,
      name: 'validate',
      typeParameters: ['V'],
      parameters: [
        { name: 'v', type: 'unknown' },
        { name: 'id', type: 'string' },
        { name: 'hash', type: 'string' },
      ],
      statements: [
        // If $type is present, make sure it is valid before validating the rest of the object
        'return (maybe$typed(v, id, hash) ? lexicons.validate(`${id}#${hash}`, v) : { success: false, error: new ValidationError(`Must be an object with "${id}#${hash}" $type property`) }) as ValidationResult<V>',
      ],
    })

    file.addFunction({
      isExported: true,
      name: 'isValid',
      overloads: [
        {
          typeParameters: ['V extends { $type?: string }'],
          parameters: [
            { name: 'v', type: 'unknown' },
            { name: 'id', type: 'string' },
            { name: 'hash', type: 'string' },
            { name: 'requiredType', type: 'true' },
          ],
          returnType: 'v is $Typed<V>',
        },
        {
          typeParameters: ['V extends { $type?: string }'],
          parameters: [
            { name: 'v', type: 'unknown' },
            { name: 'id', type: 'string' },
            { name: 'hash', type: 'string' },
            { name: 'requiredType', type: 'boolean', hasQuestionToken: true },
          ],
          returnType: 'v is V',
        },
      ],
      parameters: [
        { name: 'v', type: 'unknown' },
        { name: 'id', type: 'string' },
        { name: 'hash', type: 'string' },
        { name: 'requiredType', type: 'boolean', hasQuestionToken: true },
      ],
      statements: [
        'return ((requiredType ? is$typed : maybe$typed)(v, id, hash) && validate(v, id, hash).success)',
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
