import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ICommand, IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface CategoryInfo {
    emoji: string
    description: string
    color?: string
}

export default class Command extends CommandModule {
    private categoryEmojis: Record<string, string> = {
        anime: '📺',
        bots: '🤖',
        config: '⚙️',
        dev: '👨‍💻',
        educative: '📚',
        fun: '🎮',
        games: '🎲',
        general: '📋',
        media: '📼',
        moderation: '🛡️',
        social: '🌐',
        utility: '🔧',
        whatsapp: '📱'
    }

    private categoryDescriptions: Record<string, string> = {
        anime: 'Anime quotes, characters & more',
        bots: 'Bot information & status',
        config: 'Configure bot settings',
        dev: 'Developer tools (owner only)',
        educative: 'Learn something new',
        fun: 'Fun commands & games',
        games: 'Interactive games',
        general: 'Basic bot commands',
        media: 'Download & search media',
        moderation: 'Group management',
        social: 'Social & utility features',
        utility: 'Helpful utilities',
        whatsapp: 'WhatsApp related'
    }

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'help',
            description: 'Display help menu',
            category: 'general',
            usage: `${client.config.prefix}help [category|command]`,
            aliases: ['h', 'cmd'],
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        const input = parsedArgs.joined.toLowerCase().trim()
        const prefix = this.client.config.prefix

        if (!input) {
            return this.sendMainMenu(M)
        }

        if (input === 'all') {
            return this.sendAllCommands(M)
        }

        if (this.isCategory(input)) {
            return this.sendCategoryHelp(M, input)
        }

        return this.sendCommandHelp(M, input)
    }

    private sendMainMenu(M: ISimplifiedMessage): void {
        const prefix = this.client.config.prefix
        const categories = this.getCategories()

        let text = `╔══════════════════════════════╗\n`
        text += `║   *ARI-ANI BOT HELP MENU*   ║\n`
        text += `╚══════════════════════════════╝\n\n`
        text += `🔍 *Use:* \`${prefix}help <category>\`\n`
        text += `📖 *Use:* \`${prefix}help <command>\`\n\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `📁 *AVAILABLE CATEGORIES*\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`

        for (const [cat, emoji] of Object.entries(this.categoryEmojis)) {
            if (categories.includes(cat)) {
                const desc = this.categoryDescriptions[cat] || ''
                text += `${emoji} *${this.capitalize(cat)}*\n`
                text += `   └ ${desc}\n\n`
            }
        }

        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `📋 *Quick Commands*\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `\`${prefix}help all\` - All commands\n`
        text += `\`${prefix}ping\` - Check bot status\n`
        text += `\`${prefix}hi\` - Greet the bot\n\n`
        text += `💡 *Tip:* Type \`${prefix}help <category>\` to see commands in that category`

        M.reply(text)
    }

    private sendAllCommands(M: ISimplifiedMessage): void {
        const commands = this.handler.commands
        const categories: Record<string, ICommand[]> = {}

        for (const [name, cmd] of commands) {
            if (!cmd?.config?.category) continue
            if (!categories[cmd.config.category]) {
                categories[cmd.config.category] = []
            }
            categories[cmd.config.category].push(cmd)
        }

        let text = `╔══════════════════════════════╗\n`
        text += `║    *ALL BOT COMMANDS*        ║\n`
        text += `╚══════════════════════════════╝\n\n`

        const sortedCategories = Object.keys(categories).sort()
        for (const cat of sortedCategories) {
            const emoji = this.categoryEmojis[cat] || '📁'
            const cmds = categories[cat]
            text += `${emoji} *${this.capitalize(cat)}*\n`

            const cmdNames = cmds.map(c => `▸ ${c.config?.command}`).join('\n')
            text += `${cmdNames}\n\n`
        }

        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `📊 Total: *${commands.size}* commands\n`
        text += `💡 Use \`${this.client.config.prefix}help <command>\` for details`

        M.reply(text)
    }

    private sendCategoryHelp(M: ISimplifiedMessage, category: string): void {
        const commands = this.handler.commands
        const prefix = this.client.config.prefix

        const categoryCommands: ICommand[] = []
        for (const [, cmd] of commands) {
            if (cmd?.config?.category?.toLowerCase() === category) {
                categoryCommands.push(cmd)
            }
        }

        if (categoryCommands.length === 0) {
            return void M.reply(`❌ No commands found in *${this.capitalize(category)}* category\n\nUse \`${prefix}help\` to see available categories`)
        }

        const emoji = this.categoryEmojis[category] || '📁'
        const desc = this.categoryDescriptions[category] || ''

        let text = `╔══════════════════════════════╗\n`
        text += `║  ${emoji} *${this.capitalize(category)}* HELP     ║\n`
        text += `╚══════════════════════════════╝\n`
        text += `${desc}\n\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `📦 *Commands (${categoryCommands.length})*\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`

        for (const cmd of categoryCommands.sort((a, b) =>
            (a.config?.command || '').localeCompare(b.config?.command || '')
        )) {
            const name = cmd.config?.command || ''
            const description = cmd.config?.description || 'No description'
            const aliases = cmd.config.aliases?.length ? ` (${cmd.config.aliases.join(', ')})` : ''

            text += `▸ *${name}*${aliases}\n`
            text += `  └ ${description}\n\n`
        }

        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `💡 Use \`${prefix}help <command>\` for details`

        M.reply(text)
    }

    private sendCommandHelp(M: ISimplifiedMessage, input: string): void {
        const command = this.handler.commands.get(input) || this.handler.aliases.get(input)

        if (!command) {
            return void M.reply(`❌ Command *"${input}"* not found\n\nUse \`${this.client.config.prefix}help\` to see all commands`)
        }

        const config = command.config
        const prefix = this.client.config.prefix

        let text = `╔══════════════════════════════╗\n`
        text += `║  📖 COMMAND HELP             ║\n`
        text += `╚══════════════════════════════╝\n\n`
        text += `▸ *Name:* ${config.command}\n`
        text += `▸ *Category:* ${this.capitalize(config.category || 'general')}\n`
        text += `▸ *Description:* ${config.description}\n\n`

        if (config.aliases?.length) {
            text += `▸ *Aliases:* ${config.aliases.map(a => `\`${a}\``).join(', ')}\n`
        }

        text += `\n━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `📝 *Usage*\n`
        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `\`${config.usage || `${prefix}${config.command}`}\`\n\n`

        text += `━━━━━━━━━━━━━━━━━━━━━━━\n`
        text += `💡 Example: \`${config.usage || `${prefix}${config.command}`}\``

        M.reply(text)
    }

    private isCategory(input: string): boolean {
        const categories = this.getCategories()
        return categories.includes(input.toLowerCase())
    }

    private getCategories(): string[] {
        const categories = new Set<string>()
        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category) {
                categories.add(cmd.config.category.toLowerCase())
            }
        }
        return Array.from(categories)
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }
}