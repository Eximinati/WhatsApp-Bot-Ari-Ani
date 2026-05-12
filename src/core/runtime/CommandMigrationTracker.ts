export type MigrationStatus = 'migrated' | 'shadow' | 'legacy' | 'not_started'
export type OwnershipType = 'runtime' | 'legacy' | 'unknown'

export interface CommandMigrationInfo {
    command: string
    file: string
    category: string
    owner: OwnershipType
    migrationStatus: MigrationStatus
    shadowTestStatus: 'not_started' | 'in_progress' | 'passed' | 'failed' | 'partial'
    runtimeAuthoritative: boolean
    transportSafe: boolean
    determinismSafe: boolean
    lastTested: number | null
    shadowTestCount: number
    divergenceRate: number
    blockingIssues: string[]
    notes: string[]
}

export interface MigrationSummary {
    totalCommands: number
    migrated: number
    shadow: number
    legacy: number
    notStarted: number
    runtimeAuthoritativeCount: number
    transportSafeCount: number
    determinismSafeCount: number
    unsafeCommands: string[]
    shadowReadyCommands: string[]
    commandsUsingLegacyPipeline: string[]
    migrationProgressPct: number
}

export interface MigrationReadinessReport {
    generatedAt: number
    summary: MigrationSummary
    commands: CommandMigrationInfo[]
    recommendations: { command: string; action: string; priority: 'high' | 'medium' | 'low' }[]
    blockers: { command: string; blocker: string; severity: 'critical' | 'high' | 'medium' }[]
}

export class CommandMigrationTracker {
    private commands: Map<string, CommandMigrationInfo> = new Map()
    private history: { timestamp: number; command: string; status: MigrationStatus; note: string }[] = []

    registerCommand(info: Partial<CommandMigrationInfo> & { command: string; file: string }): void {
        const existing = this.commands.get(info.command)

        const cmd: CommandMigrationInfo = {
            command: info.command,
            file: info.file,
            category: info.category || 'general',
            owner: info.owner || 'unknown',
            migrationStatus: info.migrationStatus || 'not_started',
            shadowTestStatus: info.shadowTestStatus || 'not_started',
            runtimeAuthoritative: info.runtimeAuthoritative ?? false,
            transportSafe: info.transportSafe ?? false,
            determinismSafe: info.determinismSafe ?? false,
            lastTested: info.lastTested ?? null,
            shadowTestCount: info.shadowTestCount ?? 0,
            divergenceRate: info.divergenceRate ?? 0,
            blockingIssues: info.blockingIssues ?? [],
            notes: info.notes ?? []
        }

        if (existing) {
            cmd.shadowTestCount = existing.shadowTestCount
            cmd.lastTested = existing.lastTested
            cmd.divergenceRate = existing.divergenceRate
        }

        this.commands.set(info.command, cmd)
    }

    updateShadowTest(command: string, status: CommandMigrationInfo['shadowTestStatus'], divergenceRate?: number): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        cmd.shadowTestStatus = status
        cmd.lastTested = Date.now()
        cmd.shadowTestCount++

        if (divergenceRate !== undefined) {
            cmd.divergenceRate = divergenceRate
        }

        if (status === 'passed') {
            cmd.runtimeAuthoritative = true
        }

        this.history.push({
            timestamp: Date.now(),
            command,
            status: cmd.migrationStatus,
            note: `Shadow test updated: ${status}`
        })
    }

    updateMigrationStatus(command: string, status: MigrationStatus): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        const prev = cmd.migrationStatus
        cmd.migrationStatus = status

        this.history.push({
            timestamp: Date.now(),
            command,
            status,
            note: `Migration status changed from ${prev} to ${status}`
        })
    }

    markTransportSafe(command: string, safe: boolean, reason?: string): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        cmd.transportSafe = safe
        if (reason) {
            cmd.notes.push(`Transport safety: ${reason}`)
        }
    }

    markDeterminismSafe(command: string, safe: boolean, reason?: string): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        cmd.determinismSafe = safe
        if (reason) {
            cmd.notes.push(`Determinism safety: ${reason}`)
        }
    }

    addBlockingIssue(command: string, issue: string, severity: 'critical' | 'high' | 'medium' = 'high'): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        const existing = cmd.blockingIssues.find(i => i.includes(issue))
        if (!existing) {
            cmd.blockingIssues.push(`[${severity}] ${issue}`)
        }
    }

    setRuntimeAuthoritative(command: string, authoritative: boolean): void {
        const cmd = this.commands.get(command)
        if (!cmd) return

        cmd.runtimeAuthoritative = authoritative
    }

    loadFromAudit(audit: { command: string; file: string; migrationStatus: MigrationStatus; transportSafe: boolean }[]): void {
        for (const item of audit) {
            const existing = this.commands.get(item.command)
            this.registerCommand({
                command: item.command,
                file: item.file,
                migrationStatus: item.migrationStatus,
                transportSafe: item.transportSafe
            })

            if (existing) {
                const cmd = this.commands.get(item.command)!
                cmd.shadowTestCount = existing.shadowTestCount
                cmd.lastTested = existing.lastTested
                cmd.divergenceRate = existing.divergenceRate
                cmd.blockingIssues = existing.blockingIssues
                cmd.notes = existing.notes
            }
        }
    }

    getCommand(command: string): CommandMigrationInfo | undefined {
        return this.commands.get(command)
    }

    getAllCommands(): CommandMigrationInfo[] {
        return [...this.commands.values()]
    }

    getMigrationSummary(): MigrationSummary {
        let migrated = 0
        let shadow = 0
        let legacy = 0
        let notStarted = 0
        let runtimeAuthoritativeCount = 0
        let transportSafeCount = 0
        let determinismSafeCount = 0
        const unsafeCommands: string[] = []
        const shadowReadyCommands: string[] = []
        const commandsUsingLegacyPipeline: string[] = []

        for (const [_, cmd] of this.commands) {
            if (cmd.migrationStatus === 'migrated') migrated++
            else if (cmd.migrationStatus === 'shadow') shadow++
            else if (cmd.migrationStatus === 'legacy') legacy++
            else notStarted++

            if (cmd.runtimeAuthoritative) runtimeAuthoritativeCount++
            if (cmd.transportSafe) transportSafeCount++
            if (cmd.determinismSafe) determinismSafeCount++

            if (!cmd.transportSafe || cmd.blockingIssues.length > 0) {
                unsafeCommands.push(cmd.command)
            }

            if (cmd.shadowTestStatus === 'passed' && cmd.migrationStatus === 'shadow') {
                shadowReadyCommands.push(cmd.command)
            }

            if (cmd.migrationStatus === 'legacy' || cmd.owner === 'legacy') {
                commandsUsingLegacyPipeline.push(cmd.command)
            }
        }

        const total = this.commands.size
        const migratedPct = total > 0 ? (migrated / total) * 100 : 0

        return {
            totalCommands: total,
            migrated,
            shadow,
            legacy,
            notStarted,
            runtimeAuthoritativeCount,
            transportSafeCount,
            determinismSafeCount,
            unsafeCommands,
            shadowReadyCommands,
            commandsUsingLegacyPipeline,
            migrationProgressPct: migratedPct
        }
    }

    generateReport(): MigrationReadinessReport {
        const summary = this.getMigrationSummary()
        const commands = this.getAllCommands()

        const recommendations: { command: string; action: string; priority: 'high' | 'medium' | 'low' }[] = []
        const blockers: { command: string; blocker: string; severity: 'critical' | 'high' | 'medium' }[] = []

        for (const cmd of commands) {
            if (cmd.migrationStatus === 'legacy' && !cmd.transportSafe) {
                recommendations.push({
                    command: cmd.command,
                    action: 'Migrate from legacy pipeline - transport unsafe',
                    priority: 'high'
                })
            }

            if (cmd.migrationStatus === 'shadow' && cmd.shadowTestStatus === 'passed') {
                recommendations.push({
                    command: cmd.command,
                    action: 'Promote to migrated - shadow tests passed',
                    priority: 'medium'
                })
            }

            if (cmd.blockingIssues.length > 0) {
                for (const issue of cmd.blockingIssues) {
                    const severity = issue.startsWith('[critical]') ? 'critical' : issue.startsWith('[high]') ? 'high' : 'medium'
                    blockers.push({
                        command: cmd.command,
                        blocker: issue,
                        severity
                    })
                }
            }

            if (!cmd.determinismSafe && cmd.migrationStatus !== 'not_started') {
                recommendations.push({
                    command: cmd.command,
                    action: 'Verify determinism - replay may not be safe',
                    priority: 'medium'
                })
            }
        }

        return {
            generatedAt: Date.now(),
            summary,
            commands,
            recommendations,
            blockers
        }
    }

    printReport(report: MigrationReadinessReport): string {
        const lines: string[] = []
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('               COMMAND MIGRATION TRACKER REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
        lines.push('')

        lines.push('─────────────────── MIGRATION SUMMARY ───────────────────')
        lines.push(`Total Commands: ${report.summary.totalCommands}`)
        lines.push(`  Migrated: ${report.summary.migrated}`)
        lines.push(`  Shadow: ${report.summary.shadow}`)
        lines.push(`  Legacy: ${report.summary.legacy}`)
        lines.push(`  Not Started: ${report.summary.notStarted}`)
        lines.push('')
        lines.push(`Migration Progress: ${report.summary.migrationProgressPct.toFixed(1)}%`)
        lines.push('')

        lines.push('─────────────────── SAFETY METRICS ───────────────────')
        lines.push(`Runtime Authoritative: ${report.summary.runtimeAuthoritativeCount}`)
        lines.push(`Transport Safe: ${report.summary.transportSafeCount}`)
        lines.push(`Determinism Safe: ${report.summary.determinismSafeCount}`)
        lines.push('')

        if (report.summary.shadowReadyCommands.length > 0) {
            lines.push('─────────────────── SHADOW READY (CAN PROMOTE) ───────────────────')
            for (const cmd of report.summary.shadowReadyCommands) {
                const info = this.commands.get(cmd)
                lines.push(`  ${cmd} (${info?.shadowTestCount || 0} shadow tests, ${((info?.divergenceRate || 0) * 100).toFixed(1)}% divergence)`)
            }
            lines.push('')
        }

        if (report.summary.commandsUsingLegacyPipeline.length > 0) {
            lines.push(`─────────────────── USING LEGACY PIPELINE (${report.summary.commandsUsingLegacyPipeline.length}) ───────────────────`)
            for (const cmd of report.summary.commandsUsingLegacyPipeline.slice(0, 20)) {
                lines.push(`  ${cmd}`)
            }
            if (report.summary.commandsUsingLegacyPipeline.length > 20) {
                lines.push(`  ... and ${report.summary.commandsUsingLegacyPipeline.length - 20} more`)
            }
            lines.push('')
        }

        if (report.blockers.length > 0) {
            lines.push('─────────────────── BLOCKING ISSUES ───────────────────')
            const critical = report.blockers.filter(b => b.severity === 'critical')
            const high = report.blockers.filter(b => b.severity === 'high')
            const medium = report.blockers.filter(b => b.severity === 'medium')

            if (critical.length > 0) {
                lines.push('CRITICAL:')
                for (const b of critical) {
                    lines.push(`  ${b.command}: ${b.blocker}`)
                }
            }
            if (high.length > 0) {
                lines.push('HIGH:')
                for (const b of high.slice(0, 10)) {
                    lines.push(`  ${b.command}: ${b.blocker}`)
                }
                if (high.length > 10) lines.push(`  ... and ${high.length - 10} more`)
            }
            lines.push('')
        }

        if (report.recommendations.length > 0) {
            lines.push('─────────────────── RECOMMENDATIONS ───────────────────')
            const high = report.recommendations.filter(r => r.priority === 'high')
            const medium = report.recommendations.filter(r => r.priority === 'medium')

            if (high.length > 0) {
                lines.push('HIGH PRIORITY:')
                for (const r of high.slice(0, 10)) {
                    lines.push(`  ${r.command}: ${r.action}`)
                }
                if (high.length > 10) lines.push(`  ... and ${high.length - 10} more`)
            }
            if (medium.length > 0) {
                lines.push('MEDIUM PRIORITY:')
                for (const r of medium.slice(0, 10)) {
                    lines.push(`  ${r.command}: ${r.action}`)
                }
                if (medium.length > 10) lines.push(`  ... and ${medium.length - 10} more`)
            }
            lines.push('')
        }

        lines.push('═══════════════════════════════════════════════════════════════')
        return lines.join('\n')
    }

    getUnsafeCommands(): CommandMigrationInfo[] {
        return [...this.commands.values()].filter(c => !c.transportSafe || c.blockingIssues.length > 0)
    }

    getMigrationProgress(): { migrated: number; total: number; percentage: number } {
        const summary = this.getMigrationSummary()
        return {
            migrated: summary.migrated,
            total: summary.totalCommands,
            percentage: summary.migrationProgressPct
        }
    }

    getHistory(): { timestamp: number; command: string; status: MigrationStatus; note: string }[] {
        return [...this.history]
    }

    reset(): void {
        this.commands.clear()
        this.history = []
    }
}

export function createCommandMigrationTracker(): CommandMigrationTracker {
    return new CommandMigrationTracker()
}