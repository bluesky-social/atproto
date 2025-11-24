import {
  LexBuilder,
  LexBuilderLoadOptions,
  LexBuilderSaveOptions,
} from './lex-builder.js'

export * from './lex-builder.js'
export * from './lexicon-directory-indexer.js'

export type TsProjectBuildOptions = LexBuilderLoadOptions &
  LexBuilderSaveOptions

export async function build(options: TsProjectBuildOptions) {
  const builder = new LexBuilder()
  await builder.load(options)
  await builder.save(options)
}
