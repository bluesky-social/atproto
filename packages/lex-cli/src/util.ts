import fs from 'node:fs'
import { join } from 'node:path'
import chalk from 'chalk'
import { ZodError, type ZodFormattedError } from 'zod'
import { type LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import { type FileDiff, type GeneratedAPI } from './types'

export function readAllLexicons(paths: string[]): LexiconDoc[] {
  // On Windows the shell does not expand glob patterns before passing args to
  // the process (unlike bash/zsh on Linux/Mac). Expand manually so codegen
  // works cross-platform.
  const expanded: string[] = []
  for (const p of paths) {
    if (p.includes('*')) {
      const baseDir = p.substring(0, p.indexOf('*')).replace(/[\\/]+$/, '')
      // Derive the exact depth from the glob portion so behaviour matches the
      // shell expansion on Linux/Mac. e.g. '*/*' → depth 2, meaning only files
      // exactly two levels below baseDir are collected (same as bash `*/*`).
      const globPart = p.substring(p.indexOf('*'))
      // path.resolve() converts '/' to '\' on Windows, so split on both
      const depth = globPart.split(/[/\\]/).length
      collectJsonFiles(baseDir, expanded, depth)
    } else {
      expanded.push(p)
    }
  }
  expanded.sort()
  const docs: LexiconDoc[] = []
  for (const path of expanded) {
    if (!path.endsWith('.json') || !fs.statSync(path).isFile()) {
      continue
    }
    try {
      docs.push(readLexicon(path))
    } catch (e) {
      // skip
    }
  }
  return docs
}

export function readLexicon(path: string): LexiconDoc {
  let str: string
  let obj: unknown
  try {
    str = fs.readFileSync(path, 'utf8')
  } catch (e) {
    console.error(`Failed to read file`, path)
    throw e
  }
  try {
    obj = JSON.parse(str)
  } catch (e) {
    console.error(`Failed to parse JSON in file`, path)
    throw e
  }
  if (
    obj &&
    typeof obj === 'object' &&
    typeof (obj as LexiconDoc).lexicon === 'number'
  ) {
    try {
      return parseLexiconDoc(obj)
    } catch (e) {
      console.error(`Invalid lexicon`, path)
      if (e instanceof ZodError) {
        printZodError(e.format())
      }
      throw e
    }
  } else {
    console.error(`Not lexicon schema`, path)
    throw new Error(`Not lexicon schema`)
  }
}

export function genTsObj(lexicons: LexiconDoc[]): string {
  return `export const lexicons = ${JSON.stringify(lexicons, null, 2)}`
}

export function genFileDiff(outDir: string, api: GeneratedAPI) {
  const diffs: FileDiff[] = []
  const existingFiles = readdirRecursiveSync(outDir)

  for (const file of api.files) {
    file.path = join(outDir, file.path)
    if (existingFiles.includes(file.path)) {
      diffs.push({ act: 'mod', path: file.path, content: file.content })
    } else {
      diffs.push({ act: 'add', path: file.path, content: file.content })
    }
  }
  for (const filepath of existingFiles) {
    if (api.files.find((f) => f.path === filepath)) {
      // do nothing
    } else {
      diffs.push({ act: 'del', path: filepath })
    }
  }

  return diffs
}

export function printFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
        console.log(`${chalk.greenBright('[+ add]')} ${d.path}`)
        break
      case 'mod':
        console.log(`${chalk.yellowBright('[* mod]')} ${d.path}`)
        break
      case 'del':
        console.log(`${chalk.redBright('[- del]')} ${d.path}`)
        break
    }
  }
}

export function applyFileDiff(diff: FileDiff[]) {
  for (const d of diff) {
    switch (d.act) {
      case 'add':
      case 'mod':
        fs.mkdirSync(join(d.path, '..'), { recursive: true }) // lazy way to make sure the parent dir exists
        fs.writeFileSync(d.path, d.content || '', 'utf8')
        break
      case 'del':
        fs.unlinkSync(d.path)
        break
    }
  }
}

function printZodError(node: ZodFormattedError<any>, path = ''): boolean {
  if (node._errors?.length) {
    console.log(chalk.red(`Issues at ${path}:`))
    for (const err of dedup(node._errors)) {
      console.log(chalk.red(` - ${err}`))
    }
    return true
  } else {
    for (const k in node) {
      if (k === '_errors') {
        continue
      }
      printZodError(node[k], `${path}/${k}`)
    }
  }
  return false
}

function readdirRecursiveSync(root: string, files: string[] = [], prefix = '') {
  const dir = join(root, prefix)
  if (!fs.existsSync(dir)) return files
  if (fs.statSync(dir).isDirectory())
    fs.readdirSync(dir).forEach(function (name) {
      readdirRecursiveSync(root, files, join(prefix, name))
    })
  else if (prefix.endsWith('.ts')) {
    files.push(join(root, prefix))
  }

  return files
}

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

// Collects .json files under dir up to the given depth (1 = immediate children,
// 2 = one level of subdirectories, etc.), matching the behaviour of a shell
// glob where each '*' segment corresponds to one depth level. This makes
// Windows and Linux codegen produce identical file lists.
function collectJsonFiles(
  dir: string,
  acc: string[],
  depth: number,
  current = 1,
): void {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && current < depth) {
      collectJsonFiles(full, acc, depth, current + 1)
    } else if (
      !entry.isDirectory() &&
      entry.name.endsWith('.json') &&
      current === depth
    ) {
      acc.push(full)
    }
  }
}
