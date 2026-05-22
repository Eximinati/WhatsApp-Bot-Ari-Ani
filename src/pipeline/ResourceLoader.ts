import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import RuntimeClient from '../core/RuntimeClient.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default class ResourceLoader {
    path = join(__dirname, '..', '..', 'assets')

    constructor(public client: RuntimeClient) {}

    loadAssets = (): void => {
        const files = this.client.util.readdirRecursive(this.path)
        this.client.log('Loading assets...')
        files.map((file) => {
            const buffer = readFileSync(file)
            const split = file.split(/[\\/]/)
            const key = split[split.length - 1].split('.')[0]
            this.client.setAsset(key, buffer)
            this.client.log(`Loaded: ${key} from ${file}`)
        })
        this.client.log(`Loaded ${this.client.getAssetCount()} assets`)
    }
}