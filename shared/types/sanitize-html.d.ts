declare module 'sanitize-html' {
  export interface IOptions {
    [key: string]: unknown
  }

  export default function sanitizeHtml(dirty: string, options?: IOptions): string
}
