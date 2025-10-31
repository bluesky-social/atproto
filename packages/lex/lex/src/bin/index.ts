import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { TsProjectBuilder } from './lib/ts-project-builder.js'

export async function main() {
  await yargs(hideBin(process.argv))
    .strict()
    .command(
      'build',
      'Generate TypeScript lexicon schema files from JSON lexicon definitions',
      (yargs) => {
        return yargs.strict().options({
          in: {
            array: true,
            type: 'string',
            demandOption: true,
            describe: 'directory containing lexicon JSON files',
            default: './lexicons',
          },
          out: {
            type: 'string',
            demandOption: true,
            describe: 'output directory for generated TS files',
            default: './src/lexicons',
          },
          clear: {
            type: 'boolean',
            default: false,
            describe: 'clear output directory before generating files',
          },
          override: {
            type: 'boolean',
            default: false,
            describe: 'override existing files (has no effect with --clear)',
          },
          format: {
            type: 'boolean',
            default: true,
            describe: 'run prettier on generated files',
          },
          'ignore-errors': {
            type: 'boolean',
            default: false,
            describe: 'how to handle errors when processing input files',
          },
          'pure-annotations': {
            type: 'boolean',
            default: false,
            describe:
              'adds `/*#__PURE__*/` annotations for tree-shaking tools. Set this to true if you are using generated lexicons in a library.',
          },
          exclude: {
            array: true,
            type: 'string',
            describe:
              'list of strings or regex patterns to exclude lexicon documents by their IDs',
          },
          include: {
            array: true,
            type: 'string',
            describe:
              'list of strings or regex patterns to include lexicon documents by their IDs',
          },
        })
      },
      async (argv) => {
        await TsProjectBuilder.build(argv)
      },
    )
    .parseAsync()
}
