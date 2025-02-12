export async function callAsync<F extends (...args: any[]) => unknown>(
  this: ThisParameterType<F>,
  fn: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>>>
export async function callAsync<F extends (...args: any[]) => unknown>(
  this: ThisParameterType<F>,
  fn?: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>> | undefined>
export async function callAsync<F extends (...args: any[]) => unknown>(
  this: ThisParameterType<F>,
  fn?: F,
  ...args: Parameters<F>
): Promise<Awaited<ReturnType<F>> | undefined> {
  return (await fn?.(...args)) as Awaited<ReturnType<F>> | undefined
}
