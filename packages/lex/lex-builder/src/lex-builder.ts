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

/**
 * Configuration options for the {@link LexBuilder} class.
 *
 * Extends {@link LexDefBuilderOptions} with additional settings for
 * controlling the generated TypeScript project structure.
 *
 * @see {@link LexDefBuilderOptions} for definition generation options
 */
export type LexBuilderOptions = LexDefBuilderOptions & {
  /**
   * Whether to generate an index file at the root exporting all top-level
   * namespaces.
   *
   * @note This could theoretically cause name conflicts if a
   * @default false
   */
  indexFile?: boolean
  /**
   * The file extension to use for import specifiers in the generated code.
   *
   * @default '.js'
   */
  importExt?: string
  /**
   * The file extension to use for generated TypeScript files.
   *
   * @default '.ts'
   */
  fileExt?: string
}

/**
 * Options for loading lexicon documents into the builder.
 *
 * Combines directory indexing options with filtering options to control
 * which lexicon documents are processed.
 *
 * @see {@link LexiconDirectoryIndexerOptions} for directory scanning options
 * @see {@link BuildFilterOptions} for include/exclude filtering
 */
export type LexBuilderLoadOptions = LexiconDirectoryIndexerOptions &
  BuildFilterOptions

/**
 * Options for saving generated TypeScript files.
 *
 * Combines formatting options with output directory configuration.
 */
export type LexBuilderSaveOptions = FormatterOptions & {
  /**
   * The output directory path where generated TypeScript files will be written.
   */
  out: string
  /**
   * Whether to clear the output directory before writing files.
   *
   * When `true`, the entire output directory is deleted before writing new files.
   *
   * @default false
   */
  clear?: boolean
  /**
   * Whether to allow overwriting existing files.
   *
   * When `false`, an error is thrown if any output file already exists.
   *
   * @default false
   */
  override?: boolean
}

/**
 * Main builder class for generating TypeScript schemas from Lexicon documents.
 *
 * The LexBuilder orchestrates the entire code generation process:
 * 1. Loading and indexing lexicon documents from the filesystem
 * 2. Generating TypeScript type definitions and runtime schemas
 * 3. Creating namespace export trees for convenient imports
 * 4. Saving formatted output files
 *
 * @example
 * ```ts
 * const builder = new LexBuilder({ indexFile: true, pretty: true })
 *
 * // Load lexicons from a directory
 * await builder.load({ lexicons: './lexicons' })
 *
 * // Save generated TypeScript to output directory
 * await builder.save({ out: './src/generated', clear: true })
 * ```
 */
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
