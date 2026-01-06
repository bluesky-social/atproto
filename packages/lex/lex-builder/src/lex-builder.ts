import assert from 'node:assert'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { IndentationText, Project } from 'ts-morph'
import { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import { BuildFilterOptions, buildFilter } from './filter.js'
import { FilteredIndexer } from './filtered-indexer.js'
import { Formatter, FormatterOptions } from './formatter.js'
import { LexDefBuilder, LexDefBuilderOptions } from './lex-def-builder.js'
import {
  LexiconDirectoryIndexer,
  LexiconDirectoryIndexerOptions,
} from './lexicon-directory-indexer.js'
import { asNamespaceExport } from './ts-lang.js'

export type LexBuilderOptions = LexDefBuilderOptions & {
  /**
   * Whether to generate an index file at the root exporting all top-level
   * namespaces.
   *
   * @note This could theoretically cause name conflicts if a
   * @default false
   */
  indexFile?: boolean
  importExt?: string
  fileExt?: string
}

export type LexBuilderLoadOptions = LexiconDirectoryIndexerOptions &
  BuildFilterOptions

export type LexBuilderSaveOptions = FormatterOptions & {
  out: string
  clear?: boolean
  override?: boolean
}

export class LexBuilder {
  readonly #imported = new Set<string>()
  readonly #project = new Project({
    useInMemoryFileSystem: true,
    manipulationSettings: { indentationText: IndentationText.TwoSpaces },
  })

  constructor(private readonly options: LexBuilderOptions = {}) {}

  get fileExt() {
    return this.options.fileExt ?? '.ts'
  }

  get importExt() {
    return this.options.importExt ?? '.js'
  }

  public async load(options: LexBuilderLoadOptions) {
    await using indexer = new FilteredIndexer(
      new LexiconDirectoryIndexer(options),
      buildFilter(options),
    )

    for await (const doc of indexer) {
      if (!this.#imported.has(doc.id)) {
        this.#imported.add(doc.id)
      } else {
        throw new Error(`Duplicate lexicon document id: ${doc.id}`)
      }

      await this.createDefsFile(doc, indexer)
      await this.createExportTree(doc)
    }
  }

  public async save(options: LexBuilderSaveOptions) {
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

    const formatter = new Formatter(options)

    await Promise.all(
      Array.from(files, async (file) => {
        const filePath = join(destination, file.getFilePath())
        const content = await formatter.format(file.getFullText())
        await mkdir(join(filePath, '..'), { recursive: true })
        await rm(filePath, { recursive: true, force: true })
        await writeFile(filePath, content, 'utf8')
      }),
    )
  }

  private createFile(path: string) {
    return this.#project.createSourceFile(path)
  }

  private getFile(path: string) {
    return this.#project.getSourceFile(path) || this.createFile(path)
  }

  private async createExportTree(doc: LexiconDocument) {
    const namespaces = doc.id.split('.')

    if (this.options.indexFile) {
      const indexFile = this.getFile(`/index${this.fileExt}`)

      const tldNs = namespaces[0]!
      assert(
        tldNs !== 'index',
        'The "indexFile" options cannot be used with namespaces using a ".index" tld.',
      )
      const tldNsSpecifier = `./${tldNs}${this.importExt}`
      if (!indexFile.getExportDeclaration(tldNsSpecifier)) {
        indexFile.addExportDeclaration({
          moduleSpecifier: tldNsSpecifier,
          namespaceExport: asNamespaceExport(tldNs),
        })
      }
    }

    // First create the parent namespaces
    for (let i = 0; i < namespaces.length - 1; i++) {
      const currentNs = namespaces[i]
      const childNs = namespaces[i + 1]

      const path = join('/', ...namespaces.slice(0, i + 1))
      const file = this.getFile(`${path}${this.fileExt}`)

      const childModuleSpecifier = `./${currentNs}/${childNs}${this.importExt}`
      const dec = file.getExportDeclaration(childModuleSpecifier)
      if (!dec) {
        file.addExportDeclaration({
          moduleSpecifier: childModuleSpecifier,
          namespaceExport: asNamespaceExport(childNs),
        })
      }
    }

    // The child file exports the schemas (as *)
    const path = join('/', ...namespaces)
    const file = this.getFile(`${path}${this.fileExt}`)

    file.addExportDeclaration({
      moduleSpecifier: `./${namespaces.at(-1)}.defs${this.importExt}`,
    })

    // @NOTE Individual exports exports from the defs file might conflict with
    // child namespaces. For this reason, we also add a namespace export for the
    // defs (export * as $defs from './xyz.defs'). This is an escape hatch
    // allowing to still access the definitions if a hash get shadowed by a
    // child namespace.
    file.addExportDeclaration({
      moduleSpecifier: `./${namespaces.at(-1)}.defs${this.importExt}`,
      namespaceExport: '$defs',
    })
  }

  private async createDefsFile(
    doc: LexiconDocument,
    indexer: LexiconIndexer,
  ): Promise<void> {
    const path = join('/', ...doc.id.split('.'))
    const file = this.createFile(`${path}.defs${this.fileExt}`)

    const fileBuilder = new LexDefBuilder(this.options, file, doc, indexer)
    await fileBuilder.build()
  }
}

async function assertNotFileExists(file: string): Promise<void> {
  try {
    await stat(file)
    throw new Error(`File already exists: ${file}`)
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return
    throw err
  }
}
