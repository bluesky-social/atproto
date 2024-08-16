export function handleRequest<T>(
  request: IDBRequest<T>,
  onSuccess: (result: T) => void,
  onError: (error: Error) => void,
) {
  const cleanup = () => {
    request.removeEventListener('success', success)
    request.removeEventListener('error', error)
  }
  const success = () => {
    onSuccess(request.result)
    cleanup()
  }
  const error = () => {
    onError(request.error || new Error('Unknown error'))
    cleanup()
  }
  request.addEventListener('success', success)
  request.addEventListener('error', error)
}

export function promisify<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    handleRequest(request, resolve, reject)
  })
}
