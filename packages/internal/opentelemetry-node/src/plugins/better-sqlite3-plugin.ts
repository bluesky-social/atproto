/*!
 * Port of opentelemetry-plugin-better-sqlite3@1.13.0
 * https://github.com/sjinks/opentelemetry-plugin-better-sqlite3
 *
 * MIT License
 *
 * Copyright (c) Volodymyr Kolesnykov <volodymyr@wildwolf.name>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
  type Span,
  SpanKind,
  SpanStatusCode,
  context,
  diag,
  trace,
} from '@opentelemetry/api'
import {
  InstrumentationBase,
  type InstrumentationConfig,
  type InstrumentationModuleDefinition,
  InstrumentationNodeModuleDefinition,
  isWrapped,
} from '@opentelemetry/instrumentation'
import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_SYSTEM_NAME,
} from '@opentelemetry/semantic-conventions'
import type SqliteDB from 'better-sqlite3'

// @NOTE Ported rather than depended upon so that it is built on this package's
// own @opentelemetry/instrumentation (hence import-in-the-middle) copy: setup()
// only wraps ESM imports of the modules reported by instrumentations sharing
// that copy. The instrumentation scope, span names, kinds and attributes are
// kept identical to upstream, which existing dashboards rely on.

// @NOTE "@types/better-sqlite3" is a dev dependency: keep these types out of
// the public API, or consumers will need it too.
type Database = SqliteDB.Database
type Statement = SqliteDB.Statement
type StatementMethodName = 'run' | 'get' | 'all'
type StatementMethod = Statement[StatementMethodName]

// @NOTE The CommonJS exports when required, the ESM namespace when imported.
type BetterSqlite3Exports = typeof SqliteDB | { default: typeof SqliteDB }

const SUPPORTED_VERSIONS = [
  '^7.0.0',
  '^8.0.0',
  '^9.0.0',
  '^10.0.0',
  '^11.0.0',
  '^12.0.0',
]

const STATEMENT_METHODS: StatementMethodName[] = ['run', 'get', 'all']

/**
 * Traces `better-sqlite3` queries: `Database` `exec()`, `pragma()` and
 * `prepare()` calls, and the `run()`, `get()` and `all()` calls of the
 * statements `prepare()` returns.
 *
 * @example
 * ```ts
 * import { setup } from '@atproto-labs/opentelemetry-node'
 * import { BetterSqlite3Instrumentation } from '@atproto-labs/opentelemetry-node/better-sqlite3-plugin'
 *
 * await setup(() => ({
 *   name: 'my-service',
 *   version: '1.0.0',
 *   instrumentations: [new BetterSqlite3Instrumentation()],
 * }))
 * ```
 */
export class BetterSqlite3Instrumentation extends InstrumentationBase {
  static readonly COMPONENT = 'better-sqlite3'

  constructor(config?: InstrumentationConfig) {
    super('opentelemetry-instrumentation-better-sqlite3', '1.0.0', config ?? {})
  }

  protected init(): InstrumentationModuleDefinition[] {
    return [
      new InstrumentationNodeModuleDefinition(
        'better-sqlite3',
        SUPPORTED_VERSIONS,
        (moduleExports: BetterSqlite3Exports, moduleVersion?: string) => {
          diag.debug(`Applying patch for better-sqlite3@${moduleVersion}`)
          const proto = getDatabasePrototype(moduleExports)
          if (!isWrapped(proto.exec)) {
            this._wrap(proto, 'exec', (exec) => this.patchExec(exec))
            this._wrap(proto, 'prepare', (prepare) =>
              this.patchPrepare(prepare),
            )
            this._wrap(proto, 'pragma', (pragma) => this.patchPragma(pragma))
          }
          return moduleExports
        },
        (moduleExports?: BetterSqlite3Exports, moduleVersion?: string) => {
          if (moduleExports !== undefined) {
            diag.debug(`Removing patch for better-sqlite3@${moduleVersion}`)
            this._massUnwrap(
              [getDatabasePrototype(moduleExports)],
              ['exec', 'prepare', 'pragma'],
            )
          }
        },
      ),
    ]
  }

  private createSpan(query: string, db: Database, operation?: string): Span {
    const statement = query.trim().split(/\s/u)[0]
    const spanName = operation ? `${operation}: ${statement}` : statement
    return this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_DB_SYSTEM_NAME]: 'sqlite3',
        [ATTR_DB_QUERY_TEXT]: query,
        [ATTR_DB_NAMESPACE]: db.name,
      },
    })
  }

  private patchExec(original: Database['exec']): Database['exec'] {
    return wrapInSpan(original, (db: Database, [source]) =>
      this.createSpan(source, db),
    )
  }

  private patchPragma(original: Database['pragma']): Database['pragma'] {
    return wrapInSpan(original, (db: Database, [source]) =>
      this.createSpan(`PRAGMA ${source}`, db),
    )
  }

  private patchPrepare(original: Database['prepare']): Database['prepare'] {
    const prepare = wrapInSpan(original, (db: Database, [source]) =>
      this.createSpan(source, db, 'prepare'),
    )
    const patchStatement = (statement: Statement) => {
      this._massWrap([statement], STATEMENT_METHODS, (method) =>
        this.patchStatement(method),
      )
    }
    return function (this: Database, ...args) {
      const statement = prepare.apply(this, args)
      patchStatement(statement)
      return statement
    } as Database['prepare']
  }

  private patchStatement(original: StatementMethod): StatementMethod {
    // @NOTE Native methods are named after the property they are wrapped as
    const method = original.name as StatementMethodName
    const traced = wrapInSpan(original, (statement: Statement) =>
      this.createSpan(statement.source, statement.database, method),
    )
    const isEnabled = () => this.isEnabled()
    const unwrap = (statement: Statement) => this._unwrap(statement, method)
    return function (this: Statement, ...args) {
      if (isEnabled()) return traced.apply(this, args)
      unwrap(this)
      return original.apply(this, args)
    }
  }
}

function getDatabasePrototype(moduleExports: BetterSqlite3Exports): Database {
  return 'prototype' in moduleExports
    ? moduleExports.prototype
    : moduleExports.default.prototype
}

/**
 * Wraps `method` so that each call runs within the span returned by
 * `startSpan`, which ends with the call and reflects its outcome.
 */
function wrapInSpan<This, Args extends unknown[], Result>(
  method: (this: This, ...args: Args) => Result,
  startSpan: (target: This, args: Args) => Span,
): (this: This, ...args: Args) => Result {
  return function (this: This, ...args: Args): Result {
    const span = startSpan(this, args)
    return context.with(trace.setSpan(context.active(), span), () => {
      try {
        const result = method.apply(this, args)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error).message,
        })
        throw err
      } finally {
        span.end()
      }
    })
  }
}
