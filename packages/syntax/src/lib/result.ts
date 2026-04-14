export type Result<T> = Success<T> | Failure

export type Success<T> = { success: true; value: T }
export function success<T>(value: T): Success<T> {
  return { success: true, value }
}

export type Failure = { success: false; message: string }
export function failure(message: string): Failure {
  return { success: false, message }
}
