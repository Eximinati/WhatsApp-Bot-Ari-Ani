import { unlink } from 'fs/promises'

export const safeUnlink = async (path: string): Promise<void> => {
    try { await unlink(path) } catch { /* ignore */ }
}

export const fireAndForget = (promise: Promise<unknown>): void => {
    void promise.catch(() => undefined)
}
