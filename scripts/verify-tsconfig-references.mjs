#!/usr/bin/env node

// Checks that the TypeScript project references of every workspace project
// match its workspace dependencies. Service images build each service with
// `tsc --build` of its tsconfig, which only builds the projects its references
// reach, so a missing reference breaks the image build while the root build,
// which references every project, still succeeds.
//
// For each project's build config (tsconfig.build.json, or tsconfig.json for
// services):
// 1. every workspace dependency in dependencies, optionalDependencies or
//    peerDependencies must be referenced, unless it has no composite
//    tsconfig.build.json (e.g. bundled UIs);
// 2. every reference to another workspace project must point to one of its
//    workspace dependencies (devDependencies included), as the image build only
//    copies those.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// TS 7 has no programmatic API yet: use TS 6 (the root "typescript" package)
const ts = createRequire(import.meta.url)('typescript')

const projects = JSON.parse(
  execFileSync('pnpm', ['ls', '--recursive', '--depth=-1', '--json'], {
    cwd: root,
    encoding: 'utf8',
  }),
).filter((p) => p.path !== root)

const nameByDir = new Map(projects.map((p) => [p.path, p.name]))
const dirByName = new Map(projects.map((p) => [p.name, p.path]))

const PROD_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const ALL_FIELDS = [...PROD_FIELDS, 'devDependencies']

const readConfig = (file) => ts.readConfigFile(file, ts.sys.readFile).config

const isComposite = (file) => {
  const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic() {} }
  const { options } = ts.getParsedCommandLineOfConfigFile(file, {}, host)
  return options.composite === true && options.noEmit !== true
}

const buildConfigOf = (dir) =>
  join(
    dir,
    relative(root, dir).startsWith(`services${sep}`)
      ? 'tsconfig.json'
      : 'tsconfig.build.json',
  )

const projectOf = (file) => {
  for (
    let dir = dirname(file);
    dir.startsWith(root + sep);
    dir = dirname(dir)
  ) {
    if (nameByDir.has(dir)) return nameByDir.get(dir)
  }
}

// References to other projects, following references to configs of the same
// project (e.g. a tsconfig.build.json composed of several configs)
function externalReferences(file, self, refs = new Map(), seen = new Set()) {
  if (seen.has(file)) return refs
  seen.add(file)
  for (const ref of readConfig(file).references ?? []) {
    let target = resolve(dirname(file), ref.path)
    if (!target.endsWith('.json')) target = join(target, 'tsconfig.json')
    const owner = projectOf(target)
    if (owner === self) externalReferences(target, self, refs, seen)
    else refs.set(owner ?? target, target)
  }
  return refs
}

function workspaceDependencies(pkg, fields) {
  const names = new Set()
  for (const field of fields) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      if (spec.startsWith('workspace:')) names.add(name)
    }
  }
  return names
}

const errors = []

for (const { name, path: dir } of projects) {
  const config = buildConfigOf(dir)
  if (!existsSync(config)) continue

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const refs = externalReferences(config, name)
  const configPath = relative(root, config)

  for (const dep of workspaceDependencies(pkg, PROD_FIELDS)) {
    if (refs.has(dep)) continue
    const depConfig = join(dirByName.get(dep), 'tsconfig.build.json')
    if (!existsSync(depConfig) || !isComposite(depConfig)) continue
    const path = relative(dirname(config), depConfig)
    errors.push(
      `${configPath}: missing reference { "path": "${path}" } to dependency ${dep}`,
    )
  }

  const deps = workspaceDependencies(pkg, ALL_FIELDS)
  for (const [owner, target] of refs) {
    if (deps.has(owner)) continue
    errors.push(
      `${configPath}: references ${relative(root, target)}, but ${owner} is not a workspace dependency of ${name}`,
    )
  }
}

for (const error of errors) console.error(error)
if (errors.length) process.exitCode = 1
