import {
  TsProjectBuilder,
  TsProjectBuilderLoadOptions,
  TsProjectBuilderSaveOptions,
} from './lib/ts-project-builder.js'

export type GenOptions = TsProjectBuilderLoadOptions &
  TsProjectBuilderSaveOptions

export async function build(options: GenOptions) {
  const generator = new TsProjectBuilder()
  await generator.load(options)
  await generator.save(options)
}
