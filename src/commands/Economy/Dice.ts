import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
import { rr } from '../../utils/canvas.js'
const W=680,H=400,R=22,BG1='#1a1a2e',BG2='#16213e',AC='#e040fb'

const economy=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'dice',description:'Roll the dice vs the house',category:'economy',usage:`${c.config.prefix}dice <bet>`,aliases:['dicebet'],baseXp:15})}
run=async(M:ISimplifiedMessage,{joined}:IParsedArgs):Promise<void>=>{const bet=joined.trim()||'50'
try{const res=await economy.dice(M.sender.jid,bet);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🎲 DICE',W/2,60)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,60,90,560,200,R);ctx.fill()
const dice=['','⚀','⚁','⚂','⚃','⚄','⚅']
ctx.font='bold 70px "Segoe UI Emoji",sans-serif'
ctx.fillStyle='#4fc3f7';ctx.fillText(dice[res.player],W/2-80,200)
ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillText('VS',W/2,200)
ctx.fillStyle='#ff8a65';ctx.fillText(dice[res.house],W/2+80,200)
const won=res.win;const dr=res.draw
ctx.fillStyle=won?'#4caf50':dr?'#ffa000':'#ff5252';ctx.font='bold 28px "Segoe UI",sans-serif'
ctx.fillText(won?`YOU WIN +${formatMoney(res.delta)}`:dr?'DRAW':`YOU LOSE -${formatMoney(Math.abs(res.delta))}`,W/2,265)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='14px "Segoe UI",sans-serif';ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}`,W/2,300)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=won?`🎲 Won +${formatMoney(res.delta)}`:`🎲 ${res.draw?'Draw':'Lost -'+formatMoney(Math.abs(res.delta))}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}