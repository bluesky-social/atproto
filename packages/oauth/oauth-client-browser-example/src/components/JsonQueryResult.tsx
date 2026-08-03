import type { UseQueryResult } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useIsDarkMode } from '../lib/use-is-dark-mode.ts'

export function JsonQueryResult<T>({
  result,
  transform,
}: {
  result: UseQueryResult<T>
  transform?: (data: T) => object
}) {
  const isDarkMode = useIsDarkMode()
  const dataString = useMemo(() => {
    if (result.data === undefined) return undefined
    if (result.data === null) return 'null'
    return JSON.stringify(
      transform ? transform(result.data) : result.data,
      null,
      2,
    )
  }, [result.data, transform])

  return (
    <div className="overflow-auto">
      {result.data !== undefined ? (
        <code className="block whitespace-pre-wrap">
          <pre
            className={`rounded-md border p-2 ${
              isDarkMode ? 'bg-slate-900' : 'bg-slate-100'
            }`}
          >
            {dataString}
          </pre>
        </code>
      ) : result.isLoading ? (
        <p>Loading...</p>
      ) : result.isError ? (
        <p>Error: {String(result.error)}</p>
      ) : (
        <p>Error: no-data</p>
      )}
    </div>
  )
}
