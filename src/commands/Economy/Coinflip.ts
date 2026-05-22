import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'
const W=680,H=380,R=22,BG1='#1a1a2e',BG2='#0d0d1a',AC='#ffd700'

const economy=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'coinflip',description:'Flip a coin',category:'economy',usage:`${c.config.prefix}coinflip heads|tails <bet>`,aliases:['cf','coin'],baseXp:15})}
run=async(M:ISimplifiedMessage,{args,joined}:IParsedArgs):Promise<void>=>{const choice=args[0]||'heads';const bet=args.slice(1).join(' ')||'50'
try{const res=await economy.coinflip(M.sender.jid,choice,bet);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🪙 COINFLIP',W/2,60)
const won=res.win
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,80,90,520,180,R);ctx.fill()
ctx.fillStyle=AC;ctx.font='bold 80px "Segoe UI Emoji",sans-serif';ctx.fillText(res.result==='heads'?'🪙':'📀',W/2,185)
ctx.fillStyle=won?'#4caf50':'#ff5252';ctx.font='bold 42px "Segoe UI",sans-serif';ctx.fillText(won?`+${formatMoney(res.delta)}`:`-${formatMoney(res.bet)}`,W/2,240)
ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='16px "Segoe UI",sans-serif';ctx.fillText(`You chose ${res.choice} → ${res.result}`,W/2,270)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='14px "Segoe UI",sans-serif';ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}`,W/2,300)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=won?`🪙 Won +${formatMoney(res.delta)} | ${res.choice}→${res.result}`:`🪙 Lost -${formatMoney(res.bet)} | ${res.choice}→${res.result}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}