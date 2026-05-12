import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'
import request from '../../core/request.js'

interface RepoInfo {
    forks_count: number
    updated_at: string
    open_issues_count: number
    watchers_count: number
    stargazers_count: number
}

interface Contributors {
    length: number
}

export default class Command extends CommandModule {
    private images: string[] = [
        'https://i.ibb.co/6RxTGwCZ/Deryl.jpg',
        'https://i.ibb.co/pvnNm0TX/Deryl.jpg',
        'https://i.ibb.co/jkyVdTh4/Deryl.jpg',
        'https://i.ibb.co/VYg9c7DJ/Deryl.jpg',
        'https://i.ibb.co/4ZtT2wpH/Deryl.jpg',
        'https://i.ibb.co/cStLwZy4/Deryl.jpg'
    ]

    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'entropy',
            description: 'Displays bot information',
            category: 'bots',
            usage: `${client.config.prefix}entropy`,
            baseXp: 100
        })
    }

    private getRandomImage(): string {
        return this.images[
            Math.floor(Math.random() * this.images.length)
        ]
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const repoUrl =
                'https://api.github.com/repos/Eximinati/Whatsapp-bot-Ari-Ani'

            const contributorsUrl =
                'https://api.github.com/repos/Eximinati/Whatsapp-bot-Ari-Ani/contributors'

            const [repo, contributors] = await Promise.all([
                request.json<RepoInfo>(repoUrl),
                request.json<any[]>(contributorsUrl)
            ])

            const updatedDate = new Date(
                repo.updated_at
            ).toLocaleDateString()

            const text =
`👾 Ari-Ani Bot Info

🍀 Multi-Device WhatsApp Bot

🌐 GitHub Repo Stats

⭐ Stars: ${repo.stargazers_count}
🍴 Forks: ${repo.forks_count}
👥 Contributors: ${contributors.length}
🔄 Last Updated: ${updatedDate}

🔗 https://github.com/Eximinati/Whatsapp-bot-Ari-Ani`

            const image = this.getRandomImage()

            await this.client.sendMessage(
                M.from,
                {
                    image: { url: image },
                    caption: text
                },
                {
                    quoted: M.message
                }
            )
        } catch (error) {
            console.error(error)

            await M.reply(
                '❌ Failed to fetch GitHub repository info.'
            )
        }
    }
}
