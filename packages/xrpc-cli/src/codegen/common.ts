import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { MethodSchema } from '@adxp/xrpc'
import prettier from 'prettier'
import { GeneratedFile } from '../types'

const PRETTIER_OPTS = {
  parser: 'babel',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
}

export const schemasTs = (project, schemas: MethodSchema[]) =>
  gen(project, '/schemas.ts', async (file) => {
    //= import {MethodSchema} from '@adxp/xrpc'
    file
      .addImportDeclaration({
        moduleSpecifier: '@adxp/xrpc',
      })
      .addNamedImport({
        name: 'MethodSchema',
      })
    //= export const schemas: MethodSchema[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'schemas',
          type: 'MethodSchema[]',
          initializer: JSON.stringify(schemas, null, 2),
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
  // TODO run prettier on the output
  return {
    path: path,
    content: `${banner()}${prettier.format(src, PRETTIER_OPTS)}`,
  }
}

function banner() {
  return `/**
* GENERATED CODE - DO NOT MODIFY
* Created ${new Date().toDateString()}
*/
`
}
