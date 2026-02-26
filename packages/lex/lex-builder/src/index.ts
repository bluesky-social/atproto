// Must be first
import './polyfill.js'

import {
  LexBuilder,
  LexBuilderLoadOptions,
  LexBuilderOptions,
  LexBuilderSaveOptions,
} from './lex-builder.js'

export * from './lex-builder.js'
export * from './lex-def-builder.js'
export * from './lexicon-directory-indexer.js'

/**
 * Combined options for building a TypeScript project from Lexicon documents.
 *
 * This type merges all configuration options needed for the complete build
 * process, including builder configuration, loading options, and save options.
 *
 * @see {@link LexBuilderOptions} for builder configuration
 * @see {@link LexBuilderLoadOptions} for lexicon loading options
 * @see {@link LexBuilderSaveOptions} for output save options
 */
export type TsProjectBuildOptions = LexBuilderOptions &
  LexBuilderLoadOptions &
  LexBuilderSaveOptions

/**
 * Builds TypeScript schemas from Lexicon documents.
 *
 * This is the main entry point for programmatic usage of the lex-builder
 * package. It creates a new {@link LexBuilder} instance, loads lexicon
 * documents from the specified directory, and saves the generated TypeScript
 * files to the output directory.
 *
 * @param options - Combined build options including source directory, output
 *   directory, and generation settings
 *
 * @example
 * ```ts
 * import { build } from '@atproto/lex-builder'
 *
 * await build({
 *   lexicons: './lexicons',
 *   out: './src/generated',
 *   pretty: true,
 *   clear: true,
 * })
 * ```
 */
export async function build(options: TsProjectBuildOptions) {
  const builder = new LexBuilder(options)
  await builder.load(options)
  await builder.save(options)
}
