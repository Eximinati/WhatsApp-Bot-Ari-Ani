export type TransportSafetyLevel = 'safe' | 'warning' | 'unsafe' | 'critical'
export type TransportBypassType =
    | 'M.reply'
    | 'client.sendMessage'
    | 'client.sendPresenceUpdate'
    | 'directSocket'
    | 'client.groupAdd'
    | 'client.groupRemove'
    | 'client.groupUpdate'
    | 'unknown'

export interface TransportViolation {
    file: string
    line: number
    command: string
    bypassType: TransportBypassType
    severity: TransportSafetyLevel
    description: string
    bypassesKernel: boolean
    bypassesTransportIntent: boolean
    bypassesMiddleware: boolean
    bypassesCommitRegistry: boolean
}

export interface CommandTransportInfo {
    command: string
    file: string
    hasTransportIntent: boolean
    usesMReply: boolean
    usesDirectSend: boolean
    safetyLevel: TransportSafetyLevel
    migrationStatus: 'migrated' | 'shadow' | 'legacy'
    violationCount: number
}

export interface TransportAuditReport {
    generatedAt: number
    totalCommands: number
    safeCommands: number
    warningCommands: number
    unsafeCommands: number
    criticalCommands: number
    migrationReady: number
    notMigrationReady: number
    violationsByType: Record<TransportBypassType, number>
    violationsByFile: Record<string, number>
    commandsBySafetyLevel: Record<TransportSafetyLevel, string[]>
    commandsBypassingKernel: string[]
    criticalViolations: TransportViolation[]
    migrationRecommendations: { command: string; action: string; priority: 'high' | 'medium' | 'low' }[]
}

class CommandEntry {
    command: string
    file: string
    hasTransportIntent = false
    usesMReply = false
    usesDirectSend = false
    safetyLevel: TransportSafetyLevel = 'safe'
    migrationStatus: 'migrated' | 'shadow' | 'legacy' = 'legacy'
    violationCount = 0
    violations: TransportViolation[] = []

    constructor(command: string, file: string) {
        this.command = command
        this.file = file
    }
}

export class TransportAudit {
    private commands = new Map<string, CommandEntry>()

    private registerCommand(file: string, command: string): CommandEntry {
        let entry = this.commands.get(command)
        if (!entry) {
            entry = new CommandEntry(command, file)
            this.commands.set(command, entry)
        }
        return entry
    }

    private addViolation(entry: CommandEntry, v: TransportViolation): void {
        entry.violations.push(v)
        entry.violationCount++
        if (v.severity === 'critical') entry.safetyLevel = 'critical'
        else if (v.severity === 'unsafe' && entry.safetyLevel !== 'critical') entry.safetyLevel = 'unsafe'
        else if (v.severity === 'warning' && entry.safetyLevel === 'safe') entry.safetyLevel = 'warning'
    }

    runAudit(commands: { file: string; name: string; lines: { line: number; content: string }[] }[]): void {
        for (const cmd of commands) {
            const entry = this.registerCommand(cmd.file, cmd.name)
            const violations: TransportViolation[] = []

            for (const line of cmd.lines) {
                const content = line.content

                if (content.includes('M.reply') && !content.includes('context.transport') && !content.includes('transport.queue')) {
                    violations.push({
                        file: cmd.file,
                        line: line.line,
                        command: cmd.name,
                        bypassType: 'M.reply',
                        severity: 'unsafe',
                        description: 'Uses M.reply which bypasses RuntimeKernel transport intents',
                        bypassesKernel: true,
                        bypassesTransportIntent: true,
                        bypassesMiddleware: true,
                        bypassesCommitRegistry: true
                    })
                }

                if (content.includes('this.client.sendMessage') || content.includes('client.sendMessage(')) {
                    violations.push({
                        file: cmd.file,
                        line: line.line,
                        command: cmd.name,
                        bypassType: 'client.sendMessage',
                        severity: 'critical',
                        description: 'Direct client.sendMessage bypasses entire transport layer',
                        bypassesKernel: true,
                        bypassesTransportIntent: true,
                        bypassesMiddleware: true,
                        bypassesCommitRegistry: true
                    })
                }

                if (content.includes('groupAdd') || content.includes('groupAddParticipants')) {
                    violations.push({
                        file: cmd.file,
                        line: line.line,
                        command: cmd.name,
                        bypassType: 'client.groupAdd',
                        severity: 'critical',
                        description: 'Direct group add bypasses transport layer',
                        bypassesKernel: true,
                        bypassesTransportIntent: true,
                        bypassesMiddleware: true,
                        bypassesCommitRegistry: true
                    })
                }

                if (content.includes('groupRemove') || content.includes('groupRemoveParticipants')) {
                    violations.push({
                        file: cmd.file,
                        line: line.line,
                        command: cmd.name,
                        bypassType: 'client.groupRemove',
                        severity: 'critical',
                        description: 'Direct group remove bypasses transport layer',
                        bypassesKernel: true,
                        bypassesTransportIntent: true,
                        bypassesMiddleware: true,
                        bypassesCommitRegistry: true
                    })
                }
            }

            const hasTransportIntent = cmd.lines.some(l =>
                l.content.includes('context.transport') ||
                l.content.includes('transport.queue') ||
                l.content.includes('queueText') ||
                l.content.includes('queueMedia')
            )

            entry.hasTransportIntent = hasTransportIntent
            entry.migrationStatus = hasTransportIntent ? 'migrated' : violations.length > 0 ? 'legacy' : 'shadow'

            for (const v of violations) {
                this.addViolation(entry, v)
            }
        }
    }

    getReport(): TransportAuditReport {
        let safeCommands = 0
        let warningCommands = 0
        let unsafeCommands = 0
        let criticalCommands = 0
        let migrationReady = 0
        let notMigrationReady = 0

        const commandsBySafetyLevel: Record<TransportSafetyLevel, string[]> = {
            safe: [],
            warning: [],
            unsafe: [],
            critical: []
        }

        const violationsByType: Record<TransportBypassType, number> = {
            'M.reply': 0,
            'client.sendMessage': 0,
            'client.sendPresenceUpdate': 0,
            directSocket: 0,
            'client.groupAdd': 0,
            'client.groupRemove': 0,
            'client.groupUpdate': 0,
            unknown: 0
        }

        const violationsByFile: Record<string, number> = {}
        const commandsBypassingKernel: string[] = []
        const criticalViolations: TransportViolation[] = []

        for (const [_, cmd] of this.commands) {
            if (cmd.safetyLevel === 'safe') safeCommands++
            else if (cmd.safetyLevel === 'warning') warningCommands++
            else if (cmd.safetyLevel === 'unsafe') unsafeCommands++
            else if (cmd.safetyLevel === 'critical') criticalCommands++

            commandsBySafetyLevel[cmd.safetyLevel].push(cmd.command)

            if (cmd.migrationStatus === 'migrated') migrationReady++
            else notMigrationReady++

            for (const v of cmd.violations) {
                violationsByType[v.bypassType]++
                violationsByFile[v.file] = (violationsByFile[v.file] || 0) + 1
                if (v.bypassesKernel && !commandsBypassingKernel.includes(cmd.command)) {
                    commandsBypassingKernel.push(cmd.command)
                }
                if (v.severity === 'critical') criticalViolations.push(v)
            }
        }

        const migrationRecommendations: { command: string; action: string; priority: 'high' | 'medium' | 'low' }[] = []

        for (const [command, info] of this.commands) {
            if (info.safetyLevel === 'critical') {
                migrationRecommendations.push({ command, action: 'Migrate immediately - critical transport bypass', priority: 'high' })
            } else if (info.safetyLevel === 'unsafe') {
                migrationRecommendations.push({ command, action: 'Migrate - unsafe M.reply usage detected', priority: 'high' })
            } else if (info.safetyLevel === 'warning') {
                migrationRecommendations.push({ command, action: 'Review - consider transport intent usage', priority: 'medium' })
            }
        }

        return {
            generatedAt: Date.now(),
            totalCommands: this.commands.size,
            safeCommands,
            warningCommands,
            unsafeCommands,
            criticalCommands,
            migrationReady,
            notMigrationReady,
            violationsByType,
            violationsByFile,
            commandsBySafetyLevel,
            commandsBypassingKernel,
            criticalViolations,
            migrationRecommendations
        }
    }

    printReport(report: TransportAuditReport): string {
        const lines: string[] = []
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('                  TRANSPORT AUDIT REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
        lines.push('')

        lines.push('─────────────────── SAFETY SUMMARY ───────────────────')
        lines.push(`Total Commands: ${report.totalCommands}`)
        lines.push(`  Safe: ${report.safeCommands}`)
        lines.push(`  Warning: ${report.warningCommands}`)
        lines.push(`  Unsafe: ${report.unsafeCommands}`)
        lines.push(`  Critical: ${report.criticalCommands}`)
        lines.push('')

        lines.push('─────────────────── MIGRATION STATUS ───────────────────')
        lines.push(`Migration Ready: ${report.migrationReady}`)
        lines.push(`Not Migration Ready: ${report.notMigrationReady}`)
        if (report.totalCommands > 0) {
            const pct = ((report.migrationReady / report.totalCommands) * 100).toFixed(1)
            lines.push(`Migration Progress: ${pct}%`)
        }
        lines.push('')

        lines.push('─────────────────── VIOLATIONS BY TYPE ───────────────────')
        for (const [type, count] of Object.entries(report.violationsByType)) {
            if (count > 0) {
                lines.push(`  ${type}: ${count}`)
            }
        }
        lines.push('')

        if (report.criticalViolations.length > 0) {
            lines.push('─────────────────── CRITICAL VIOLATIONS ───────────────────')
            for (const v of report.criticalViolations) {
                lines.push(`  ${v.command} (${v.file}:${v.line})`)
                lines.push(`    Type: ${v.bypassType}`)
                lines.push('')
            }
        }

        if (report.commandsBypassingKernel.length > 0) {
            lines.push(`─────────────────── KERNEL BYPASSES (${report.commandsBypassingKernel.length}) ───────────────────`)
            for (const cmd of report.commandsBypassingKernel.slice(0, 30)) {
                lines.push(`  ${cmd}`)
            }
            lines.push('')
        }

        if (report.migrationRecommendations.length > 0) {
            lines.push('─────────────────── MIGRATION RECOMMENDATIONS ───────────────────')
            const high = report.migrationRecommendations.filter(r => r.priority === 'high')
            if (high.length > 0) {
                lines.push('HIGH PRIORITY:')
                for (const r of high.slice(0, 20)) {
                    lines.push(`  ${r.command}: ${r.action}`)
                }
            }
            lines.push('')
        }

        if (report.notMigrationReady > 0) {
            lines.push('─────────────────── NOT SAFE FOR PRODUCTION ───────────────────')
            lines.push(`⚠ ${report.notMigrationReady} commands bypass transport layer`)
            lines.push(`  - ${report.unsafeCommands} use M.reply (unsafe)`)
            lines.push(`  - ${report.criticalCommands} use direct client.sendMessage (critical)`)
            lines.push('')
        }

        lines.push('═══════════════════════════════════════════════════════════════')
        return lines.join('\n')
    }

    getUnsafeCommands(): string[] {
        return [...this.commands.values()]
            .filter(c => c.safetyLevel === 'unsafe' || c.safetyLevel === 'critical')
            .map(c => c.command)
    }

    getCriticalViolations(): TransportViolation[] {
        const result: TransportViolation[] = []
        for (const [_, cmd] of this.commands) {
            for (const v of cmd.violations) {
                if (v.severity === 'critical') result.push(v)
            }
        }
        return result
    }

    getSummary(): { total: number; safe: number; unsafe: number; critical: number; migrationReadyPct: number } {
        const report = this.getReport()
        return {
            total: report.totalCommands,
            safe: report.safeCommands,
            unsafe: report.unsafeCommands,
            critical: report.criticalCommands,
            migrationReadyPct: report.totalCommands > 0 ? (report.migrationReady / report.totalCommands) * 100 : 0
        }
    }

    reset(): void {
        this.commands.clear()
    }
}

export function createTransportAudit(): TransportAudit {
    return new TransportAudit()
}