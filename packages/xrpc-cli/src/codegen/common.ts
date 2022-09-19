import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { MethodSchema } from '@adxp/xrpc'
import { GeneratedFile } from '../types'

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
  // TODO run prettier on the output
  return {
    path: path,
    content: project.getFileSystem().readFileSync(path),
  }
}
