const BufferJSON = {
    replacer: (_: string, value: unknown): unknown => {
        if (Buffer.isBuffer(value)) {
            return { type: "Buffer", data: value.toString("base64") }
        }
        if (value instanceof Uint8Array) {
            return { type: "Buffer", data: Buffer.from(value).toString("base64") }
        }
        if (value && (value as { type?: string }).type === "Buffer" && Array.isArray((value as { data?: unknown[] }).data)) {
            return { type: "Buffer", data: Buffer.from((value as { data: number[] }).data).toString("base64") }
        }
        return value
    },
    reviver: (_: string, value: unknown): unknown => {
        if (value && (value as { type?: string }).type === "Buffer") {
            return Buffer.from((value as { data: string }).data, "base64")
        }
        return value
    }
}

export { BufferJSON }