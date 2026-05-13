import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import {
    ICommand,
    IParsedArgs,
    ISimplifiedMessage
} from '../../typings/index.js'
import { MessageType } from '../../core/types.js'
import axios from 'axios'

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
        dev: 'Developer tools',
        educative: 'Learn something new',
        fun: 'Fun commands & games',
        games: 'Interactive games',
        general: 'Basic bot commands',
        media: 'Download & search media',
        moderation: 'Group management',
        social: 'Social features',
        utility: 'Helpful utilities',
        whatsapp: 'WhatsApp related'
    }

    private categoryImages: Record<string, string> = {
        general: 'https://i.ibb.co/WvCnB8WM/Deryl.jpg',
        games: 'https://i.ibb.co/4gC4Rj9b/Deryl.jpg',
        media: 'https://i.ibb.co/ynV86TBY/Deryl.jpg',
        anime: 'https://i.ibb.co/dsWj285f/Deryl.jpg',
        moderation: 'https://i.ibb.co/nqZXYv56/Deryl.jpg',
        utility: 'https://i.ibb.co/G3T425vQ/Deryl.jpg',
        social: 'https://i.ibb.co/1YXJcD5m/Deryl.jpg',
        bots: 'https://i.ibb.co/XQtrY26/Deryl.jpg',
        config: 'https://i.ibb.co/rGrx1swS/Deryl.jpg',
        dev: 'https://i.ibb.co/CKvNPBLr/Deryl.jpg',
        educative: 'https://i.ibb.co/Y7XbKcbC/Deryl.jpg',
        fun: 'https://i.ibb.co/v6QJYnmr/Deryl.jpg',
        whatsapp: 'https://i.ibb.co/XfRfySZZ/Deryl.jpg'
    }

    private thumbnailUrls: string[] = [
        'https://i.ibb.co/6RxTGwCZ/Deryl.jpg',
        'https://i.ibb.co/pvnNm0TX/Deryl.jpg',
        'https://i.ibb.co/jkyVdTh4/Deryl.jpg',
        'https://i.ibb.co/VYg9c7DJ/Deryl.jpg',
        'https://i.ibb.co/4ZtT2wpH/Deryl.jpg',
        'https://i.ibb.co/cStLwZy4/Deryl.jpg'
    ]

    private customFontMap: Record<string, string> = {
        a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞',
        f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢', j: '𝐣',
        k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨',
        p: '𝐩', q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭',
        u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',

        A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄',
        F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈', J: '𝐉',
        K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎',
        P: '𝐏', Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓',
        U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙'
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

    private async getBuffer(url: string): Promise<Buffer> {
        return (
            await axios.get(url, {
                responseType: 'arraybuffer'
            })
        ).data
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        const input = parsedArgs.joined.toLowerCase().trim()

        if (!input) return this.sendMainMenu(M)
        if (input === 'all') return this.sendAllCommands(M)
        if (this.isCategory(input)) return this.sendCategoryHelp(M, input)

        return this.sendCommandHelp(M, input)
    }

    
    private async sendMainMenu(M: ISimplifiedMessage): Promise<void> {
        const prefix = this.client.config.prefix
        const categories = this.getCategories()

        const username =
            M.pushName ||
            M.sender?.jid?.split('@')[0] ||
            'User'

        let text = `👋 Hello ${username}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ This is a public script, not for sale.
🏮→ Don't call the bot or you may be banned.
🏮→ Don't use the bot in PM.

🧧 Prefix: [ ${prefix} ]

⛩️ Here are the category commands:

╭─ 📦 CATEGORIES ─╮

`

        for (const category of categories) {
            const emoji = this.categoryEmojis[category] || '✨'
            const desc = this.categoryDescriptions[category] || 'No description'

            text += `┃ ${emoji} ${this.capitalize(category)} - ${desc}\n`
        }

        text += `
╰────────╯

🌟 Usage: ${prefix}help <category>
🌟 Usage: ${prefix}help <command>
`

        const imageBuffer = await this.getBuffer(this.getRandomThumbnail())

        await M.reply(
            imageBuffer,
            MessageType.image,
            undefined,
            undefined,
            this.toFont(text)
        )
    }

    
    private async sendCategoryHelp(M: ISimplifiedMessage, category: string): Promise<void> {
        const prefix = this.client.config.prefix

        const categoryCommands: ICommand[] = []

        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category?.toLowerCase() === category.toLowerCase()) {
                categoryCommands.push(cmd)
            }
        }

        if (!categoryCommands.length) {
            return void M.reply(`❌ No commands found in ${category}`)
        }

        
        const commandList = categoryCommands
            .sort((a, b) => a.config.command.localeCompare(b.config.command))
            .map(cmd => `❄︎ ${cmd.config.command}`)
            .join(' ')

        const text = this.toFont(`▬▬▬๑۩ ${this.capitalize(category)} ۩๑▬▬▬▬

☞ 

${commandList}

⌜${this.capitalize(category)} Commands⌝`)

        const imageUrl = this.categoryImages[category] || this.getRandomThumbnail()
        const imageBuffer = await this.getBuffer(imageUrl)

        await M.reply(imageBuffer, MessageType.image, undefined, undefined, text)
    }

    
    private async sendAllCommands(M: ISimplifiedMessage): Promise<void> {
        const categories: Record<string, ICommand[]> = {}

        for (const [, cmd] of this.handler.commands) {
            if (!cmd?.config?.category) continue

            const category = cmd.config.category.toLowerCase()

            if (!categories[category]) categories[category] = []
            categories[category].push(cmd)
        }

        let text = `🌟 𝐀𝐑𝐈-𝐀𝐍𝐈 𝐀𝐋𝐋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒\n\n`

        for (const category of Object.keys(categories).sort()) {
            const emoji = this.categoryEmojis[category] || '📁'

            text += `${emoji} ${this.capitalize(category)}\n`

            for (const cmd of categories[category]) {
                text += `└ 🪄 ${cmd.config.command}\n`
            }

            text += `\n`
        }

        text += `📊 Total Commands: ${this.handler.commands.size}`

        await M.reply(this.toFont(text))
    }

    
    private async sendCommandHelp(M: ISimplifiedMessage, input: string): Promise<void> {
        const command =
            this.handler.commands.get(input) ||
            this.handler.aliases.get(input)

        if (!command) {
            return void M.reply(`❌ Command "${input}" not found`)
        }

        const config = command.config

        const text = this.toFont(`📖 COMMAND INFO

🧩 Name: ${config.command}
📂 Category: ${this.capitalize(config.category || 'general')}
📝 Description: ${config.description}

🏷️ Aliases:
${config.aliases?.join(', ') || 'None'}

⚡ Usage:
${config.usage}`)

        await M.reply(text)
    }

    
    private getRandomThumbnail(): string {
        return this.thumbnailUrls[
            Math.floor(Math.random() * this.thumbnailUrls.length)
        ]
    }

    private toFont(text: string = ''): string {
        return text.replace(/[a-zA-Z]/g, c => this.customFontMap[c] || c)
    }

    private isCategory(input: string): boolean {
        return this.getCategories().includes(input.toLowerCase())
    }

    private getCategories(): string[] {
        const categories = new Set<string>()

        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category) {
                categories.add(cmd.config.category.toLowerCase())
            }
        }

        return Array.from(categories).sort()
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }
}import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import {
    ICommand,
    IParsedArgs,
    ISimplifiedMessage
} from '../../typings/index.js'
import { MessageType } from '../../core/types.js'
import axios from 'axios'

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
        dev: 'Developer tools',
        educative: 'Learn something new',
        fun: 'Fun commands & games',
        games: 'Interactive games',
        general: 'Basic bot commands',
        media: 'Download & search media',
        moderation: 'Group management',
        social: 'Social features',
        utility: 'Helpful utilities',
        whatsapp: 'WhatsApp related'
    }

    private categoryImages: Record<string, string> = {
        general: 'https://i.ibb.co/WvCnB8WM/Deryl.jpg',
        games: 'https://i.ibb.co/4gC4Rj9b/Deryl.jpg',
        media: 'https://i.ibb.co/ynV86TBY/Deryl.jpg',
        anime: 'https://i.ibb.co/dsWj285f/Deryl.jpg',
        moderation: 'https://i.ibb.co/nqZXYv56/Deryl.jpg',
        utility: 'https://i.ibb.co/G3T425vQ/Deryl.jpg',
        social: 'https://i.ibb.co/1YXJcD5m/Deryl.jpg',
        bots: 'https://i.ibb.co/XQtrY26/Deryl.jpg',
        config: 'https://i.ibb.co/rGrx1swS/Deryl.jpg',
        dev: 'https://i.ibb.co/CKvNPBLr/Deryl.jpg',
        educative: 'https://i.ibb.co/Y7XbKcbC/Deryl.jpg',
        fun: 'https://i.ibb.co/v6QJYnmr/Deryl.jpg',
        whatsapp: 'https://i.ibb.co/XfRfySZZ/Deryl.jpg'
    }

    private thumbnailUrls: string[] = [
        'https://i.ibb.co/6RxTGwCZ/Deryl.jpg',
        'https://i.ibb.co/pvnNm0TX/Deryl.jpg',
        'https://i.ibb.co/jkyVdTh4/Deryl.jpg',
        'https://i.ibb.co/VYg9c7DJ/Deryl.jpg',
        'https://i.ibb.co/4ZtT2wpH/Deryl.jpg',
        'https://i.ibb.co/cStLwZy4/Deryl.jpg'
    ]

    private customFontMap: Record<string, string> = {
        a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞',
        f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢', j: '𝐣',
        k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨',
        p: '𝐩', q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭',
        u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',

        A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄',
        F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈', J: '𝐉',
        K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎',
        P: '𝐏', Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓',
        U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙'
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

    private async getBuffer(url: string): Promise<Buffer> {
        return (
            await axios.get(url, {
                responseType: 'arraybuffer'
            })
        ).data
    }

    run = async (M: ISimplifiedMessage, parsedArgs: IParsedArgs): Promise<void> => {
        const input = parsedArgs.joined.toLowerCase().trim()

        if (!input) return this.sendMainMenu(M)
        if (input === 'all') return this.sendAllCommands(M)
        if (this.isCategory(input)) return this.sendCategoryHelp(M, input)

        return this.sendCommandHelp(M, input)
    }

    
    private async sendMainMenu(M: ISimplifiedMessage): Promise<void> {
        const prefix = this.client.config.prefix
        const categories = this.getCategories()

        const username =
            M.pushName ||
            M.sender?.jid?.split('@')[0] ||
            'User'

        let text = `👋 Hello ${username}, I'm Ari-Ani your WhatsApp assistant bot.

🏮→ This is a public script, not for sale.
🏮→ Don't call the bot or you may be banned.
🏮→ Don't use the bot in PM.

🧧 Prefix: [ ${prefix} ]

⛩️ Here are the category commands:

╭─ 📦 CATEGORIES ─╮

`

        for (const category of categories) {
            const emoji = this.categoryEmojis[category] || '✨'
            const desc = this.categoryDescriptions[category] || 'No description'

            text += `┃ ${emoji} ${this.capitalize(category)}
┃    └ ${desc}\n`
        }

        text += `
╰─────────────╯

🌟 Usage: ${prefix}help <category>
🌟 Usage: ${prefix}help <command>
`

        const imageBuffer = await this.getBuffer(this.getRandomThumbnail())

        await M.reply(
            imageBuffer,
            MessageType.image,
            undefined,
            undefined,
            this.toFont(text)
        )
    }

    
    private async sendCategoryHelp(M: ISimplifiedMessage, category: string): Promise<void> {
        const prefix = this.client.config.prefix

        const categoryCommands: ICommand[] = []

        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category?.toLowerCase() === category.toLowerCase()) {
                categoryCommands.push(cmd)
            }
        }

        if (!categoryCommands.length) {
            return void M.reply(`❌ No commands found in ${category}`)
        }

        
        const commandList = categoryCommands
            .sort((a, b) => a.config.command.localeCompare(b.config.command))
            .map(cmd => `❄︎ ${cmd.config.command}`)
            .join(' ')

        const text = this.toFont(`▬▬▬๑۩ ${this.capitalize(category)} ۩๑▬▬▬▬

☞ 

${commandList}

⌜${this.capitalize(category)} Commands⌝`)

        const imageUrl = this.categoryImages[category] || this.getRandomThumbnail()
        const imageBuffer = await this.getBuffer(imageUrl)

        await M.reply(imageBuffer, MessageType.image, undefined, undefined, text)
    }

    
    private async sendAllCommands(M: ISimplifiedMessage): Promise<void> {
        const categories: Record<string, ICommand[]> = {}

        for (const [, cmd] of this.handler.commands) {
            if (!cmd?.config?.category) continue

            const category = cmd.config.category.toLowerCase()

            if (!categories[category]) categories[category] = []
            categories[category].push(cmd)
        }

        let text = `🌟 𝐀𝐑𝐈-𝐀𝐍𝐈 𝐀𝐋𝐋 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒\n\n`

        for (const category of Object.keys(categories).sort()) {
            const emoji = this.categoryEmojis[category] || '📁'

            text += `${emoji} ${this.capitalize(category)}\n`

            for (const cmd of categories[category]) {
                text += `└ 🪄 ${cmd.config.command}\n`
            }

            text += `\n`
        }

        text += `📊 Total Commands: ${this.handler.commands.size}`

        await M.reply(this.toFont(text))
    }

    
    private async sendCommandHelp(M: ISimplifiedMessage, input: string): Promise<void> {
        const command =
            this.handler.commands.get(input) ||
            this.handler.aliases.get(input)

        if (!command) {
            return void M.reply(`❌ Command "${input}" not found`)
        }

        const config = command.config

        const text = this.toFont(`📖 COMMAND INFO

🧩 Name: ${config.command}
📂 Category: ${this.capitalize(config.category || 'general')}
📝 Description: ${config.description}

🏷️ Aliases:
${config.aliases?.join(', ') || 'None'}

⚡ Usage:
${config.usage}`)

        await M.reply(text)
    }

    
    private getRandomThumbnail(): string {
        return this.thumbnailUrls[
            Math.floor(Math.random() * this.thumbnailUrls.length)
        ]
    }

    private toFont(text: string = ''): string {
        return text.replace(/[a-zA-Z]/g, c => this.customFontMap[c] || c)
    }

    private isCategory(input: string): boolean {
        return this.getCategories().includes(input.toLowerCase())
    }

    private getCategories(): string[] {
        const categories = new Set<string>()

        for (const [, cmd] of this.handler.commands) {
            if (cmd?.config?.category) {
                categories.add(cmd.config.category.toLowerCase())
            }
        }

        return Array.from(categories).sort()
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }
}
