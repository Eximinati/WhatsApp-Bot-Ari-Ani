import { createCanvas, loadImage, Image } from '@napi-rs/canvas'
import { PlayerProfile } from './types.js'
import { ORIGINS, TRAITS, TITLES, EVOLUTIONS, ITEMS } from './data.js'

let cachedImage: { url: string; img: Image } | null = null

export async function createCharacterCanvas(p: PlayerProfile): Promise<Buffer> {
    const W = 1200
    const H = 800
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // ═══ BACKGROUND ═══
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#0a0a0f')
    bgGrad.addColorStop(0.5, '#12121f')
    bgGrad.addColorStop(1, '#0a0a12')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // ═══ BORDER FRAME ═══
    ctx.strokeStyle = '#8b5cf6'
    ctx.lineWidth = 6
    ctx.strokeRect(12, 12, W - 24, H - 24)
    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 2
    ctx.strokeRect(28, 28, W - 56, H - 56)

    // ═══ HEADER BAR ═══
    const headerGrad = ctx.createLinearGradient(0, 40, W, 40)
    headerGrad.addColorStop(0, '#4c1d95')
    headerGrad.addColorStop(0.5, '#7c3aed')
    headerGrad.addColorStop(1, '#4c1d95')
    ctx.fillStyle = headerGrad
    ctx.beginPath()
    ctx.roundRect(40, 44, W - 80, 52, 12)
    ctx.fill()
    ctx.fillStyle = '#f5f3ff'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('📊 SYSTEM STATUS CARD', W / 2, 78)
    ctx.textAlign = 'left'

    const origin = ORIGINS[p.origin]
    const originLabel = origin?.name?.replace(/[^\w\s]/g, '').trim() || 'Unknown'

    // ═══ CHARACTER PORTRAIT AREA ═══
    const cx = 220
    const cy = 260

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

    // ═══ AURA GLOW (larger) ═══
    const auraGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 180)
    auraGrad.addColorStop(0, mainColor + '55')
    auraGrad.addColorStop(0.5, mainColor + '22')
    auraGrad.addColorStop(1, '#00000000')
    ctx.fillStyle = auraGrad
    ctx.beginPath()
    ctx.arc(cx, cy, 180, 0, Math.PI * 2)
    ctx.fill()

    // ═══ TRY LOAD EXTERNAL IMAGE ═══
    let drewImage = false
    if (p.characterImageUrl) {
        try {
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
                ctx.save()
                ctx.beginPath()
                ctx.arc(cx, cy - 10, 80, 0, Math.PI * 2)
                ctx.clip()
                ctx.drawImage(cachedImage.img, cx - 80, cy - 90, 160, 160)
                ctx.restore()
                ctx.strokeStyle = mainColor
                ctx.lineWidth = 5
                ctx.beginPath()
                ctx.arc(cx, cy - 10, 80, 0, Math.PI * 2)
                ctx.stroke()
                drewImage = true
            }
        } catch {
            // fall through to silhouette
        }
    }

    // ═══ FALLBACK: CHARACTER SILHOUETTE (larger) ═══
    if (!drewImage) {
        // Head
        ctx.fillStyle = '#2d1b69'
        ctx.beginPath()
        ctx.arc(cx, cy - 60, 40, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = mainColor
        ctx.lineWidth = 3
        ctx.stroke()

        // Body
        ctx.fillStyle = '#3b1f7e'
        ctx.beginPath()
        ctx.roundRect(cx - 30, cy - 15, 60, 100, 12)
        ctx.fill()
        ctx.stroke()

        // Shoulders/arms
        ctx.fillStyle = '#4c2a9e'
        ctx.beginPath()
        ctx.roundRect(cx - 50, cy - 12, 100, 28, 10)
        ctx.fill()
        ctx.stroke()

        // Eyes
        ctx.fillStyle = mainColor
        ctx.shadowColor = mainColor
        ctx.shadowBlur = 12
        ctx.beginPath()
        ctx.arc(cx - 14, cy - 65, 6, 0, Math.PI * 2)
        ctx.arc(cx + 14, cy - 65, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Weapon if equipped
        if (p.equipment.weapon) {
            ctx.strokeStyle = p.equipment.weapon === 'cursed_blade_hunger' ? '#ef4444' : '#94a3b8'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(cx - 20, cy + 30)
            ctx.lineTo(cx - 20, cy + 80)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(cx - 36, cy + 32)
            ctx.lineTo(cx - 4, cy + 32)
            ctx.stroke()
        }
    }

    // ═══ NAME & INFO PANEL ═══
    const panelX = 440
    const panelY = 120

    // ═══ NAME ═══
    ctx.fillStyle = '#f5f3ff'
    ctx.font = 'bold 42px sans-serif'
    ctx.fillText(p.name, panelX, panelY + 30)

    // ═══ ORIGIN ═══
    ctx.fillStyle = '#a78bfa'
    ctx.font = '22px sans-serif'
    ctx.fillText(`💠 ${originLabel}`, panelX, panelY + 62)

    // ═══ LEVEL & XP ═══
    ctx.fillStyle = '#c4b5fd'
    ctx.font = '18px sans-serif'
    const xpForLvl = Math.floor(50 * Math.pow(p.level, 1.4))
    ctx.fillText(`🎖️ Lv. ${p.level}  |  ⭐ XP: ${p.xp}/${xpForLvl}  |  ⚔️ Power: ${Math.floor(p.stats.strength * 3 + p.stats.agility * 2 + p.stats.endurance * 2 + p.stats.intelligence + p.stats.mana * 1.5)}`, panelX, panelY + 92)

    // ═══ DIVIDER ═══
    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(panelX, panelY + 108)
    ctx.lineTo(W - 60, panelY + 108)
    ctx.stroke()

    // ═══ STATS ═══
    const statsStart = panelY + 140
    const statData: Array<[string, number, string, string]> = [
        ['💪 STR', p.stats.strength, '#ef4444', '#dc2626'],
        ['🏃 AGI', p.stats.agility, '#22c55e', '#16a34a'],
        ['🛡️ END', p.stats.endurance, '#3b82f6', '#2563eb'],
        ['🧠 INT', p.stats.intelligence, '#a855f7', '#9333ea'],
        ['🔮 MANA', p.stats.mana, '#06b6d4', '#0891b2'],
    ]

    for (let i = 0; i < statData.length; i++) {
        const [label, val, color, darkColor] = statData[i]
        const x = i < 3 ? panelX : panelX + 370
        const y = statsStart + (i % 3) * 46

        // Background
        ctx.fillStyle = '#1e1b4b'
        ctx.beginPath()
        ctx.roundRect(x, y, 320, 32, 8)
        ctx.fill()

        // Fill bar
        const fillWidth = Math.min(320, (val / 50) * 320)
        const statGrad = ctx.createLinearGradient(x, 0, x + 320, 0)
        statGrad.addColorStop(0, color)
        statGrad.addColorStop(1, darkColor)
        ctx.fillStyle = statGrad
        ctx.beginPath()
        ctx.roundRect(x, y, fillWidth, 32, 8)
        ctx.fill()

        // Label and value
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 18px sans-serif'
        ctx.fillText(`${label}: ${val}`, x + 12, y + 24)
    }

    // ═══ GAUGE BARS ═══
    const gaugeY = statsStart + 160

    // HP Bar
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(panelX, gaugeY, 700, 24, 12)
    ctx.fill()
    const hpFrac = Math.max(0.02, Math.min(1, p.gauges.hp / p.gauges.maxHp))
    const hpGrad = ctx.createLinearGradient(panelX, 0, panelX + 700, 0)
    hpGrad.addColorStop(0, '#ef4444')
    hpGrad.addColorStop(1, '#b91c1c')
    ctx.fillStyle = hpGrad
    ctx.beginPath()
    ctx.roundRect(panelX, gaugeY, 700 * hpFrac, 24, 12)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`❤️ HP: ${p.gauges.hp}/${p.gauges.maxHp}`, panelX + 16, gaugeY + 18)

    // MP Bar
    const mpY = gaugeY + 36
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(panelX, mpY, 700, 24, 12)
    ctx.fill()
    const mpFrac = Math.max(0.02, Math.min(1, p.gauges.mp / p.gauges.maxMp))
    const mpGrad = ctx.createLinearGradient(panelX, 0, panelX + 700, 0)
    mpGrad.addColorStop(0, '#3b82f6')
    mpGrad.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = mpGrad
    ctx.beginPath()
    ctx.roundRect(panelX, mpY, 700 * mpFrac, 24, 12)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`💙 MP: ${p.gauges.mp}/${p.gauges.maxMp}`, panelX + 16, mpY + 18)

    // Stamina Bar
    const staY = mpY + 36
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(panelX, staY, 700, 24, 12)
    ctx.fill()
    const staFrac = Math.max(0.02, Math.min(1, p.gauges.stamina / p.gauges.maxStamina))
    const staGrad = ctx.createLinearGradient(panelX, 0, panelX + 700, 0)
    staGrad.addColorStop(0, '#22c55e')
    staGrad.addColorStop(1, '#15803d')
    ctx.fillStyle = staGrad
    ctx.beginPath()
    ctx.roundRect(panelX, staY, 700 * staFrac, 24, 12)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(`⚡ STA: ${p.gauges.stamina}/${p.gauges.maxStamina}`, panelX + 16, staY + 18)

    // ═══ EVOLUTION BANNER ═══
    const bottomY = staY + 50
    if (p.evolutionPath) {
        const evo = EVOLUTIONS[p.evolutionPath]
        const evoGrad = ctx.createLinearGradient(panelX, 0, panelX + 700, 0)
        evoGrad.addColorStop(0, mainColor + '66')
        evoGrad.addColorStop(0.5, mainColor + '88')
        evoGrad.addColorStop(1, mainColor + '66')
        ctx.fillStyle = evoGrad
        ctx.beginPath()
        ctx.roundRect(panelX, bottomY, 700, 40, 10)
        ctx.fill()
        ctx.strokeStyle = mainColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(panelX, bottomY, 700, 40, 10)
        ctx.stroke()
        ctx.fillStyle = '#f5f3ff'
        ctx.font = 'bold 20px sans-serif'
        ctx.fillText(`🌀 ${evo?.name || p.evolutionPath}`, panelX + 16, bottomY + 28)
    }

    // ═══ KARMA + DEATHS ═══
    const karmaY = p.evolutionPath ? bottomY + 60 : bottomY
    const karmaIcon = p.karma > 20 ? '☀️ Light' : p.karma < -20 ? '🌑 Dark' : '⚖️ Neutral'
    ctx.fillStyle = '#a78bfa'
    ctx.font = '17px sans-serif'
    ctx.fillText(`⚖️ Karma: ${karmaIcon} (${p.karma})  |  🍀 Luck: ${p.luck}/10`, panelX, karmaY + 18)

    // ═══ TITLES ═══
    const titleNames = p.titles.slice(0, 5).map(t => TITLES[t]?.name).filter(Boolean).join('  •  ')
    if (titleNames) {
        ctx.fillStyle = '#c4b5fd'
        ctx.font = '15px sans-serif'
        ctx.fillText(`🏅 Titles: ${titleNames}`, panelX, karmaY + 42)
    }

    // ═══ DEATHS ═══
    ctx.fillStyle = '#71717a'
    ctx.font = '16px sans-serif'
    ctx.fillText(`💀 Deaths: ${p.deaths}  |  💰 Coins: ${p.currency}`, panelX + 450, karmaY + 18)

    // ═══ MENTAL STATE ═══
    if (p.mentalState.length > 0) {
        ctx.fillStyle = '#a78bfa'
        ctx.font = '15px sans-serif'
        ctx.fillText(`🧠 Mental: ${p.mentalState.join(', ')}`, panelX + 450, karmaY + 42)
    }

    // ═══ FOOTER ═══
    ctx.fillStyle = '#27272a'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('⚡ SYSTEM ERA RPG', W - 50, H - 22)
    ctx.textAlign = 'left'

    return canvas.toBuffer('image/png')
}