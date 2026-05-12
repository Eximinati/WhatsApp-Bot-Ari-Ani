import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import { migrateShipData } from '../../core/Ship/migrate.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'shipmigrate',
            description:
                'One-off migration: normalizes JIDs and recomputes ship scores',
            category: 'dev',
            dm: true,
            modsOnly: true,
            usage: `${client.config.prefix}shipmigrate`,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        await M.reply('🔧 Running ship data migration...')

        try {
            const report = await migrateShipData(this.client)

            const text =
`✅ Ship migration complete

BONDS
• Scanned: ${report.bondsScanned}
• Rekeyed: ${report.bondsRekeyed}
• Merged: ${report.bondsMerged}
• Base updated: ${report.bondsBaseUpdated}

RIZZ
• Scanned: ${report.rizzScanned}
• Rekeyed: ${report.rizzRekeyed}
• Merged: ${report.rizzMerged}
• Base updated: ${report.rizzBaseUpdated}`

            await M.reply(text)
        } catch (err) {
            await M.reply(`❌ Migration failed: ${String(err)}`)
        }
    }
}
