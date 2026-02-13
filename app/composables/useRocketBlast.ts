export function useRocketBlast() {
  async function launch() {
    const { emojiBlast } = await import('emoji-blast')

    // 1. Create rocket element (starts bottom-left, flies to upper-right)
    const rocket = document.createElement('div')
    rocket.textContent = '\uD83D\uDE80'
    rocket.style.cssText = `
      position: fixed;
      bottom: -60px;
      left: 35%;
      font-size: 48px;
      z-index: 9999;
      transition: bottom 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      pointer-events: none;
    `
    document.body.appendChild(rocket)

    // 2. Launch rocket: bottom-left → upper-center-right
    requestAnimationFrame(() => {
      rocket.style.bottom = '55%'
      rocket.style.left = '50%'
    })

    // 3. After rocket reaches top, explode into hearts
    await new Promise(r => setTimeout(r, 850))
    rocket.remove()

    // 4. Heart-shaped burst positions (parametric heart curve)
    const cx = window.innerWidth / 2
    const cy = window.innerHeight * 0.42
    const scale = 8

    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2
      // Heart curve: x = 16sin³(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
      const hx = 16 * Math.sin(t) ** 3
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      const x = cx + hx * scale
      const y = cy + hy * scale

      emojiBlast({
        emojis: ['\u2764\uFE0F', '\uD83D\uDC96', '\uD83D\uDC95', '\uD83E\uDE77'],
        emojiCount: 3,
        position: { x, y },
        physics: {
          fontSize: { max: 28, min: 16 },
          gravity: 0.12,
          initialVelocities: {
            x: { max: 8, min: -8 },
            y: { max: -4, min: -15 },
          },
          rotation: { max: 30, min: -30 },
        },
      })
    }
  }

  return { launch }
}
