import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ICommand, IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    private categoryEmojis: Record<string, string> = {
        anime: '🧧',
        bots: '🤖',
        config: '⚙️',
        dev: '👨‍💻',
        educative: '📚',
        fun: '🎮',
        games: '🎲',
        general: '♨️',
        media: '🎵',
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
            aliases: ['menu', 'h', 'cmd'],
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        const input = parsedArgs.joined.toLowerCase().trim()

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

        const username =
            M.pushName ||
            M.sender?.split('@')[0] ||
            'User'

        const hour = new Date().getHours()

        let greeting = 'Good Evening'

        if (hour >= 5 && hour < 12) {
            greeting = 'Good Morning'
        } else if (hour >= 12 && hour < 17) {
            greeting = 'Good Afternoon'
        }

        let text = `👋 ${greeting} ${username}, I'm Ari-Ani your WhatsApp assistant bot.\n\n`

        text += `🏮→ 𝐓𝐡𝐢𝐬 𝐢𝐬 𝐚 𝐩𝐮𝐛𝐥𝐢𝐜 𝐬𝐜𝐫𝐢𝐩𝐭, 𝐧𝐨𝐭 𝐟𝐨𝐫 𝐬𝐚𝐥𝐞.\n`
        text += `🏮→ 𝐃𝐨𝐧'𝐭 𝐜𝐚𝐥𝐥 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐨𝐫 𝐲𝐨𝐮 𝐦𝐚𝐲 𝐛𝐞 𝐛𝐚𝐧𝐧𝐞𝐝.\n`
        text += `🏮→ 𝐃𝐨𝐧'𝐭 𝐮𝐬𝐞 𝐭𝐡𝐞 𝐛𝐨𝐭 𝐢𝐧 𝐏𝐌.\n\n`

        text += `🧧 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${prefix} ]\n\n`

        text += `⛩️ 𝐇𝐞𝐫𝐞 𝐚𝐫𝐞 𝐭𝐡𝐞 𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐲 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐬:\n\n`

        for (const category of categories) {
            const emoji = this.categoryEmojis[category] || '📁'
            const desc = this.categoryDescriptions[category] || 'No description'

            text += `${emoji} *${this.capitalize(category)}*\n`
            text += `└ ${desc}\n\n`
        }

        text += `🌟 𝐔𝐬𝐚𝐠𝐞: use ${prefix}help <category>\n`
        text += `🌟 𝐔𝐬𝐚𝐠𝐞: use ${prefix}help <command>`

        M.reply(text)
    }

    private sendCategoryHelp(M: ISimplifiedMessage, category: string): void {
        const commands = this.handler.commands
        const prefix = this.client.config.prefix

        const categoryCommands: ICommand[] = []

        for (const [, cmd] of commands) {
            if (
                cmd?.config?.category?.toLowerCase() ===
                category.toLowerCase()
            ) {
                categoryCommands.push(cmd)
            }
        }

        if (!categoryCommands.length) {
            return void M.reply(
                `❌ No commands found in *${category}* category`
            )
        }

        const emoji = this.categoryEmojis[category] || '📁'
        const description =
            this.categoryDescriptions[category] || 'No description'

        let text = `${emoji} 𝐀𝐑𝐈-𝐀𝐍𝐈 ${this.capitalize(category)} 𝐌𝐄𝐍𝐔\n\n`

        text += `📖 ${description}\n`
        text += `📦 Total Commands: ${categoryCommands.length}\n\n`

        for (const cmd of categoryCommands.sort((a, b) =>
            (a.config?.command || '').localeCompare(
                b.config?.command || ''
            )
        )) {
            text += `🪄 ${prefix}${cmd.config.command}\n`
        }

        text += `\n🌟 Use ${prefix}help <command> for command info`

        M.reply(text)
    }

    private sendAllCommands(M: ISimplifiedMessage): void {
        const commands = this.handler.commands
        const categories: Record<string, ICommand[]> = {}

        for (const [, cmd] of commands) {
            if (!cmd?.config?.category) continue

            const category = cmd.config.category.toLowerCase()

            if (!categories[category]) {
                categories[category] = []
            }

            categories[category].push(cmd)
        }

        let text = `🌟 𝐀𝐑𝐈-𝐀𝐍𝐈 𝐀𝐋𝐋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒\n\n`

        for (const category of Object.keys(categories).sort()) {
            const emoji = this.categoryEmojis[category] || '📁'

            text += `${emoji} *${this.capitalize(category)}*\n`

            for (const cmd of categories[category]) {
                text += `└ 🪄 ${cmd.config.command}\n`
            }

            text += `\n`
        }

        text += `📊 Total Commands: ${commands.size}`

        M.reply(text)
    }

    private sendCommandHelp(M: ISimplifiedMessage, input: string): void {
        const command =
            this.handler.commands.get(input) ||
            this.handler.aliases.get(input)

        if (!command) {
            return void M.reply(
                `❌ Command "${input}" not found`
            )
        }

        const config = command.config

        let text = `📖 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐇𝐄𝐋𝐏\n\n`

        text += `🧩 Command: ${config.command}\n`
        text += `📂 Category: ${this.capitalize(
            config.category || 'general'
        )}\n`
        text += `📝 Description: ${config.description}\n`

        if (config.aliases?.length) {
            text += `🏷️ Aliases: ${config.aliases.join(', ')}\n`
        }

        text += `\n⚡ Usage:\n${config.usage}`

        M.reply(text)
    }

    private isCategory(input: string): boolean {
        return this.getCategories().includes(input.toLowerCase())
    }

    private getCategories(): string[] {
        const categories = new Set<string>()

        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category) {
                categories.add(
                    cmd.config.category.toLowerCase()
                )
            }
        }

        return Array.from(categories).sort()
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }
}
