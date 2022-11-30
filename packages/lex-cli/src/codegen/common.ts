import { Project, SourceFile, VariableDeclarationKind } from 'ts-morph'
import { LexiconDoc } from '@atproto/lexicon'
import prettier from 'prettier'
import { GeneratedFile } from '../types'

const PRETTIER_OPTS = {
  parser: 'babel',
  tabWidth: 2,
  semi: false,
  singleQuote: true,
}

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
      .addNamedImports([{ name: 'LexiconDoc' }])

    //= export const lexicons: LexiconDoc[] = [...]
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: 'lexicons',
          type: 'LexiconDoc[]',
          initializer: JSON.stringify(lexicons, null, 2),
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
