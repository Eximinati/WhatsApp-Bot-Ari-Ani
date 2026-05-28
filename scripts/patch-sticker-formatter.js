// Patch wa-sticker-formatter for file-type@21+ compatibility
// file-type@19+ removed fromBuffer() export, replaced with FileTypeParser class
// This script rewrites the fromBuffer call in Sticker.js to use the new API

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const stickerPath = join(__dirname, '..', 'node_modules', 'wa-sticker-formatter', 'dist', 'Sticker.js')

try {
    let content = readFileSync(stickerPath, 'utf8')
    
    // Check if already patched
    if (content.includes('_fromBuffer')) {
        console.log('[patch:wa-sticker-formatter] Already patched, skipping.')
        process.exit(0)
    }

    // Get the file-type version installed
    const pkgPath = join(__dirname, '..', 'node_modules', 'file-type', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const version = pkg.version
    const major = parseInt(version.split('.')[0])

    if (major < 19) {
        console.log(`[patch:wa-sticker-formatter] file-type@${version} already compatible, skipping.`)
        process.exit(0)
    }

    console.log(`[patch:wa-sticker-formatter] Patching for file-type@${version} (v${major})...`)

    // Add compatibility shim after the require line
    content = content.replace(
        'const file_type_1 = require("file-type");',
        `const file_type_1 = require("file-type");
// Patched for file-type v21+ compatibility: fromBuffer → FileTypeParser.fromBuffer
const _fileTypeParser = new file_type_1.FileTypeParser();
const _fromBuffer = (buf) => _fileTypeParser.fromBuffer(buf);`
    )

    // Replace the fromBuffer call
    content = content.replace(
        /const type = yield \(0, file_type_1\.fromBuffer\)\(data\);/,
        'const type = yield (0, _fromBuffer)(data);'
    )

    writeFileSync(stickerPath, content)
    console.log('[patch:wa-sticker-formatter] Patch applied successfully.')
} catch (err) {
    console.error('[patch:wa-sticker-formatter] Failed:', err.message)
    process.exit(1)
}