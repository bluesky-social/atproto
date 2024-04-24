export type Fetch = (
  this: void | null | typeof globalThis,
  input: Request,
) => Promise<Response>
