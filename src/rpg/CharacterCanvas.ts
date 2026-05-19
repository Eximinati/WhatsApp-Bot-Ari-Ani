import { createCanvas, loadImage, Image } from '@napi-rs/canvas'
import { PlayerProfile } from './types.js'
import { ORIGINS, TRAITS, TITLES, EVOLUTIONS, ITEMS } from './data.js'

let cachedImage: { url: string; img: Image } | null = null

export async function createCharacterCanvas(p: PlayerProfile): Promise<Buffer> {
    const W = 720
    const H = 520
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#0a0a0f')
    bgGrad.addColorStop(0.5, '#12121f')
    bgGrad.addColorStop(1, '#0a0a12')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = '#8b5cf6'
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, W - 12, H - 12)
    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 1
    ctx.strokeRect(16, 16, W - 32, H - 32)

    const origin = ORIGINS[p.origin]
    const originLabel = origin?.name?.replace(/[^\w\s]/g, '').trim() || 'Unknown'

    // Character visual area
    const cx = 160
    const cy = 220

    let mainColor = '#6d28d9'
    if (p.evolutionPath) {
        if (p.evolutionPath === 'execution_path') mainColor = '#dc2626'
        else if (p.evolutionPath === 'shadow_path') mainColor = '#1e1b4b'
        else if (p.evolutionPath === 'dragon_path') mainColor = '#ea580c'
        else if (p.evolutionPath === 'void_path') mainColor = '#4c1d95'
        else if (p.evolutionPath === 'saint_path') mainColor = '#fbbf24'
        else if (p.evolutionPath === 'cult_leader_path') mainColor = '#c026d3'
        else if (p.evolutionPath === 'tyrant_path') mainColor = '#b91c1c'
        else if (p.evolutionPath === 'apostle_path') mainColor = '#7c3aed'
        else if (p.evolutionPath === 'prophet_path') mainColor = '#0891b2'
        else if (p.evolutionPath === 'survivor_path') mainColor = '#15803d'
    }
    if (p.hiddenStats.corruption > 30) mainColor = '#7e22ce'

    // Aura glow
    const auraGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 120)
    auraGrad.addColorStop(0, mainColor + '44')
    auraGrad.addColorStop(1, '#00000000')
    ctx.fillStyle = auraGrad
    ctx.beginPath()
    ctx.arc(cx, cy, 120, 0, Math.PI * 2)
    ctx.fill()

    // Try to load external character image
    let drewImage = false
    if (p.characterImageUrl) {
        try {
            // Use cache to avoid re-downloading on every status check
            if (!cachedImage || cachedImage.url !== p.characterImageUrl) {
                const response = await fetch(p.characterImageUrl)
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer()
                    const buf = Buffer.from(arrayBuffer)
                    const img = await loadImage(buf)
                    cachedImage = { url: p.characterImageUrl, img }
                } else {
                    cachedImage = null
                }
            }
            if (cachedImage && cachedImage.url === p.characterImageUrl) {
                // Draw the external image as circular portrait
                ctx.save()
                ctx.beginPath()
                ctx.arc(cx, cy - 10, 56, 0, Math.PI * 2)
                ctx.clip()
                ctx.drawImage(cachedImage.img, cx - 56, cy - 66, 112, 112)
                ctx.restore()
                ctx.strokeStyle = mainColor
                ctx.lineWidth = 3
                ctx.beginPath()
                ctx.arc(cx, cy - 10, 56, 0, Math.PI * 2)
                ctx.stroke()
                drewImage = true
            }
        } catch {
            // Fall through to silhouette
        }
    }

    // Fallback: draw character silhouette
    if (!drewImage) {
        ctx.fillStyle = '#2d1b69'
        ctx.beginPath()
        ctx.arc(cx, cy - 50, 28, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = mainColor
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.fillStyle = '#3b1f7e'
        ctx.beginPath()
        ctx.roundRect(cx - 22, cy - 18, 44, 70, 8)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#4c2a9e'
        ctx.beginPath()
        ctx.roundRect(cx - 35, cy - 15, 70, 20, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = mainColor
        ctx.shadowColor = mainColor
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(cx - 10, cy - 52, 4, 0, Math.PI * 2)
        ctx.arc(cx + 10, cy - 52, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        if (p.equipment.weapon) {
            ctx.strokeStyle = p.equipment.weapon === 'cursed_blade_hunger' ? '#ef4444' : '#94a3b8'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(cx - 15, cy + 20)
            ctx.lineTo(cx - 15, cy + 55)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(cx - 25, cy + 22)
            ctx.lineTo(cx - 5, cy + 22)
            ctx.stroke()
        }
    }

    // Stats panel
    const panelX = 320
    const panelY = 40

    ctx.fillStyle = '#f5f3ff'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText(p.name, panelX, panelY + 20)

    ctx.fillStyle = '#a78bfa'
    ctx.font = '16px sans-serif'
    ctx.fillText(originLabel, panelX, panelY + 45)

    ctx.fillStyle = '#c4b5fd'
    ctx.font = '14px sans-serif'
    const xpForLvl = Math.floor(100 * Math.pow(p.level, 1.6))
    ctx.fillText(`Lv. ${p.level}  |  XP: ${p.xp}/${xpForLvl}`, panelX, panelY + 68)

    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(panelX, panelY + 80)
    ctx.lineTo(W - 30, panelY + 80)
    ctx.stroke()

    const statsStart = panelY + 105
    const statData: Array<[string, number, string]> = [
        ['STR', p.stats.strength, '#ef4444'],
        ['AGI', p.stats.agility, '#22c55e'],
        ['END', p.stats.endurance, '#3b82f6'],
        ['INT', p.stats.intelligence, '#a855f7'],
        ['MANA', p.stats.mana, '#06b6d4']
    ]

    for (let i = 0; i < statData.length; i++) {
        const [label, val, color] = statData[i]
        const x = panelX + (i >= 3 ? 200 : 0)
        const yOff = i >= 3 ? i - 3 : i

        ctx.fillStyle = '#1e1b4b'
        ctx.fillRect(x, statsStart + yOff * 28, 160, 18)
        const fillWidth = Math.min(160, (val / 30) * 160)
        ctx.fillStyle = color + '88'
        ctx.fillRect(x, statsStart + yOff * 28, fillWidth, 18)

        ctx.fillStyle = color
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`${label}: ${val}`, x + 6, statsStart + yOff * 28 + 14)
    }

    const gaugeY = statsStart + 120
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(panelX, gaugeY, 350, 12)
    const hpFrac = Math.min(1, p.gauges.hp / p.gauges.maxHp)
    const hpGrad = ctx.createLinearGradient(panelX, 0, panelX + 350, 0)
    hpGrad.addColorStop(0, '#ef4444')
    hpGrad.addColorStop(1, '#dc2626')
    ctx.fillStyle = hpGrad
    ctx.fillRect(panelX, gaugeY, 350 * hpFrac, 12)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(`HP: ${p.gauges.hp}/${p.gauges.maxHp}`, panelX + 8, gaugeY + 10)

    const mpY = gaugeY + 20
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(panelX, mpY, 350, 12)
    const mpFrac = Math.min(1, p.gauges.mp / p.gauges.maxMp)
    const mpGrad = ctx.createLinearGradient(panelX, 0, panelX + 350, 0)
    mpGrad.addColorStop(0, '#3b82f6')
    mpGrad.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = mpGrad
    ctx.fillRect(panelX, mpY, 350 * mpFrac, 12)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.fillText(`MP: ${p.gauges.mp}/${p.gauges.maxMp}`, panelX + 8, mpY + 10)

    const bottomY = gaugeY + 55
    if (p.evolutionPath) {
        const evo = EVOLUTIONS[p.evolutionPath]
        ctx.fillStyle = mainColor + '44'
        ctx.beginPath()
        ctx.roundRect(panelX, bottomY, 350, 30, 6)
        ctx.fill()
        ctx.fillStyle = mainColor
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`${evo?.name || p.evolutionPath}`, panelX + 10, bottomY + 20)
    }

    const karmaY = p.evolutionPath ? bottomY + 40 : bottomY
    const karmaIcon = p.karma > 20 ? 'Light' : p.karma < -20 ? 'Dark' : 'Neutral'
    ctx.fillStyle = '#a78bfa'
    ctx.font = '12px sans-serif'
    ctx.fillText(`Karma: ${karmaIcon}(${p.karma})`, panelX, karmaY + 14)

    const titleNames = p.titles.slice(0, 3).map(t => TITLES[t]?.name).filter(Boolean).join('  ')
    if (titleNames) {
        ctx.fillStyle = '#c4b5fd'
        ctx.font = '11px sans-serif'
        ctx.fillText(`Titles: ${titleNames}`, panelX, karmaY + 34)
    }

    ctx.fillStyle = '#71717a'
    ctx.font = '11px sans-serif'
    ctx.fillText(`Deaths: ${p.deaths}`, panelX + 280, karmaY + 14)

    ctx.fillStyle = '#27272a'
    ctx.font = '10px sans-serif'
    ctx.fillText('SYSTEM ERA RPG', W - 120, H - 12)

    return canvas.toBuffer('image/png')
}