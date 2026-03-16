export interface ImageInvalidator {
  invalidate(subject: string, paths: string[]): Promise<void>
}
