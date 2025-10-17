import {
  TsProjectBuilder,
  TsProjectBuilderLoadOptions,
  TsProjectBuilderSaveOptions,
} from './lib/ts-project-builder.js'

export type BuildOptions = TsProjectBuilderLoadOptions &
  TsProjectBuilderSaveOptions

export async function build(options: BuildOptions) {
  const generator = new TsProjectBuilder()
  await generator.load(options)
  await generator.save(options)
}
