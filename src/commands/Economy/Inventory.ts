import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'
const W = 680, R = 22, BG1 = '#0d1f1a', BG2 = '#0a1510', AC = '#4db6ac'
const economy = new EconomyService()
export default class Command extends CommandModule { constructor(c: RuntimeClient, h: MessagePipeline) { super(c, h, { command: 'inventory', description: 'View your inventory', category: 'economy', usage: `${c.config.prefix}inventory`, aliases: ['inv', 'backpack'], baseXp: 5 }) }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const res = await economy.getInventory(M.sender.jid)
        const itemCount = res.items.length; const Hr = Math.max(300, 120 + itemCount * 36)
        const cv = createCanvas(W, Hr), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, Hr); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hr)
        ctx.fillStyle = AC; ctx.font = 'bold 28px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🎒 INVENTORY', W / 2, 48)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 30, 70, W - 60, Hr - 90, R); ctx.fill()
        if (itemCount === 0) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '20px "Segoe UI",sans-serif'; ctx.fillText('No items yet — use /shop!', W / 2, 140) }
        else res.items.forEach((it, i) => { const y = 105 + i * 36; ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'; rr(ctx, 40, y - 8, W - 80, 30, 8); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.font = '16px "Segoe UI",sans-serif'; ctx.textAlign = 'left'
            ctx.fillText(`${it.equipped ? '✅' : '  '} ${it.name} x${it.quantity}${it.type === 'tool' ? ' (tool)' : it.type === 'consumable' ? ' (consumable)' : ''}`, 50, y + 13) })
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy • /equip <item> to use tools', W / 2, Hr - 16)
        const cap = itemCount > 0 ? res.items.map(i => `${i.equipped ? '✅' : ' '}${i.name} x${i.quantity}`).join('\n') : 'No items'
        return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, `🎒 *INVENTORY*\n━━━━━━\n${cap}`) } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) } }
}