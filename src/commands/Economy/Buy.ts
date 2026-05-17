import { createCanvas } from '@napi-rs/canvas'
import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import { MessageType, Mimetype } from '../../core/types.js'
import { EconomyService } from '../../core/economy/EconomyService.js'
import { formatMoney } from '../../core/economy/utils.js'
const W=680,H=380,R=22,BG1='#0d1a26',BG2='#1a2a3a',AC='#4fc3f7'
function rr(ctx:import('@napi-rs/canvas').SKRSContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}
const ECO=new EconomyService()
export default class Command extends CommandModule{constructor(c:RuntimeClient,h:MessagePipeline){super(c,h,{command:'buy',description:'Buy an item from the shop',category:'economy',usage:`${c.config.prefix}buy <item> [quantity]`,aliases:['purchase'],baseXp:10})}
run=async(M:ISimplifiedMessage,{args}:IParsedArgs):Promise<void>=>{const key=(args[0]||'').toLowerCase();const qty=args[1]||'1'
if(!key)return void M.reply('❌ Use /shop to see available items, then /buy <item>.')
try{const res=await ECO.buy(M.sender.jid,key,qty);const cv=createCanvas(W,H),ctx=cv.getContext('2d');const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG1);g.addColorStop(1,BG2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
ctx.fillStyle=AC;ctx.font='bold 30px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('🛒 PURCHASE',W/2,58)
ctx.fillStyle='rgba(255,255,255,0.06)';rr(ctx,60,90,560,180,R);ctx.fill()
ctx.fillStyle=AC;ctx.font='bold 28px "Segoe UI",sans-serif';ctx.fillText(res.item.name,W/2,140)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='bold 44px "Segoe UI",sans-serif';ctx.fillText(`-${formatMoney(res.totalPrice)}`,W/2,205)
ctx.fillStyle='rgba(255,255,255,0.55)';ctx.font='16px "Segoe UI",sans-serif';ctx.fillText(`Qty: ${res.quantity} | Own: ${res.inventory[key]||0}`,W/2,240)
ctx.fillStyle='rgba(255,255,255,0.7)';ctx.font='14px "Segoe UI",sans-serif';ctx.fillText(`Wallet: ${formatMoney(res.account.wallet)} | Bank: ${formatMoney(res.account.bank)}`,W/2,270)
ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Ari-Ani Economy • /shop for items',W/2,H-16)
const cap=`🛒 Bought ${res.quantity}x ${res.item.name} for ${formatMoney(res.totalPrice)} | Wallet: ${formatMoney(res.account.wallet)}`
return void M.reply(cv.toBuffer('image/png'),MessageType.image,Mimetype.png,undefined,cap)}catch(e){return void M.reply(`❌ ${e instanceof Error?e.message:'Error'}`)}}
}