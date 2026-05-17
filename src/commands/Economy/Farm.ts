import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney, formatDurationMs } from '../../core/economy/utils.js'
const W=680,H=360,R=22,BG1='#0d2e0d',BG2='#0a1a0a',AC='#76ff03'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'farm',description:'Plant crops to harvest later',category:'economy',usage:`${c.config.prefix}farm`,aliases:['plant'],baseXp:15})}
run=async(M:ISimplifiedMessage,_:IParsedArgs):Promise<void>=>{try{const res=await ECO.farm(M.sender.jid);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🌱 FARM',W/2,60)
if(res.ok){ctx.fillStyle='rgba(255,255,255,0.08)';rr(ctx,80,90,520,170,R);ctx.fill();ctx.fillStyle=AC;ctx.font='bold 46px "Segoe UI",sans-serif';ctx.fillText(`🌾 +${formatMoney(res.reward)}`,W/2,170);ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='18px "Segoe UI",sans-serif';ctx.fillText('Crop planted — use /collect to harvest!',W/2,215);ctx.fillStyle='rgba(255,255,255,0.45)';ctx.font='15px "Segoe UI",sans-serif';ctx.fillText(`Ready in ${formatDurationMs(new Date(res.readyAt).getTime()-Date.now())}`,W/2,245)}
else if(res.reason==='ready'){ctx.fillStyle='rgba(255,160,40,0.12)';rr(ctx,80,90,520,170,R);ctx.fill();ctx.fillStyle='#ffa040';ctx.font='bold 30px "Segoe UI",sans-serif';ctx.fillText('🌾 Ready to harvest!',W/2,170);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='18px "Segoe UI",sans-serif';ctx.fillText('Use /collect now!',W/2,215)}
else{ctx.fillStyle='rgba(255,160,40,0.08)';rr(ctx,80,90,520,170,R);ctx.fill();ctx.fillStyle='#ffa040';ctx.font='bold 28px "Segoe UI",sans-serif';ctx.fillText('🌱 Still growing...',W/2,170);ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='17px "Segoe UI",sans-serif';ctx.fillText(`Wait ${formatDurationMs(res.remainingMs||0)}`,W/2,215)}
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=res.ok?`🌱 Planted! +${formatMoney(res.reward)} | Collect later`:res.reason==='ready'?'🌾 Ready! Use /collect':`⏳ ${formatDurationMs(res.remainingMs||0)}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}