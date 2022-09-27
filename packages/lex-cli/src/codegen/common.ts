import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { Schema } from '@adxp/lexicon'
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
    //= import {RecordSchema, MethodSchema} from '@adxp/lexicon'
    file
      .addImportDeclaration({
        moduleSpecifier: '@adxp/lexicon',
      })
      .addNamedImports([{ name: 'MethodSchema' }, { name: 'RecordSchema' }])
    //= export const methodSchemas: MethodSchema[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'methodSchemas',
          type: 'MethodSchema[]',
          initializer: JSON.stringify(
            schemas.filter((s) => s.type === 'query' || s.type === 'procedure'),
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
          initializer: JSON.stringify(
            schemas.filter((s) => s.type === 'record'),
            null,
            2,
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
