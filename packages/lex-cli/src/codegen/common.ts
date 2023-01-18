import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { LexiconDoc } from '@atproto/lexicon'
import prettier from 'prettier'
import { GeneratedFile } from '../types'

const PRETTIER_OPTS = {
  parser: 'babel-ts',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  trailingComma: 'all' as const,
}

export const utilTs = (project) =>
  gen(project, '/util.ts', async (file) => {
    file.replaceWithText(`
  export function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null
  }
  
  export function hasProp<K extends PropertyKey>(
    data: object,
    prop: K,
  ): data is Record<K, unknown> {
    return prop in data
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

    //= export const schemaDict: Record<string, LexiconDoc> = {...}
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemaDict',
          initializer: JSON.stringify(
            lexicons.reduce(
              (acc, cur) => ({
                ...acc,
                [nsidToEnum(cur.id)]: cur,
              }),
              {},
            ),
            null,
            2,
          ),
        },
      ],
    })

    //= export const schemas: LexiconDoc[] = Object.values(schemaDict) as LexiconDoc[]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemas',
          type: 'LexiconDoc[]',
          initializer: 'Object.values(schemaDict) as LexiconDoc[]',
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
          initializer: JSON.stringify(
            lexicons.reduce((acc, cur) => {
              return {
                ...acc,
                [nsidToEnum(cur.id)]: cur.id,
              }
            }, {}),
          ),
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
    content: `${banner()}${prettier.format(src, PRETTIER_OPTS)}`,
  }
}

function banner() {
  return `/**
 * GENERATED CODE - DO NOT MODIFY
 */
`
}
