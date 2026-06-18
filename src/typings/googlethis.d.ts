declare module 'googlethis' {
    interface ImageResult {
        url: string
        [key: string]: unknown
    }

    interface GoogleThis {
        image(term: string, options?: { safe?: boolean }): Promise<ImageResult[]>
    }

    const google: GoogleThis
    export default google
    export { ImageResult, GoogleThis }
}
