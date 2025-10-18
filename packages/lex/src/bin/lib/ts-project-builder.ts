import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { IndentationText, Project } from 'ts-morph'
import { LexiconDoc, LexiconIndexer } from '../../doc/index.js'
import { BuildFilterOptions, buildFilter } from './filter.js'
import { FilteredIndexer } from './filtered-indexer.js'
import {
  LexiconDirectoryIndexer,
  LexiconDirectoryIndexerOptions,
} from './lexicon-directory-indexer.js'
import { TsDocBuilder, TsDocBuilderOptions } from './ts-doc-builder.js'
import { TsFormatter, TsFormatterOptions } from './ts-formatter.js'

export type TsProjectBuilderLoadOptions = TsDocBuilderOptions &
  LexiconDirectoryIndexerOptions &
  BuildFilterOptions

export type TsProjectBuilderSaveOptions = TsFormatterOptions & {
  out: string
  manifest?: string
  clear?: boolean
  override?: boolean
}

export class TsProjectBuilder {
  readonly #imported = new Set<string>()
  readonly #project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })

  get imported() {
    return Array.from(this.#imported)
  }

  public async load(options: TsProjectBuilderLoadOptions) {
    const indexer = new FilteredIndexer(
      new LexiconDirectoryIndexer(options),
      buildFilter(options),
    )

    for await (const doc of indexer) {
      if (!this.#imported.has(doc.id)) {
        this.#imported.add(doc.id)
      } else {
        throw new Error(`Duplicate lexicon document id: ${doc.id}`)
      }

      await this.createDefsFile(doc, indexer, options)
      await this.createExportTree(doc)
    }
  }

  public async save(options: TsProjectBuilderSaveOptions) {
    const files = this.#project.getSourceFiles()

    const destination = resolve(options.out)

    if (options.clear) {
      await rm(destination, { recursive: true, force: true })
    } else if (!options.override) {
      await Promise.all(
        files.map(async (f) =>
          assertNotFileExists(join(destination, f.getFilePath())),
        ),
      )
    }

    const formatter = new TsFormatter(options)

    await Promise.all(
      Array.from(files, async (file) => {
        const filePath = join(destination, file.getFilePath())
        const content = await formatter.format(file.getFullText())
        await mkdir(join(filePath, '..'), { recursive: true })
        await rm(filePath, { recursive: true, force: true })
        await writeFile(filePath, content, 'utf8')
      }),
    )

    if (options.manifest) {
      const manifestPath = resolve(options.manifest)
      const manifestContent = JSON.stringify(
        { lexicons: this.imported.sort() },
        null,
        2,
      )
      await mkdir(join(manifestPath, '..'), { recursive: true })
      await writeFile(manifestPath, manifestContent, 'utf8')
    }
  }

  private createFile(path: string) {
    return this.#project.createSourceFile(path)
  }

  private getFile(path: string) {
    return this.#project.getSourceFile(path) || this.createFile(path)
  }

  private async createExportTree(doc: LexiconDoc) {
    const namespaces = doc.id.split('.')

    // First create the parent namespaces
    for (let i = 0; i < namespaces.length - 1; i++) {
      const currentNs = namespaces[i]
      const childNs = namespaces[i + 1]

      const path = join('/', ...namespaces.slice(0, i + 1))
      const file = this.getFile(`${path}.ts`)

      const childModuleSpecifier = `./${currentNs}/${childNs}.js`
      const dec = file.getExportDeclaration(childModuleSpecifier)
      if (!dec) {
        file.addExportDeclaration({
          moduleSpecifier: childModuleSpecifier,
          namespaceExport: childNs,
        })
      }
    }

    // The child file exports the schemas (as *)
    const path = join('/', ...namespaces)
    const file = this.getFile(`${path}.ts`)

    file.addExportDeclaration({
      moduleSpecifier: `./${namespaces.at(-1)}.defs.js`,
    })

    // @NOTE Individual exports exports from the defs file might conflict with
    // child namespaces. For this reason, we also add a namespace export for the
    // defs (export * as $defs from './xyz.defs.js'). This is an escape hatch
    // allowing to still access the definitions if a hash get shadowed by a
    // child namespace.
    file.addExportDeclaration({
      moduleSpecifier: `./${namespaces.at(-1)}.defs.js`,
      namespaceExport: '$defs',
    })
  }

  private async createDefsFile(
    doc: LexiconDoc,
    indexer: LexiconIndexer,
    options: TsDocBuilderOptions,
  ): Promise<void> {
    const path = join('/', ...doc.id.split('.'))
    const file = this.createFile(`${path}.defs.ts`)

    const fileBuilder = new TsDocBuilder(options, file, doc, indexer)
    await fileBuilder.build()
  }
}

async function assertNotFileExists(file: string): Promise<void> {
  try {
    await stat(file)
    throw new Error(`File already exists: ${file}`)
  } catch (err) {
    if ((err as any)?.['code'] === 'ENOENT') return
    throw err
  }
}
