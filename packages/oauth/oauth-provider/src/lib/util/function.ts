export async function callAsync<F extends (...args: any[]) => unknown>(
  this: ThisParameterType<F>,
  fn: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>>> {
  return await (fn(...args) as ReturnType<F>)
}
