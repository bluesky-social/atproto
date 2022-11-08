import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { Schema } from '@atproto/lexicon'
import prettier from 'prettier'
import { GeneratedFile } from '../types'

const PRETTIER_OPTS = {
  parser: 'babel',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
}

export const schemasTs = (project, schemas: Schema[]) =>
  gen(project, '/schemas.ts', async (file) => {
    const methodSchemas = schemas.filter(
      (s) => s.type === 'query' || s.type === 'procedure',
    )
    const recordSchemas = schemas.filter((s) => s.type === 'record')

    const nsidToEnum = (nsid: string): string => {
      return nsid
        .split('.')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join('')
    }

    //= import {RecordSchema, MethodSchema} from '@atproto/lexicon'
    file
      .addImportDeclaration({
        moduleSpecifier: '@atproto/lexicon',
      })
      .addNamedImports([{ name: 'MethodSchema' }, { name: 'RecordSchema' }])

    //= export const methodSchemaDict: Record<string, MethodSchema> = {...}
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'methodSchemaDict',
          type: 'Record<string, MethodSchema>',
          initializer: JSON.stringify(
            methodSchemas.reduce((acc, cur) => {
              return {
                ...acc,
                [cur.id]: cur,
              }
            }, {}),
            null,
            2,
          ),
        },
      ],
    })
    //= export const methodSchemas: MethodSchema[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'methodSchemas',
          type: 'MethodSchema[]',
          initializer: 'Object.values(methodSchemaDict)',
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
            recordSchemas.reduce((acc, cur) => {
              return {
                ...acc,
                [nsidToEnum(cur.id)]: cur.id,
              }
            }, {}),
          ),
        },
      ],
    })
    //= export const recordSchemaDict: Record<string, RecordSchema> = {...}
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'recordSchemaDict',
          type: 'Record<string, RecordSchema>',
          initializer: JSON.stringify(
            recordSchemas.reduce((acc, cur) => {
              return {
                ...acc,
                [cur.id]: cur,
              }
            }, {}),
            null,
            2,
          ),
        },
      ],
    })
    //= export const recordSchemas: RecordSchema[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'recordSchemas',
          type: 'RecordSchema[]',
          initializer: 'Object.values(recordSchemaDict)',
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

export const emptyObjectSchema = { type: 'object' } as const
