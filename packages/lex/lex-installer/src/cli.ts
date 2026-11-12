import type { CommandModule } from 'yargs'

function defineCommandModule<T, U>(
  cmd: CommandModule<T, U>,
): CommandModule<T, U> {
  return cmd
}

export const installCommand: CommandModule<
  unknown,
  {
    additions: undefined | string[]
    lexicons: string
    manifest: string
    save: boolean
    update: undefined | boolean
    ci: undefined | boolean
  }
> = defineCommandModule({
  command: ['install [additions..]', 'i [additions..]'],
  describe: 'Fetch and install lexicon documents',
  builder: (yargs) => {
    return yargs
      .strict()
      .positional('additions', {
        type: 'string',
        describe: 'NSID of the lexicon to install',
        array: true,
        required: false,
      })
      .options({
        manifest: {
          type: 'string',
          default: './lexicons.json',
          normalize: true,
          describe: 'path to lexicons manifest file',
        },
        lexicons: {
          type: 'string',
          default: './lexicons',
          normalize: true,
          describe: 'directory containing lexicon JSON files',
        },
        save: {
          alias: 's',
          type: 'boolean',
          default: true,
          describe:
            'Updates the manifest with installed lexicons (use --no-save to disable)',
        },
        update: {
          type: 'boolean',
          deprecated: 'use the "update" command instead',
          conflicts: ['ci'],
          describe:
            'update all installed lexicons to their latest versions by re-resolving and re-installing them',
        },
        ci: {
          type: 'boolean',
          describe:
            'error if the installed lexicons do not match the CIDs in the lexicons.json manifest',
        },
      })
  },
  handler: async (argv) => {
    const { install } = await import('@atproto/lex-installer')
    await install(argv)
  },
})

export const updateCommand: CommandModule<
  unknown,
  {
    include: string[]
    exclude: undefined | string[]
    lexicons: string
    manifest: string
  }
> = defineCommandModule({
  command: 'update [include..]',
  describe: 'Update installed lexicons',
  builder: (yargs) => {
    return yargs
      .strict()
      .positional('include', {
        type: 'string',
        describe:
          'NSID pattern of the lexicons to include in the update (default: all)',
        array: true,
        default: ['*'],
      })
      .options({
        manifest: {
          type: 'string',
          default: './lexicons.json',
          normalize: true,
          describe: 'path to lexicons manifest file',
        },
        lexicons: {
          type: 'string',
          default: './lexicons',
          normalize: true,
          describe: 'directory containing lexicon JSON files',
        },
        exclude: {
          type: 'string',
          describe: 'NSID pattern to exclude from the update',
          array: true,
        },
      })
  },
  handler: async (argv) => {
    const { update } = await import('@atproto/lex-installer')
    await update(argv)
  },
})
