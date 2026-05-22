import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'
const W=680,H=340,R=22,BG1='#0d1a26',BG2='#1a2a3a',AC='#26c6da'
const economy=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'pay',description:'Send coins to another player',category:'economy',usage:`${c.config.prefix}pay @user <amount>`,aliases:['send','give'],baseXp:10})}
run=async(M:ISimplifiedMessage,{joined}:IParsedArgs):Promise<void>=>{const p=joined.trim().split(/\s+/);const tid=(p[0]||'').replace('@','')+'@s.whatsapp.net';const amt=p.slice(1).join(' ')||'0'
if(!tid||tid===M.sender.jid)return void M.reply('❌ Mention a user to pay.')
try{const res=await economy.pay(M.sender.jid,tid,amt);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('💸 PAYMENT SENT',W/2,60)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,80,90,520,140,R);ctx.fill()
ctx.fillStyle=AC;ctx.font='bold 48px "Segoe UI",sans-serif';ctx.fillText(`-${formatMoney(res.amount)}`,W/2,170)
ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='18px "Segoe UI",sans-serif';ctx.fillText('sent successfully',W/2,210)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='15px "Segoe UI",sans-serif';ctx.fillText(`Your wallet: ${formatMoney(res.sender.wallet)} | Bank: ${formatMoney(res.sender.bank)}`,W/2,250)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=`💸 Sent ${formatMoney(res.amount)} | Wallet: ${formatMoney(res.sender.wallet)}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}