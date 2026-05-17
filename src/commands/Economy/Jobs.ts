import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'

const W = 680, R = 22, BG1 = '#1a1a2e', BG2 = '#0d0d1a', AC = '#4fc3f7'
function rr(ctx: import('@napi-rs/canvas').SKRSContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath() }
const ECO = new EconomyService()

export default class Command extends CommandModule {
    constructor(c: RuntimeClient, h: MessagePipeline) { super(c, h, { command: 'jobs', description: 'List available jobs', category: 'economy', usage: `${c.config.prefix}jobs`, aliases: ['joblist', 'careers'], baseXp: 5 }) }
    run = async (M: ISimplifiedMessage, _: IParsedArgs): Promise<void> => {
        try { const jobs = ECO.getJobs(); const state = await ECO.getJobsState(M.sender.jid)
        const Hr = 100 + jobs.length * 40; const cv = createCanvas(W, Hr), ctx = cv.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, Hr); g.addColorStop(0, BG1); g.addColorStop(1, BG2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hr)
        ctx.fillStyle = AC; ctx.font = 'bold 28px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💼 JOBS', W / 2, 48)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '14px "Segoe UI",sans-serif'; ctx.fillText(`Current: ${state.currentJob?.name || 'Unemployed'}`, W / 2, 72)
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, 30, 88, W - 60, Hr - 108, R); ctx.fill()
        jobs.forEach((j, i) => { const y = 120 + i * 40; ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'; rr(ctx, 40, y - 8, W - 80, 32, 8); ctx.fill()
            ctx.fillStyle = state.currentJob?.key === j.key ? '#4caf50' : '#fff'; ctx.font = '16px "Segoe UI",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${state.currentJob?.key === j.key ? '✅ ' : '  '}${j.name}`, 50, y + 14) })
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '12px "Segoe UI",sans-serif'; ctx.fillText('Ari-Ani Economy • /job set <key>', W / 2, Hr - 16)
        const cap = jobs.map(j => `${state.currentJob?.key === j.key ? '✅' : ' '}${j.key}: ${j.name}`).join('\n')
        return void M.reply(cv.toBuffer('image/png'), MessageType.image, Mimetype.png, undefined, `💼 *JOBS*\n━━━━━━\n${cap}`) } catch (e) { return void M.reply(`❌ ${e instanceof Error ? e.message : 'Error'}`) } }
}