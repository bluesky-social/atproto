import assert from 'node:assert'
import { join } from 'node:path'
import { SourceFile } from 'ts-morph'
import { LexiconDocument, LexiconIndexer } from '@atproto/lex-document'
import {
  isGlobalIdentifier,
  isJsKeyword,
  isSafeLocalIdentifier,
  isValidJsIdentifier,
} from './ts-lang.js'
import {
  asRelativePath,
  memoize,
  startsWithLower,
  toCamelCase,
  toPascalCase,
  ucFirst,
} from './util.js'

export type RefResolverOptions = {
  importExt?: string
}

export type ResolvedRef = {
  varName: string
  typeName: string
}

/**
 * Utility class to resolve lexicon references to TypeScript identifiers,
 * generating "import" statements as needed.
 */
export class RefResolver {
  constructor(
    private doc: LexiconDocument,
    private file: SourceFile,
    private indexer: LexiconIndexer,
    private options: RefResolverOptions,
  ) {}

  public readonly resolve = memoize(
    async (ref: string): Promise<ResolvedRef> => {
      const [nsid, hash = 'main'] = ref.split('#')

      if (nsid === '' || nsid === this.doc.id) {
        return this.resolveLocal(hash)
      } else {
        // @NOTE: Normalize (#main fragment) to ensure proper memoization
        const fullRef = `${nsid}#${hash}`
        return this.resolveExternal(fullRef)
      }
    },
  )

  #defCounters = new Map<string, number>()
  private nextSafeDefinitionIdentifier(name: string) {
    // use camelCase version of the hash as base name
    const nameSafe =
      startsWithLower(name) && isValidJsIdentifier(name)
        ? name
        : toCamelCase(name).replace(/^[0-9]+/g, '') || 'def'

    const count = this.#defCounters.get(nameSafe) ?? 0
    this.#defCounters.set(nameSafe, count + 1)

    // @NOTE We don't need to check against local declarations in the file here
    // since we are using a naming system that should guarantee no other
    // identifier has a <nameSafe>$<number> format ("$" cannot appear in
    // hashes so only *we* are generating such identifiers).

    const identifier = `${nameSafe}$${count}`

    assert(
      isValidJsIdentifier(identifier),
      `Unable to generate safe identifier for: "${name}"`,
    )

    return identifier
  }

  /**
   * @note The returned `typeName` and `varName` are *both* guaranteed to be
   * valid TypeScript identifiers.
   */
  public readonly resolveLocal = memoize(
    async (hash: string): Promise<ResolvedRef> => {
      const hashes = Object.keys(this.doc.defs)

      if (!hashes.includes(hash)) {
        throw new Error(`Definition ${hash} not found in ${this.doc.id}`)
      }

      // Because we are using predictable "public" identifiers for type names,
      // we need to ensure there are no conflicts between different definitions
      // in the same lexicon document.
      //
      // @NOTE It should be possible to implement a way to generate
      // non-conflicting type names for all public (type) identifiers in a
      // project. However, this would add a lot of complexity to the code
      // generation process, and the likelihood of such conflicts happening in
      // practice is very low, so we opt for a simpler approach of just throwing
      // an error if a conflict is detected.
      const pub = getPublicIdentifiers(hash)
      for (const otherHash of hashes) {
        if (otherHash === hash) continue
        const otherPub = getPublicIdentifiers(otherHash)
        if (otherPub.typeName === pub.typeName) {
          throw new Error(
            `Conflicting type names for definitions #${hash} and #${otherHash} in ${this.doc.id}`,
          )
        }
      }

      // Try to keep and identifier that resembles the original hash as identifier
      const safeIdentifier = asSafeDefinitionIdentifier(hash)

      // If the safe identifier is not conflicting with other definition names,
      // or reserved words, we can use it as-is. Otherwise, we need to generate
      // a unique safe identifier.
      const varName = safeIdentifier
        ? !hashes.some((otherHash) => {
            if (otherHash === hash) return false
            const otherIdentifier = asSafeDefinitionIdentifier(otherHash)
            return otherIdentifier === safeIdentifier
          })
          ? // Safe identifier can be used as-is as it does not conflict with
            // other definition names
            safeIdentifier
          : // In order to keep identifiers stable, we use the safe identifier
            // as base, and append a counter to avoid conflicts
            this.nextSafeDefinitionIdentifier(safeIdentifier)
        : // hash only contained unsafe characters, generate a safe one
          this.nextSafeDefinitionIdentifier(hash)

      const typeName = ucFirst(varName)
      assert(isSafeLocalIdentifier(typeName), 'Expected safe type identifier')
      assert(varName !== typeName, 'Variable and type name should be different')

      return { varName, typeName }
    },
  )

  /**
   * @note Since this is a memoized function, and is used to generate the name
   * of local variables, we should avoid returning different results for
   * similar, but non strictly equal, inputs (eg. normalized / non-normalized).
   * @see {@link resolve}
   */
  private readonly resolveExternal = memoize(
    async (fullRef: string): Promise<ResolvedRef> => {
      const [nsid, hash] = fullRef.split('#')
      const moduleSpecifier = `${asRelativePath(
        this.file.getDirectoryPath(),
        join('/', ...nsid.split('.')),
      )}.defs${this.options.importExt ?? '.js'}`

      // Lets first make sure the referenced lexicon exists
      const srcDoc = await this.indexer.get(nsid)
      const srcDef = Object.hasOwn(srcDoc.defs, hash) ? srcDoc.defs[hash] : null
      if (!srcDef) {
        throw new Error(
          `Missing def "${hash}" in "${nsid}" (referenced from ${this.doc.id})`,
        )
      }

      const publicIds = getPublicIdentifiers(hash)

      if (!isValidJsIdentifier(publicIds.typeName)) {
        // If <typeName> is not a valid identifier, we cannot access the type
        // using dot notation (<nsIdentifier>.<typeName>). Note that, unlike js
        // variables, types cannot be accessed using string indexing (like:
        // <nsIdentifier>['<typeName>']) because it generates TypeScript errors:
        //
        // > "Cannot use namespace '<nsIdentifier>' as a type."

        // Instead the generated code should look like:
        // import { "<unsafeTypeName>" as <safeIdentifier> } from './<moduleSpecifier>'

        // Because it requires more complex management of local variables names,
        // and we don't expect this to actually happen with properly designed
        // lexicons documents, we do not support this for now.

        throw new Error(
          'Import of definitions with unsafe type names is not supported',
        )
      }

      // import * as <nsIdentifier> from './<moduleSpecifier>'
      const nsIdentifier = this.getNsIdentifier(nsid, moduleSpecifier)

      return {
        varName: isValidJsIdentifier(publicIds.varName)
          ? `${nsIdentifier}.${publicIds.varName}`
          : `${nsIdentifier}[${JSON.stringify(publicIds.varName)}]`,
        typeName: `${nsIdentifier}.${publicIds.typeName}`,
      }
    },
  )

  private getNsIdentifier(nsid: string, moduleSpecifier: string) {
    const namespaceImportDeclaration =
      this.file.getImportDeclaration(
        (imp) =>
          !imp.isTypeOnly() &&
          imp.getModuleSpecifierValue() === moduleSpecifier &&
          imp.getNamespaceImport() != null,
      ) ||
      this.file.addImportDeclaration({
        moduleSpecifier,
        namespaceImport: this.computeSafeNamespaceIdentifierFor(nsid),
      })

    return namespaceImportDeclaration.getNamespaceImport()!.getText()
  }

  #nsIdentifiersCounters = new Map<string, number>()
  private computeSafeNamespaceIdentifierFor(nsid: string) {
    const baseName = nsidToIdentifier(nsid) || 'NS'

    let name = baseName
    while (this.isConflictingIdentifier(name)) {
      const count = this.#nsIdentifiersCounters.get(baseName) ?? 0
      this.#nsIdentifiersCounters.set(baseName, count + 1)
      name = `${baseName}$$${count}`
    }

    return name
  }

  private isConflictingIdentifier(name: string) {
    return (
      this.conflictsWithKeywords(name) ||
      this.conflictsWithUtils(name) ||
      this.conflictsWithLocalDefs(name) ||
      this.conflictsWithLocalDeclarations(name) ||
      this.conflictsWithImports(name)
    )
  }

  private conflictsWithKeywords(name: string) {
    return isJsKeyword(name) || isGlobalIdentifier(name)
  }

  private conflictsWithUtils(name: string) {
    // Do not allow "Main" as imported ns identifier since it has a special
    // meaning in the context of lexicon definitions.
    if (name === 'Main') return true

    // When "useRecordExport" returns true, an export named "Record" will be
    // used in addition to the hash named export. So we need to make sure both
    // names are not conflicting with local variables.
    if (name === 'Record') return true

    // Utility functions generated for lexicon schemas are prefixed with "$"
    return name.startsWith('$')
  }

  private conflictsWithLocalDefs(name: string) {
    return Object.keys(this.doc.defs).some((hash) => {
      const identifier = toCamelCase(hash)

      // A safe identifier will be generated, no risk of conflict.
      if (!identifier) return false

      // The imported name conflicts with a local definition name
      if (identifier === name || `_${identifier}` === name) return true

      // The imported name conflicts with the type name of a local definition
      const typeName = ucFirst(identifier)
      if (typeName === name || `_${typeName}` === name) return true

      return false
    })
  }

  private conflictsWithLocalDeclarations(name: string) {
    return (
      this.file.getVariableDeclarations().some((v) => v.getName() === name) ||
      this.file
        .getVariableStatements()
        .some((vs) => vs.getDeclarations().some((d) => d.getName() === name)) ||
      this.file.getTypeAliases().some((t) => t.getName() === name) ||
      this.file.getInterfaces().some((i) => i.getName() === name) ||
      this.file.getClasses().some((c) => c.getName() === name) ||
      this.file.getFunctions().some((f) => f.getName() === name) ||
      this.file.getEnums().some((e) => e.getName() === name)
    )
  }

  private conflictsWithImports(name: string) {
    return this.file.getImportDeclarations().some(
      (imp) =>
        // import name from '...'
        imp.getDefaultImport()?.getText() === name ||
        // import * as name from '...'
        imp.getNamespaceImport()?.getText() === name ||
        imp.getNamedImports().some(
          (named) =>
            // import { name } from '...'
            // import { foo as name } from '...'
            (named.getAliasNode()?.getText() ?? named.getName()) === name,
        ),
    )
  }
}

/**
 * @see {@link https://atproto.com/specs/nsid NSID syntax spec}
 */
function nsidToIdentifier(nsid: string) {
  const parts = nsid.split('.')

  // By default, try to keep only to the last two segments of the NSID as
  // contextual information. If those do not form a safe identifier (typically
  // because they start with a digit), try with more segments until we reach the
  // full NSID.
  for (let i = 2; i < parts.length; i++) {
    const identifier = toPascalCase(parts.slice(-i).join('.'))
    if (isSafeLocalIdentifier(identifier)) return identifier
  }

  return undefined
}

/**
 * Generates predictable public identifiers for a given definition hash.
 *
 * @note The returned `typeName` is guaranteed to be a valid TypeScript
 * identifier. `varName` may not be a valid identifier (eg. if the hash contains
 * unsafe characters), and may need to be accessed using string indexing.
 */
export function getPublicIdentifiers(hash: string): ResolvedRef {
  const varName = hash

  // @NOTE we try to circumvent the issue of unsafe type names described in
  // `RefResolver.resolveExternal` by ensuring that type names are always safe
  // identifiers, even if it means changing them from the original hash.
  let typeName = toPascalCase(hash)

  if (varName === typeName || !isValidJsIdentifier(typeName)) {
    typeName = `TypeOf${typeName}`
  }

  assert(
    isValidJsIdentifier(typeName),
    `Unable to generate a predictable safe identifier for "${hash}"`,
  )

  return { varName, typeName }
}

function asSafeDefinitionIdentifier(name: string) {
  if (
    startsWithLower(name) &&
    isSafeLocalIdentifier(name) &&
    isSafeLocalIdentifier(ucFirst(name))
  ) {
    return name
  }
  const camel = toCamelCase(name)
  if (isSafeLocalIdentifier(camel) && isSafeLocalIdentifier(ucFirst(camel))) {
    return camel
  }
  return undefined
}
