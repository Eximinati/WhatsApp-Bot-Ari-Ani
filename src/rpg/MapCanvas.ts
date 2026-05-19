import { createCanvas } from '@napi-rs/canvas'
import { PlayerProfile, ZoneId } from './types.js'
import { ZONES } from './constants/zones.js'

/**
 * Renders a stylized map of the System Era world with zones, connections, and player position.
 */
export async function createMapCanvas(p: PlayerProfile): Promise<Buffer> {
    const W = 880
    const H = 520
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // ─── Background ──────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, '#0c0a1a')
    bgGrad.addColorStop(0.5, '#1a1635')
    bgGrad.addColorStop(1, '#0c0a14')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, W, H)

    // Border
    ctx.strokeStyle = '#6d28d9'
    ctx.lineWidth = 2
    ctx.strokeRect(4, 4, W - 8, H - 8)

    // Title
    ctx.fillStyle = '#c4b5fd'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('🗺️ SYSTEM ERA — WORLD MAP', 20, 35)
    ctx.fillStyle = '#8b5cf6'
    ctx.font = '12px sans-serif'
    ctx.fillText(`📍 ${ZONES[p.currentZone]?.name || 'Unknown'}`, 22, 55)

    // ─── Draw connections (lines) ────────────────────
    const drawnConnections = new Set<string>()
    for (const [, zone] of Object.entries(ZONES)) {
        for (const connId of zone.connections) {
            const key = [zone.id, connId].sort().join('-')
            if (drawnConnections.has(key)) continue
            drawnConnections.add(key)
            const target = ZONES[connId]
            if (!target) continue

            const discovered = p.discoveredZones.includes(connId)
            ctx.strokeStyle = discovered ? '#6d28d9' : '#1e1b4b'
            ctx.lineWidth = discovered ? 1.5 : 1
            ctx.setLineDash(discovered ? [] : [4, 4])
            ctx.beginPath()
            ctx.moveTo(zone.x + 12, zone.y + 12)
            ctx.lineTo(target.x + 12, target.y + 12)
            ctx.stroke()
            ctx.setLineDash([])
        }
    }

    // ─── Draw zones ───────────────────────────────────
    for (const [, zone] of Object.entries(ZONES)) {
        const discovered = p.discoveredZones.includes(zone.id) || zone.id === p.currentZone
        const isCurrent = zone.id === p.currentZone
        const canTravel = ZONES[p.currentZone]?.connections.includes(zone.id) || zone.id === p.currentZone

        const zx = zone.x
        const zy = zone.y
        const size = isCurrent ? 56 : 48

        // Zone background
        if (isCurrent) {
            // Glow
            const glow = ctx.createRadialGradient(zx + size / 2, zy + size / 2, 4, zx + size / 2, zy + size / 2, 40)
            glow.addColorStop(0, '#7c3aed44')
            glow.addColorStop(1, '#00000000')
            ctx.fillStyle = glow
            ctx.beginPath()
            ctx.arc(zx + size / 2, zy + size / 2, 40, 0, Math.PI * 2)
            ctx.fill()
        }

        // Rect background
        ctx.fillStyle = discovered ? (isCurrent ? '#3b1f7e' : '#1e1b4b') : '#0f0d1a'
        ctx.beginPath()
        ctx.roundRect(zx, zy, size, size, 8)
        ctx.fill()

        // Border
        ctx.strokeStyle = isCurrent ? '#a78bfa' : discovered ? '#4c1d95' : '#1e1b4b'
        ctx.lineWidth = isCurrent ? 2.5 : 1.5
        ctx.stroke()

        // Can't travel indicator
        if (!canTravel && !isCurrent) {
            ctx.fillStyle = '#00000088'
            ctx.beginPath()
            ctx.roundRect(zx, zy, size, size, 8)
            ctx.fill()
        }

        // Icon
        if (discovered || isCurrent || zone.minLevel <= p.level + 2) {
            ctx.font = `${isCurrent ? 22 : 18}px sans-serif`
            ctx.fillText(zone.icon, zx + (isCurrent ? 14 : 16), zy + (isCurrent ? 30 : 26))
        } else {
            ctx.fillStyle = '#71717a'
            ctx.font = '16px sans-serif'
            ctx.fillText('?', zx + 16, zy + 26)
        }

        // Name label
        if (discovered || isCurrent || zone.minLevel <= p.level + 2) {
            ctx.fillStyle = isCurrent ? '#f5f3ff' : discovered ? '#a78bfa' : '#52525b'
            ctx.font = `${isCurrent ? 'bold ' : ''}9px sans-serif`
            const name = zone.name.replace(/[^\w\s]/g, '').trim().slice(0, 12)
            ctx.fillText(name, zx + 4, zy - 4)
        }

        // Level requirement
        if (discovered && !isCurrent && zone.minLevel > p.level) {
            ctx.fillStyle = '#ef4444'
            ctx.font = 'bold 9px sans-serif'
            ctx.fillText(`Lv.${zone.minLevel}`, zx + 4, zy + size + 14)
        }
    }

    // ─── Legend ────────────────────────────────────────
    const lx = 20
    const ly = H - 105
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(lx, ly, 220, 90, 6)
    ctx.fill()

    ctx.font = 'bold 10px sans-serif'
    ctx.fillStyle = '#c4b5fd'
    ctx.fillText('━━━ LEGEND ━━━', lx + 60, ly + 18)

    ctx.fillStyle = '#a78bfa'
    ctx.beginPath()
    ctx.roundRect(lx + 10, ly + 28, 10, 10, 2)
    ctx.fill()
    ctx.fillStyle = '#c4b5fd'
    ctx.font = '10px sans-serif'
    ctx.fillText('Current Location', lx + 26, ly + 38)

    ctx.fillStyle = '#4c1d95'
    ctx.beginPath()
    ctx.roundRect(lx + 10, ly + 48, 10, 10, 2)
    ctx.fill()
    ctx.fillStyle = '#a78bfa'
    ctx.font = '10px sans-serif'
    ctx.fillText('Discovered Zone', lx + 26, ly + 58)

    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#6d28d9'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(lx + 10, ly + 73)
    ctx.lineTo(lx + 28, ly + 73)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#c4b5fd'
    ctx.fillText('Connected Path', lx + 34, ly + 78)

    // ─── Player stats sidebar ──────────────────────────
    const sx = W - 200
    const sy = 70
    ctx.fillStyle = '#1e1b4b'
    ctx.beginPath()
    ctx.roundRect(sx, sy, 175, 140, 6)
    ctx.fill()

    ctx.font = 'bold 11px sans-serif'
    ctx.fillStyle = '#c4b5fd'
    ctx.fillText(`👤 ${p.name}`, sx + 10, sy + 20)
    ctx.fillStyle = '#a78bfa'
    ctx.font = '10px sans-serif'
    ctx.fillText(`Lv.${p.level} | Zone: ${ZONES[p.currentZone]?.icon || '?'}`, sx + 10, sy + 38)
    ctx.fillText(`Discovered: ${p.discoveredZones.length}/10`, sx + 10, sy + 55)

    // Danger bar
    const zone = ZONES[p.currentZone]
    if (zone) {
        ctx.fillStyle = '#1e1b4b'
        ctx.fillRect(sx + 10, sy + 65, 155, 8)
        const dGrad = ctx.createLinearGradient(sx + 10, 0, sx + 165, 0)
        dGrad.addColorStop(0, '#22c55e')
        dGrad.addColorStop(0.5, '#eab308')
        dGrad.addColorStop(1, '#ef4444')
        ctx.fillStyle = dGrad
        ctx.fillRect(sx + 10, sy + 65, 155 * (zone.dangerLevel / 10), 8)
        ctx.fillStyle = '#ffffff'
        ctx.font = '8px sans-serif'
        ctx.fillText(`Danger: ${zone.dangerLevel}/10`, sx + 10, sy + 83)

        ctx.fillStyle = '#a78bfa'
        ctx.fillText(`Treasure: x${zone.treasureMultiplier}`, sx + 10, sy + 100)
        ctx.fillStyle = '#71717a'
        ctx.font = '8px sans-serif'
        ctx.fillText(zone.lore.slice(0, 130), sx + 10, sy + 118)
    }

    // ─── Movement hint ─────────────────────────────────
    ctx.fillStyle = '#c4b5fd'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('Travel: !rpgmove <zone>', W - 195, H - 15)

    return canvas.toBuffer('image/png')
}