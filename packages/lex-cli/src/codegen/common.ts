import { type Options as PrettierOptions, format } from 'prettier'
import {
  type ClassDeclarationStructure,
  type ExportDeclarationStructure,
  type FunctionDeclarationStructure,
  type ImportDeclarationStructure,
  type InterfaceDeclarationStructure,
  type OptionalKind,
  type Project,
  type SourceFile,
  type StatementStructures,
  StructureKind,
  type TypeAliasDeclarationStructure,
  VariableDeclarationKind,
  type VariableStatementStructure,
} from 'ts-morph'
import type { LexiconDoc } from '@atproto/lexicon'
import type { GeneratedFile } from '../types.js'
import { toTitleCase } from './util.js'

const PRETTIER_OPTS: PrettierOptions = {
  parser: 'typescript',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
}

export const utilTs = () =>
  formatFile(
    '/util.ts',
    `
import { type ValidationResult } from '@atproto/lexicon'

export type OmitKey<T, K extends keyof T> = {
  [K2 in keyof T as K2 extends K ? never : K2]: T[K2]
}

export type $Typed<V, T extends string = string> = V & { $type: T }
export type Un$Typed<V extends { $type?: string }> = OmitKey<V, '$type'>

export type $Type<Id extends string, Hash extends string> = Hash extends 'main'
  ? Id
  : \`\${Id}#\${Hash}\`

function isObject<V>(v: V): v is V & object {
  return v != null && typeof v === 'object'
}

function is$type<Id extends string, Hash extends string>(
  $type: unknown,
  id: Id,
  hash: Hash,
): $type is $Type<Id, Hash> {
  return hash === 'main'
    ? $type === id
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
   *   obj1.$type // $Type<'foo', 'main'>
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
   *  obj2.$type // $Type<'foo', 'main'>
   *  // @ts-expect-error
   *  obj2.foo
   * }
   * ```
   *
   * The construct bellow is what makes these two scenarios possible.
   */
  ''
}
export type $TypedObject<V, Id extends string, Hash extends string> = V extends {
  $type: $Type<Id, Hash>
}
  ? V
  : V extends { $type?: string }
    ? V extends { $type?: infer T extends $Type<Id, Hash> }
      ? V & { $type: T }
      : never
    : V & { $type: $Type<Id, Hash> }

export function is$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is $TypedObject<V, Id, Hash> {
  return isObject(v) && '$type' in v && is$type(v.$type, id, hash)
}

export function maybe$typed<V, Id extends string, Hash extends string>(
  v: V,
  id: Id,
  hash: Hash,
): v is V & object & { $type?: $Type<Id, Hash> } {
  return (
    isObject(v) &&
    ('$type' in v
      ? v.$type === undefined || is$type(v.$type, id, hash)
      : true)
  )
}

export type Validator<R = unknown> = (v: unknown) => ValidationResult<R>
export type ValidatorParam<V extends Validator> =
  V extends Validator<infer R> ? R : never

/**
 * Utility function that allows to convert a "validate*" utility function into a
 * type predicate.
 */
export function asPredicate<V extends Validator>(validate: V) {
  return function <T>(v: T): v is T & ValidatorParam<V> {
    return validate(v).success
  }
}
`,
  )

export const lexiconsTs = (project: Project, lexicons: LexiconDoc[]) =>
  gen(project, '/lexicons.ts', async (file) => {
    //= import { type LexiconDoc, Lexicons } from '@atproto/lexicon'
    file.addImportDeclaration({
      moduleSpecifier: '@atproto/lexicon',
      namedImports: [
        { name: 'LexiconDoc', isTypeOnly: true },
        { name: 'Lexicons' },
        { name: 'ValidationError' },
        { name: 'ValidationResult', isTypeOnly: true },
      ],
    })

    //= import { is$typed, maybe$typed, type $Typed } from './util.js'
    file.addImportDeclaration({
      moduleSpecifier: './util.js',
      namedImports: [
        { name: '$Typed', isTypeOnly: true },
        { name: 'is$typed' },
        { name: 'maybe$typed' },
      ],
    })

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
                  [toTitleCase(cur.id)]: cur,
                }),
                {},
              ),
              null,
              2,
            ) + ' as const satisfies Record<string, LexiconDoc>',
        },
      ],
    })

    //= export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemas',
          initializer: 'Object.values(schemaDict) satisfies LexiconDoc[]',
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
      overloads: [
        {
          typeParameters: ['T extends { $type: string }'],
          parameters: [
            { name: 'v', type: 'unknown' },
            { name: 'id', type: 'string' },
            { name: 'hash', type: 'string' },
            { name: 'requiredType', type: 'true' },
          ],
          returnType: 'ValidationResult<T>',
        },
        {
          typeParameters: ['T extends { $type?: string }'],
          parameters: [
            { name: 'v', type: 'unknown' },
            { name: 'id', type: 'string' },
            { name: 'hash', type: 'string' },
            { name: 'requiredType', type: 'false', hasQuestionToken: true },
          ],
          returnType: 'ValidationResult<T>',
        },
      ],
      parameters: [
        { name: 'v', type: 'unknown' },
        { name: 'id', type: 'string' },
        { name: 'hash', type: 'string' },
        { name: 'requiredType', type: 'boolean', hasQuestionToken: true },
      ],
      statements: [
        // If $type is present, make sure it is valid before validating the rest of the object
        'return (requiredType ? is$typed : maybe$typed)(v, id, hash) ? lexicons.validate(`${id}#${hash}`, v) : { success: false, error: new ValidationError(`Must be an object with "${hash === \'main\' ? id : `${id}#${hash}`}" $type property`) }',
      ],
      returnType: 'ValidationResult',
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
              (lex) => `\n  ${toTitleCase(lex.id)}: ${JSON.stringify(lex.id)},`,
            )
            .join('')}\n} as const`,
        },
      ],
    })
  })

/**
 * The top-level statements of a generated file, as ts-morph structures.
 *
 * ts-morph re-parses the whole file after every manipulation, which makes
 * building a file node by node quadratic in its size. Generators instead
 * describe each statement in full, and {@link gen} inserts them in as few
 * manipulations as possible. The `add*` methods mirror the {@link SourceFile}
 * ones, including the insertion of imports after the last import.
 */
export class GenFile {
  readonly imports: ImportDeclarationStructure[] = []
  readonly statements: StatementStructures[] = []

  addImportDeclaration(structure: OptionalKind<ImportDeclarationStructure>) {
    this.imports.push({ ...structure, kind: StructureKind.ImportDeclaration })
  }

  addExportDeclaration(structure: OptionalKind<ExportDeclarationStructure>) {
    this.statements.push({
      ...structure,
      kind: StructureKind.ExportDeclaration,
    })
  }

  addClass(structure: OptionalKind<ClassDeclarationStructure>) {
    this.statements.push({ ...structure, kind: StructureKind.Class })
  }

  addInterface(structure: OptionalKind<InterfaceDeclarationStructure>) {
    this.statements.push({ ...structure, kind: StructureKind.Interface })
  }

  addTypeAlias(structure: OptionalKind<TypeAliasDeclarationStructure>) {
    this.statements.push({ ...structure, kind: StructureKind.TypeAlias })
  }

  addVariableStatement(structure: OptionalKind<VariableStatementStructure>) {
    this.statements.push({
      ...structure,
      kind: StructureKind.VariableStatement,
    })
  }

  addFunction(structure: OptionalKind<FunctionDeclarationStructure>) {
    this.statements.push({ ...structure, kind: StructureKind.Function })
  }
}

export async function gen(
  project: Project,
  path: string,
  gen: (file: GenFile) => Promise<void>,
): Promise<GeneratedFile> {
  const genFile = new GenFile()
  await gen(genFile)
  const file = project.createSourceFile(path)
  insertStatements(file, [...genFile.imports, ...genFile.statements])
  await file.save() // Save in the "in memory" file system
  return formatFile(path, file.getFullText())
}

/**
 * Inserts each run of consecutive statements of the same kind in a single
 * manipulation. ts-morph separates the statements of a run the same way as
 * when they are added one by one, so the resulting text is identical.
 */
function insertStatements(file: SourceFile, statements: StatementStructures[]) {
  for (let start = 0; start < statements.length;) {
    const { kind } = statements[start]
    let end = start + 1
    while (end < statements.length && statements[end].kind === kind) end++
    const run = statements.slice(start, end)
    switch (kind) {
      case StructureKind.ImportDeclaration:
        file.addImportDeclarations(run as ImportDeclarationStructure[])
        break
      case StructureKind.ExportDeclaration:
        file.addExportDeclarations(run as ExportDeclarationStructure[])
        break
      case StructureKind.Class:
        file.addClasses(run as ClassDeclarationStructure[])
        break
      case StructureKind.Interface:
        file.addInterfaces(run as InterfaceDeclarationStructure[])
        break
      case StructureKind.TypeAlias:
        file.addTypeAliases(run as TypeAliasDeclarationStructure[])
        break
      case StructureKind.VariableStatement:
        file.addVariableStatements(run as VariableStatementStructure[])
        break
      case StructureKind.Function:
        file.addFunctions(run as FunctionDeclarationStructure[])
        break
      default:
        throw new Error(`Unsupported statement kind: ${StructureKind[kind]}`)
    }
    start = end
  }
}

async function formatFile(path: string, text: string): Promise<GeneratedFile> {
  const content = await format(`${banner()}${text}`, PRETTIER_OPTS)
  return { path, content }
}

function banner() {
  return `/**
 * GENERATED CODE - DO NOT MODIFY
 */
`
}
