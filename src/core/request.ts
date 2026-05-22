import axios, { AxiosRequestConfig } from 'axios'

const request = {
    json: async <T>(url: string): Promise<T> => (await axios.get<T>(url, { timeout: 15_000 })).data,
    buffer: async (url: string): Promise<Buffer> =>
        (await axios.get<Buffer>(url, { responseType: 'arraybuffer', timeout: 15_000 })).data
}

export const post = async <T>(
    url: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    data: any,
    config?: AxiosRequestConfig
): Promise<T extends null ? { [key: string]: string | number | boolean } : T> =>
    await axios.post(url, data, { timeout: 15_000, ...(config || {}) })

export const firstOk = async <T>(
    providers: Array<() => Promise<T>>
): Promise<{ ok: true; value: T } | { ok: false }> => {
    for (const provider of providers) {
        try {
            return { ok: true as const, value: await provider() }
        } catch {
            continue
        }
    }
    return { ok: false }
}

export default request
