import { UseQueryResult } from '@tanstack/react-query'
import ReactJson from 'react-json-view'

export function JsonQueryResult<T>({
  result,
  transform,
}: {
  result: UseQueryResult<T>
  transform?: (data: T) => object
}) {
  return (
    <div className="overflow-auto">
      {result.data !== undefined ? (
        result.data === null ? (
          'null'
        ) : (
          <ReactJson
            src={transform ? transform(result.data) : result.data}
            indentWidth={2}
            displayDataTypes={false}
            name={false}
            quotesOnKeys={false}
            displayObjectSize={false}
            enableClipboard={false}
            collapsed
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
