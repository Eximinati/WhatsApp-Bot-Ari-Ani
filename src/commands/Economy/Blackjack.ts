import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
const W=680,H=420,R=22,BG1='#0d1f0d',BG2='#0a150a',AC='#4caf50'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'blackjack',description:'Play blackjack vs the dealer',category:'economy',usage:`${c.config.prefix}blackjack <bet>`,aliases:['bj','21'],baseXp:20})}
run=async(M:ISimplifiedMessage,{joined}:IParsedArgs):Promise<void>=>{const bet=joined.trim()||'50'
try{const res=await ECO.blackjack(M.sender.jid,bet);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🃏 BLACKJACK',W/2,55)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,40,80,600,100,R);ctx.fill()
ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='15px "Segoe UI",sans-serif';ctx.fillText(`Your hand: ${res.player.join('+')} = ${res.playerTotal}`,W/4,110)
ctx.fillText(`Dealer: ${res.dealer.join('+')} = ${res.dealerTotal}`,W*3/4,110)
ctx.fillStyle='rgba(255,255,255,0.08)';rr(ctx,60,200,560,130,R);ctx.fill()
const oc=res.outcome;const won=oc==='win';const draw=oc==='draw'
ctx.fillStyle=won?'#4caf50':draw?'#ffa000':'#ff5252';ctx.font='bold 44px "Segoe UI",sans-serif'
ctx.fillText(won?`🏆 YOU WIN +${formatMoney(res.delta)}`:draw?'🤝 PUSH':`💔 YOU LOSE -${formatMoney(Math.abs(res.delta))}`,W/2,270)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='14px "Segoe UI",sans-serif';ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}`,W/2,310)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=won?`🃏 Won +${formatMoney(res.delta)}`:`🃏 ${draw?'Push':'Lost -'+formatMoney(Math.abs(res.delta))}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}