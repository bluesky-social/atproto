// Must be first
import './polyfill.js'

import {
  LexBuilder,
  LexBuilderLoadOptions,
  LexBuilderOptions,
  LexBuilderSaveOptions,
} from './lex-builder.js'

export * from './lex-builder.js'
export * from './lexicon-directory-indexer.js'

export type TsProjectBuildOptions = LexBuilderOptions &
  LexBuilderLoadOptions &
  LexBuilderSaveOptions

export async function build(options: TsProjectBuildOptions) {
  const builder = new LexBuilder(options)
  await builder.load(options)
  await builder.save(options)
}
