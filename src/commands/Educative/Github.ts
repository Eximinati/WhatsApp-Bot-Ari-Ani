import axios from 'axios'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

interface UserInfo {
    login: string
    avatar_url: string
    html_url: string
    name: string
    public_repos: number
    followers: number
    following: number
    created_at: string
    updated_at: string
}

interface RepoInfo {
    name: string
    full_name: string
    description: string | null
    language: string
    stargazers_count: number
    forks_count: number
    open_issues_count: number
    created_at: string
    updated_at: string
    license: { name: string } | null
}

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'github',
            aliases: ['gh'],
            description: 'Get github information about a user/repo',
            category: 'educative',
            usage: `${client.config.prefix}github`
        })
    }

    private getLastPage = (linkHeader?: string): number => {
        if (!linkHeader) return 1
        const match = linkHeader.match(/&page=(\d+)>;\s*rel="last"/)
        return match ? parseInt(match[1]) : 1
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const terms = joined.trim().split('/')

        if (!terms[0]) {
            return void M.reply(`Use: ${this.client.config.prefix}gh username or username/repo`)
        }

        const username = terms[0]
        const repo = terms[1] || null

        
        if (!repo) {
            const userInfo = await axios
                .get<UserInfo>(`https://api.github.com/users/${username}`)
                .then(res => res.data)
                .catch(() => null)

            if (!userInfo) return void M.reply('❌ Failed to fetch user')

            const text =
`🐙 GitHub User

👤 Name: ${userInfo.name || '-'}
🔗 https://github.com/${username}

👥 Followers: ${userInfo.followers}
👤 Following: ${userInfo.following}
📦 Repos: ${userInfo.public_repos}
📅 Joined: ${userInfo.created_at.slice(0, 10)}
📅 Updated: ${userInfo.updated_at.slice(0, 10)}`

            return void M.reply(text)
        }

        
        const repoInfo = await axios
            .get<RepoInfo>(`https://api.github.com/repos/${username}/${repo}`)
            .then(res => res.data)
            .catch(() => null)

        if (!repoInfo) return void M.reply('❌ Failed to fetch repo')

        
        const contributorsRes = await axios.get(
            `https://api.github.com/repos/${username}/${repo}/contributors?per_page=1&anon=1`
        ).catch(() => null)

        const contributorsCount =
            this.getLastPage(contributorsRes?.headers?.link)

        const text =
`🐙 GitHub Repo

🔗 https://github.com/${username}/${repo}

📦 Name: ${repoInfo.name}
📝 Description: ${repoInfo.description || '-'}
💻 Language: ${repoInfo.language || '-'}

⭐ Stars: ${repoInfo.stargazers_count}
🍴 Forks: ${repoInfo.forks_count}
👥 Contributors: ${contributorsCount}

🐛 Issues: ${repoInfo.open_issues_count}
📅 Created: ${repoInfo.created_at.slice(0, 10)}
🔄 Updated: ${repoInfo.updated_at.slice(0, 10)}

📜 License: ${repoInfo.license?.name || '-'}`

        return void M.reply(text)
    }
}
