import { TransportAudit, type TransportAuditReport } from './TransportAudit.js'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function readdirRecursive(dir: string): string[] {
    const results: string[] = []
    const items = readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
        const fullPath = join(dir, item.name)
        if (item.isDirectory()) {
            results.push(...readdirRecursive(fullPath))
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.js'))) {
            results.push(fullPath)
        }
    }
    return results
}

export async function runTransportAudit(): Promise<TransportAuditReport> {
    const audit = new TransportAudit()
    const commandsDir = join(__dirname, '../../..', 'src', 'commands')

    const files = readdirRecursive(commandsDir)
    const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('_Command_Example.ts'))

    const commands: { file: string; name: string; lines: { line: number; content: string }[] }[] = []

    for (const file of tsFiles) {
        try {
            const content = readFileSync(file, 'utf-8')
            const lines = content.split('\n').map((line, idx) => ({ line: idx + 1, content: line }))

            let commandName = ''
            const commandMatch = content.match(/command:\s*['"]([^'"]+)['"]/)
            if (commandMatch) {
                commandName = commandMatch[1]
            }

            if (commandName) {
                commands.push({
                    file: file.replace(/\\/g, '/').split('src/')[1] || file,
                    name: commandName,
                    lines
                })
            }
        } catch (err) {
            console.error(`Failed to read ${file}:`, err)
        }
    }

    audit.runAudit(commands)
    const report = audit.getReport()

    console.log(audit.printReport(report))

    return report
}

export { TransportAudit } from './TransportAudit.js'
export type { TransportViolation, CommandTransportInfo, TransportSafetyLevel, TransportBypassType } from './TransportAudit.js'