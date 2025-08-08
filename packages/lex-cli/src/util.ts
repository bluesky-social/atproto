import fs from 'node:fs'
import { join, relative } from 'node:path'
import chalk from 'chalk'
import { ZodError, type ZodFormattedError } from 'zod'
import { type LexiconDoc, parseLexiconDoc } from '@atproto/lexicon'
import {
  type FileDiff,
  type GeneratedAPI,
  type ModificationTimes,
} from './types'

export function readAllLexicons(
  paths: string[],
): [LexiconDoc[], ModificationTimes] {
  paths = [...paths].sort() // incoming path order may have come from locale-dependent shell globs
  const lastModified: ModificationTimes = {}
  const docs: LexiconDoc[] = []
  for (const path of paths) {
    if (!path.endsWith('.json') || !fs.statSync(path).isFile()) {
      continue
    }
    try {
      const ts = fs.statSync(path).mtime.getTime()
      const doc = readLexicon(path)
      docs.push(doc)

      // update last-modified time for each namespace level (including "" = root)
      const nsidParts = doc.id.split('.')
      for (let i = 0; i <= nsidParts.length; i++) {
        const nsidPath = nsidParts.slice(0, i).join('.')
        lastModified[nsidPath] = Math.max(lastModified[nsidPath] ?? 0, ts)
      }
    } catch (e) {
      // skip
    }
  }
  return [docs, lastModified]
}

function walk(dir: string): Promise<[string, fs.Stats][]> {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (error, files) => {
      if (error) {
        return reject(error)
      }
      Promise.all(
        files.map((file) => {
          return new Promise<[string, fs.Stats][]>((resolve, reject) => {
            const filepath = join(dir, file)
            fs.stat(filepath, async (error, stats) => {
              if (error) {
                return reject(error)
              }
              if (stats.isDirectory()) {
                try {
                  const subFiles = await walk(filepath)
                  resolve(subFiles)
                } catch (err) {
                  reject(err)
                }
              } else if (stats.isFile()) {
                resolve([[filepath, stats]])
              } else {
                resolve([])
              }
            })
          })
        }),
      )
        .then((foldersContents) => {
          resolve(
            foldersContents.reduce(
              (
                all: [string, fs.Stats][],
                folderContents: [string, fs.Stats][],
              ) => all.concat(folderContents),
              [],
            ),
          )
        })
        .catch(reject)
    })
  })
}

export async function getTSTimestamps(dir: string): Promise<ModificationTimes> {
  const lastModified: ModificationTimes = {}
  for (const [path, stat] of await walk(dir)) {
    //console.log("getTSTimestamps", relative(dir, path), stat.mtime.getTime())
    lastModified[relative(dir, path)] = stat.mtime.getTime()
  }
  return lastModified
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

export function genFileDiff(
  outDir: string,
  api: GeneratedAPI,
  rebuild?: boolean,
) {
  const diffs: FileDiff[] = []
  const existingFiles = readdirRecursiveSync(outDir)

  for (const file of api.files) {
    file.path = join(outDir, file.path)
    if (file.content === undefined) {
      diffs.push({ act: 'leave', path: file.path })
    } else if (existingFiles.includes(file.path)) {
      diffs.push({ act: 'mod', path: file.path, content: file.content })
    } else {
      diffs.push({ act: 'add', path: file.path, content: file.content })
    }
  }
  for (const filepath of existingFiles) {
    if (api.files.find((f) => f.path === filepath)) {
      // do nothing
    } else {
      if (rebuild) {
        // don't delete things on incremental rebuilds
        diffs.push({ act: 'del', path: filepath })
      }
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
