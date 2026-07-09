import type { UseQueryResult } from '@tanstack/react-query'
import ReactJson from 'react-json-view'
import { useIsDarkMode } from '../lib/use-is-dark-mode.ts'

export function JsonQueryResult<T>({
  result,
  transform,
}: {
  result: UseQueryResult<T>
  transform?: (data: T) => object
}) {
  const isDarkMode = useIsDarkMode()

  return (
    <div className="overflow-auto">
      {result.data !== undefined ? (
        result.data === null ? (
          'null'
        ) : (
          <ReactJson
            src={transform ? transform(result.data) : result.data}
            theme={isDarkMode ? 'bright' : 'bright:inverted'}
            indentWidth={2}
            displayDataTypes={false}
            name={false}
            quotesOnKeys={false}
            displayObjectSize={false}
            enableClipboard={false}
            collapsed={1}
          />
        )
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
