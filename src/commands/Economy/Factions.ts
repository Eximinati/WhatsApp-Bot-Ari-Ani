import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
const W=680,R=22,BG1='#1a0a2e',BG2='#0d0020',AC='#b388ff'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'factions',description:'List all factions',category:'economy',usage:`${c.config.prefix}factions`,aliases:['guilds','teams'],baseXp:5})}
run=async(M:ISimplifiedMessage,_:IParsedArgs):Promise<void>=>{try{const factions=await ECO.getFactions();const top=await ECO.getFactionTop(5)
const Hr=120+factions.length*52;const cv=createCanvas(W,Hr),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,Hr);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,Hr)
ctx.fillStyle=AC;ctx.font='bold 28px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🏴 FACTIONS',W/2,48)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,30,70,W-60,Hr-90,R);ctx.fill()
factions.forEach((f,i)=>{const y=105+i*52;ctx.fillStyle=i%2===0?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.02)';rr(ctx,40,y-6,W-80,44,8);ctx.fill()
ctx.fillStyle='#fff';ctx.font='bold 17px "Segoe UI",sans-serif';ctx.textAlign='left';ctx.fillText(f.name,50,y+16)
ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='13px "Segoe UI",sans-serif';ctx.fillText(f.description,W-200,y+16)
ctx.fillStyle=AC;ctx.textAlign='right';ctx.fillText(`💰 ${formatMoney(f.treasury)} | 👥 ${f.memberCount}`,W-50,y+34)})
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy • /faction join <key>',W/2,Hr-16)
const cap=factions.map(f=>`${f.name} — 💰${formatMoney(f.treasury)} 👥${f.memberCount}`).join('\n')
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,`🏴 *FACTIONS*\n━━━━━━\n${cap}`)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}