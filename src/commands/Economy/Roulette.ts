import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
const W=680,H=420,R=22,BG1='#1a0a0a',BG2='#2d0000',ACr='#ff1744',ACb='#1a1a1a',ACg='#0d5c0d'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'roulette',description:'Spin the roulette wheel',category:'economy',usage:`${c.config.prefix}roulette red|black|green|0-12 <bet>`,aliases:['roul'],baseXp:20})}
run=async(M:ISimplifiedMessage,{args,joined}:IParsedArgs):Promise<void>=>{const bt=args[0]||'red';const bet=args.slice(1).join(' ')||'50'
try{const res=await ECO.roulette(M.sender.jid,bt,bet);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle='#ffd700';ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🎡 ROULETTE',W/2,55)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,60,90,560,210,R);ctx.fill()
// Wheel visual
const cx=W/2,cy=180,r=70;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2)
const cg=ctx.createRadialGradient(cx-10,cy-10,10,cx,cy,r)
cg.addColorStop(0,'#1a1a1a');cg.addColorStop(0.5,'#2d0000');cg.addColorStop(1,res.color==='red'?ACr:res.color==='black'?ACb:ACg)
ctx.fillStyle=cg;ctx.fill()
ctx.strokeStyle='#ffd700';ctx.lineWidth=3;ctx.stroke()
ctx.fillStyle='#fff';ctx.font='bold 36px "Segoe UI",sans-serif';ctx.fillText(String(res.spin),cx,cy+12)
ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='20px "Segoe UI",sans-serif';ctx.fillText(`Ball landed on ${res.color} #${res.spin}`,W/2,270)
ctx.fillStyle='rgba(255,255,255,0.08)';rr(ctx,60,300,560,50,R);ctx.fill()
ctx.fillStyle=res.win?'#4caf50':'#ff5252';ctx.font='bold 26px "Segoe UI",sans-serif'
ctx.fillText(res.win?`YOU WIN +${formatMoney(res.delta)}`:`YOU LOSE -${formatMoney(Math.abs(res.delta))}`,W/2,333)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='13px "Segoe UI",sans-serif';ctx.fillText(`W:${formatMoney(res.account.wallet)} | B:${formatMoney(res.account.bank)} | Chose: ${res.selection}`,W/2,365)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy',W/2,H-16)
const cap=res.win?`🎡 Won +${formatMoney(res.delta)} | ${res.selection}→${res.color}#${res.spin}`:`🎡 Lost -${formatMoney(Math.abs(res.delta))}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}