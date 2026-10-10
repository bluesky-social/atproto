import type { CommandModule } from 'yargs'

function defineCommandModule<T, U>(
  cmd: CommandModule<T, U>,
): CommandModule<T, U> {
  return cmd
}

export const buildCommand = defineCommandModule({
  command: ['build', 'b'],
  describe:
    'Generate TypeScript lexicon schema files from JSON lexicon definitions',
  builder: (yargs) => {
    return yargs.strict().options({
      lexicons: {
        type: 'string',
        demandOption: true,
        default: './lexicons',
        describe: 'directory containing lexicon JSON files',
      },
      out: {
        type: 'string',
        demandOption: true,
        default: './src/lexicons',
        describe: 'output directory for generated TS files',
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
      pretty: {
        type: 'boolean',
        default: false,
        describe: 'run prettier on generated files',
      },
      'ignore-errors': {
        type: 'boolean',
        default: false,
        describe: 'how to handle errors when processing input files',
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
      lib: {
        type: 'string',
        default: '@atproto/lex',
        describe:
          'package name of the library to import the lex schema utility "l" from',
      },
      'import-ext': {
        type: 'string',
        default: '.js',
        describe:
          'file extension to use for import statements in generated files (e.g. ".ts", ".mts", ".cts"). Use --import-ext "" to generate extension-less imports.',
      },
      'file-ext': {
        type: 'string',
        default: '.ts',
        describe:
          'file extension to use for generated files (e.g. ".ts", ".mts", ".cts")',
      },
      'index-file': {
        type: 'boolean',
        default: false,
        describe:
          'generate an "index.<fileExt>" file that exports all root-level namespaces',
      },
      'defs-export': {
        type: 'boolean',
        default: false,
        describe:
          'when some definitions conflict with child namespaces, this option allows to export lexicon definitions under a separate $defs namespace (e.g. com.example.foo.$defs)',
      },
      'default-export': {
        type: 'boolean',
        default: true,
        describe:
          'whether to generate a default export for the "main" lexicon definition schema in the parent namespace file',
      },
      'ignore-invalid-lexicons': {
        type: 'boolean',
        default: false,
        describe:
          'skip over invalid lexicon files instead of exiting with an error',
      },
    })
  },
  handler: async (argv) => {
    const { build } = await import('@atproto/lex-builder')
    await build(argv)
  },
})
