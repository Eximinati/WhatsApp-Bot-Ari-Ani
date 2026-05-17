import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
const W=680,H=360,R=22,BG1='#0d1a26',BG2='#050d14',AC='#26c6da'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'invest',description:'Invest your coins in the market',category:'economy',usage:`${c.config.prefix}invest <amount>`,aliases:['stocks'],baseXp:20})}
run=async(M:ISimplifiedMessage,{joined}:IParsedArgs):Promise<void>=>{const amt=joined.trim()||'100'
try{const res=await ECO.invest(M.sender.jid,amt);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('📈 INVESTMENT',W/2,60)
if(res.ok){ctx.fillStyle='rgba(255,255,255,0.08)';rr(ctx,80,90,520,170,R);ctx.fill();ctx.fillStyle=AC;ctx.font='bold 44px "Segoe UI",sans-serif';ctx.fillText(`-${formatMoney(res.amount)}`,W/2,165);ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='17px "Segoe UI",sans-serif';ctx.fillText(res.message,W/2,210);ctx.fillStyle='rgba(255,255,255,0.45)';ctx.font='15px "Segoe UI",sans-serif';ctx.fillText(`Matures in ${formatDurationMs(new Date(res.readyAt).getTime()-Date.now())}`,W/2,240)}
else{ctx.fillStyle='rgba(255,160,40,0.12)';rr(ctx,80,90,520,170,R);ctx.fill();ctx.fillStyle='#ffa040';ctx.font='bold 28px "Segoe UI",sans-serif';ctx.fillText(res.reason==='ready'?'💰 Ready to collect!':'⏳ Active investment',W/2,165);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='17px "Segoe UI",sans-serif';ctx.fillText(res.reason==='ready'?'Use /collect now!':`Wait ${formatDurationMs(res.remainingMs||0)}`,W/2,215)}
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy • /collect to harvest',W/2,H-16)
const cap=res.ok?`📈 Invested ${formatMoney(res.amount)} | Expected: ${formatMoney(res.expectedPayout)}`:res.reason==='ready'?'💰 Ready! Use /collect':`⏳ ${formatDurationMs(res.remainingMs||0)}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}