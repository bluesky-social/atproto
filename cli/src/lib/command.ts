import minimist from 'minimist'

// globals
// =

export const registeredCommands: RegisteredCmd[] = []

// types & constants
// =

export const CATEGORIES = {
  setup: 'Setup',
  repo: 'Repo',
  social: 'Social',
  posts: 'Posts',
  interactions: 'Interactions',
  advanced: 'Advanced',
}

export interface Cmd {
  name: string
  category: keyof typeof CATEGORIES
  help?: string
  args?: CmdArg[]
  opts?: CmdOpt[]
  command: CmdHandler
}

export interface RegisteredCmd extends Cmd {
  nameParsed: string[]
}

export interface CmdHandler {
  (args: MinimistParsedArgs): any
}

export interface CmdArg {
  name: string
  optional?: boolean
}

export interface CmdOpt {
  name: string
  abbr?: string
  type?: 'boolean' | 'string' | 'number'
  help?: string
  default?: any
}

interface MinimistParsedArgs {
  [arg: string]: any
  '--'?: string[] | undefined
  _: string[]
}

// exported api
// =

export default function (opts: Cmd) {
  registeredCommands.push(
    Object.assign({}, opts, {
      nameParsed: opts.name.split(' '),
    }),
  )
}

export function matchCommand(args: MinimistParsedArgs) {
  let bestMatch: RegisteredCmd | undefined
  for (const cmd of registeredCommands) {
    if (
      isNameMatch(args._, cmd.nameParsed) &&
      (!bestMatch || bestMatch.nameParsed.length < cmd.nameParsed.length)
    ) {
      bestMatch = cmd
    }
  }
  return bestMatch
}

export function runCommand(cmd: RegisteredCmd, argv: string[]) {
  const args = minimist(argv, getMinimistArgs(cmd))
  validateAndCoerceParams(cmd, args)
  return cmd.command(args)
}

// internal methods
// =

function getMinimistArgs(cmd: RegisteredCmd) {
  const minArgs: {
    string: string[]
    boolean: string[]
    alias: Record<string, string>
    default: Record<string, unknown>
  } = {
    string: [],
    boolean: [],
    alias: {},
    default: {},
  }
  if (cmd.opts?.length) {
    for (const opt of cmd.opts) {
      if (opt.abbr) minArgs.alias[opt.abbr] = opt.name
      if (typeof opt.default !== 'undefined')
        minArgs.default[opt.name] = opt.default
      if (opt.type === 'boolean') minArgs.boolean.push(opt.name)
      else minArgs.string.push(opt.name)
    }
  }
  return minArgs
}

function validateAndCoerceParams(cmd: RegisteredCmd, args: MinimistParsedArgs) {
  if (cmd.args?.length) {
    for (let i = 0; i < cmd.args.length; i++) {
      if (typeof args._[i] === 'undefined') {
        if (!cmd.args[i].optional) {
          throw new Error(`${cmd.args[i].name} (argument ${i + 1}) is required`)
        }
      }
    }
  }
  if (cmd.opts?.length) {
    for (const opt of cmd.opts) {
      if (typeof args[opt.name] === 'undefined') {
        if (typeof opt.default === 'undefined') {
          throw new Error(
            `--${opt.name}${opt.abbr ? `|-${opt.abbr}` : ''} is required`,
          )
        } else {
          args[opt.name] = opt.default
          if (opt.abbr) args[opt.abbr] = opt.default
        }
      }
      if (opt.type === 'number') {
        if (opt.name in args) args[opt.name] = Number(args[opt.name])
        if (opt.abbr && opt.abbr in args)
          args[opt.abbr] = Number(args[opt.abbr])
      }
    }
  }
}

function isNameMatch(given: string[], cmdNameParsed: string[]) {
  for (let i = 0; i < cmdNameParsed.length; i++) {
    if (given[i] !== cmdNameParsed[i]) return false
  }
  return true
}
