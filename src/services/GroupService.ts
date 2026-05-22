import NodeCache from 'node-cache'
import { WASocket, GroupMetadata } from 'baileys'

export default class GroupService {
    constructor(
        private sock: WASocket,
        private groupMetadataCache: NodeCache
    ) {}

    groupMetadata = async (jid: string): Promise<GroupMetadata> => {
        const cached = this.groupMetadataCache.get<GroupMetadata>(jid)
        if (cached) return cached
        const meta = await this.sock.groupMetadata(jid)
        this.groupMetadataCache.set(jid, meta)
        return meta
    }

    fetchGroupMetadataFromWA = async (jid: string): Promise<GroupMetadata> =>
        this.sock.groupMetadata(jid)

    groupRemove = async (jid: string, users: string[]) =>
        this.sock.groupParticipantsUpdate(jid, users, 'remove')

    groupPromote = async (jid: string, users: string[]) =>
        this.sock.groupParticipantsUpdate(jid, users, 'promote')

    groupDemote = async (jid: string, users: string[]) =>
        this.sock.groupParticipantsUpdate(jid, users, 'demote')

    groupAdd = async (jid: string, users: string[]) =>
        this.sock.groupParticipantsUpdate(jid, users, 'add')

    groupInviteCode = async (jid: string): Promise<string | undefined> =>
        this.sock.groupInviteCode(jid)

    groupRevokeInvite = async (jid: string): Promise<string | undefined> =>
        this.sock.groupRevokeInvite(jid)

    groupUpdateSubject = async (jid: string, subject: string): Promise<void> =>
        this.sock.groupUpdateSubject(jid, subject)

    groupUpdateDescription = async (jid: string, description: string): Promise<void> => {
        await this.sock.groupUpdateDescription(jid, description)
    }

    groupAcceptInvite = async (code: string): Promise<string | undefined> =>
        this.sock.groupAcceptInvite(code)

    groupLeave = async (jid: string): Promise<void> => {
        await this.sock.groupLeave(jid)
    }

    groupMakeAdmin = async (jid: string, users: string[]) => this.groupPromote(jid, users)
    groupDemoteAdmin = async (jid: string, users: string[]) => this.groupDemote(jid, users)

    groupSettingChange = async (jid: string, _setting: string, value: boolean): Promise<void> => {
        await this.sock.groupSettingUpdate(jid, value ? 'announcement' : 'not_announcement')
    }

    acceptInvite = async (code: string): Promise<{ status: number; gid?: string }> => {
        try {
            const gid = await this.sock.groupAcceptInvite(code)
            return { status: 200, gid }
        } catch {
            return { status: 401 }
        }
    }
}
