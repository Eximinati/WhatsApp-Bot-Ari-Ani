import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
const W=680,H=400,R=22,BG1='#1a0d2e',BG2='#0d0020',AC='#b388ff'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'collect',description:'Collect farm/invest returns',category:'economy',usage:`${c.config.prefix}collect`,aliases:['harvest','gather'],baseXp:15})}
run=async(M:ISimplifiedMessage,_:IParsedArgs):Promise<void>=>{try{const res=await ECO.collect(M.sender.jid);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('📦 COLLECT',W/2,58)
if(res.ok){ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,40,85,600,res.rewards.length>1?200:140,R);ctx.fill()
ctx.fillStyle=AC;ctx.font='bold 50px "Segoe UI",sans-serif';ctx.fillText(`+${formatMoney(res.total)}`,W/2,165)
ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='16px "Segoe UI",sans-serif'
res.rewards.forEach((rw,i)=>{ctx.fillText(`${rw.label}: +${formatMoney(rw.amount)}`,W/2,200+i*24)})
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='14px "Segoe UI",sans-serif';ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}`,W/2,280+res.rewards.length*8)}
else{ctx.fillStyle='rgba(255,160,40,0.12)';rr(ctx,80,90,520,150,R);ctx.fill()
ctx.fillStyle='#ffa040';ctx.font='bold 28px "Segoe UI",sans-serif';ctx.fillText(res.reason==='cooldown'?'⏳ Cooldown':res.reason==='not-ready'?'⏳ Not ready yet':'📭 Nothing to collect',W/2,150)
ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='17px "Segoe UI",sans-serif';ctx.fillText(res.reason==='cooldown'?`Wait ${formatDurationMs(res.remainingMs||0)}`:res.next?`Next in ${formatDurationMs((res.next as unknown as Record<string,number>).remainingMs||0)}`:'Use /farm or /invest first',W/2,190)}
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=res.ok?`📦 Collected +${formatMoney(res.total)} | ${res.rewards.map(r=>r.label).join(', ')}`:res.reason==='cooldown'?`⏳ ${formatDurationMs(res.remainingMs||0)}`:'Nothing to collect yet'
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}