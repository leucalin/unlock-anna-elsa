/**
 * 冰雪编程乐园 · 闯关证书渲染器（ported from the official site）
 *
 * 原始版本：http://222.243.213.67:17770/js/cert.js
 * 版式、配色与文案均保持官方实现；在此基础上：
 *   - 改为 ES module，去掉对 window.SCHOOL_BADGE 的全局依赖，校徽由调用方传入；
 *   - 支持传入自定义证书编号 `no`；
 *   - 支持直接渲染到已有 <canvas>（用于实时预览）。
 *
 * 用法：
 *   renderCertificate({ cls: '888', name: '张三' }, { stars: 60, total: 60, levels: 20, date: '2026-11-02', badge, canvas })
 *   downloadCertificate(canvas, user) // 文件名：888班张三冰雪编程世界通关证书.png
 */

export const CERT_WIDTH = 1000
export const CERT_HEIGHT = 1414

const GREEN = '#2E7D32'
const GREEN2 = '#66BB6A'
const GOLD = '#C9A227'
const CREAM = '#FCFDF7'
const RED = '#B5352C'
const INK = '#33502E'
const GRAY = '#8A9B8A'

function pad(n, width = 4) {
  let s = String(n)
  while (s.length < width) s = `0${s}`
  return s
}

function hashCode(s) {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** 证书编号：QYZX-年份-四位校验码 */
export function certNumber(cls, name, year) {
  const y = year || String(new Date().getFullYear())
  return `QYZX-${y}-${pad(hashCode(`${cls}:${name}`) % 10000)}`
}

const CN_DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 中文大写日期：2026-10-22 -> 二〇二六年十月二十二日 */
export function chineseDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!match) return iso || ''

  const [, year, monthRaw, dayRaw] = match
  const month = parseInt(monthRaw, 10)
  const day = parseInt(dayRaw, 10)

  function num(n) {
    if (n <= 10) return CN_DIGIT[n === 10 ? 0 : n] + (n === 10 ? '十' : '')
    if (n < 20) return `十${CN_DIGIT[n - 10]}`
    return CN_DIGIT[Math.floor(n / 10)] + '十' + (n % 10 ? CN_DIGIT[n % 10] : '')
  }

  let yearText = ''
  for (let i = 0; i < year.length; i += 1) yearText += CN_DIGIT[Number(year[i])]
  return `${yearText}年${num(month)}月${num(day)}日`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`
}

/* ---------- 基础图形助手 ---------- */
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function arcText(c, text, cx, cy, r, a0, a1, font, color, outward) {
  const n = text.length
  if (n < 1) return
  const step = (a1 - a0) / (n - 1 || 1)

  c.save()
  c.font = font
  c.fillStyle = color
  c.textAlign = 'center'
  c.textBaseline = 'middle'

  for (let i = 0; i < n; i += 1) {
    const a = a0 + step * i
    c.save()
    c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    c.rotate(a + (outward ? -Math.PI / 2 : Math.PI / 2))
    c.fillText(text[i], 0, 0)
    c.restore()
  }

  c.restore()
}

function star(c, cx, cy, r, fill) {
  c.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.42
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  }
  c.closePath()
  c.fillStyle = fill
  c.fill()
}

function snowflake(c, x, y, r, color, lw, alpha) {
  c.save()
  c.globalAlpha = alpha == null ? 1 : alpha
  c.translate(x, y)
  c.strokeStyle = color
  c.lineWidth = lw || 2
  c.lineCap = 'round'

  for (let i = 0; i < 6; i += 1) {
    c.rotate(Math.PI / 3)
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(0, -r)
    c.moveTo(0, -r * 0.58)
    c.lineTo(-r * 0.28, -r * 0.86)
    c.moveTo(0, -r * 0.58)
    c.lineTo(r * 0.28, -r * 0.86)
    c.stroke()
  }

  c.restore()
}

/* 防伪底纹（玫瑰线织纹） */
function guilloche(c) {
  c.save()
  c.strokeStyle = GREEN2
  c.lineWidth = 1
  const cx = CERT_WIDTH / 2
  const cy = CERT_HEIGHT * 0.47
  const R = 400

  for (let k = 0; k < 34; k += 1) {
    c.globalAlpha = 0.05 + (k % 3) * 0.012
    c.beginPath()
    for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.02) {
      const r = R * (0.82 + 0.18 * Math.sin(6 * t + k * 0.28))
      const x = cx + Math.cos(t) * r
      const y = cy + Math.sin(t) * r
      if (t === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
  }

  c.restore()
}

/* 中央大校徽水印 */
function badgeWatermark(c, badge) {
  if (!badge || !badge.complete || !badge.naturalWidth) return
  c.save()
  c.globalAlpha = 0.07
  const s = 620
  c.drawImage(badge, CERT_WIDTH / 2 - s / 2, CERT_HEIGHT * 0.44 - s / 2, s, s)
  c.restore()
}

function draw(c, user, opts) {
  const cls = String((user && user.cls) || '').trim()
  const name = String((user && user.name) || '').trim()
  const stars = opts.stars != null && opts.stars !== '' ? Number(opts.stars) : 60
  const total = opts.total != null && opts.total !== '' ? Number(opts.total) : 60
  const levels = opts.levels != null && opts.levels !== '' ? Number(opts.levels) : 20
  const iso = opts.date || todayIso()
  const no = (opts.no && String(opts.no).trim()) || certNumber(cls, name, iso.slice(0, 4))
  const badge = opts.badge || null
  const full = `${cls}班 ${name}`

  c.fillStyle = CREAM
  c.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT)
  guilloche(c)
  badgeWatermark(c, badge)

  // 四角雪花
  ;[
    [70, 90],
    [930, 90],
    [70, 1330],
    [930, 1330],
  ].forEach((point) => {
    snowflake(c, point[0], point[1], 26, GREEN2, 2.4, 0.5)
    snowflake(c, point[0], point[1], 13, GREEN2, 1.8, 0.35)
  })

  // 双层边框
  c.strokeStyle = GREEN
  c.lineWidth = 7
  c.strokeRect(22, 22, CERT_WIDTH - 44, CERT_HEIGHT - 44)
  c.strokeStyle = GOLD
  c.lineWidth = 1.6
  c.strokeRect(38, 38, CERT_WIDTH - 76, CERT_HEIGHT - 76)

  c.textAlign = 'center'

  // ---- 顶部：校徽 + 校名 ----
  const bx = 120
  const by = 118
  const br = 58

  if (badge && badge.complete && badge.naturalWidth) {
    c.save()
    c.beginPath()
    c.arc(bx, by, br, 0, Math.PI * 2)
    c.closePath()
    c.clip()
    c.drawImage(badge, bx - br, by - br, br * 2, br * 2)
    c.restore()
  } else {
    c.fillStyle = '#EDF7EE'
    c.beginPath()
    c.arc(bx, by, br, 0, Math.PI * 2)
    c.fill()
    snowflake(c, bx, by, 34, GREEN, 4, 0.8)
  }

  c.strokeStyle = GREEN
  c.lineWidth = 4
  c.beginPath()
  c.arc(bx, by, br + 5, 0, Math.PI * 2)
  c.stroke()
  c.strokeStyle = GOLD
  c.lineWidth = 1.4
  c.beginPath()
  c.arc(bx, by, br + 10, 0, Math.PI * 2)
  c.stroke()

  c.textAlign = 'left'
  c.fillStyle = GREEN
  c.font = '800 44px "Microsoft YaHei","PingFang SC",sans-serif'
  c.textBaseline = 'alphabetic'
  c.fillText('祁阳一中', 206, 106)
  c.fillStyle = '#5B7C63'
  c.font = '600 14px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('Q I Y A N G   N O . 1   M I D D L E   S C H O O L', 208, 136)
  c.fillStyle = GRAY
  c.font = '15px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('信息技术教研组 · 冰雪编程乐园', 208, 164)
  c.textAlign = 'center'

  // 头部装饰线
  c.strokeStyle = GREEN
  c.lineWidth = 2
  c.beginPath()
  c.moveTo(120, 208)
  c.lineTo(432, 208)
  c.stroke()
  c.beginPath()
  c.moveTo(568, 208)
  c.lineTo(880, 208)
  c.stroke()
  snowflake(c, 500, 208, 15, GREEN, 2.2, 0.9)

  // ---- 标题区 ----
  c.fillStyle = INK
  c.font = '18px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('—— 冰 雪 编 程 乐 园 · 闯 关 成 就 认 证 ——', CERT_WIDTH / 2, 262)

  c.fillStyle = GREEN
  c.font = '800 62px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('冰雪编程之星', CERT_WIDTH / 2, 336)

  c.fillStyle = '#7A8F7C'
  c.font = '20px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText(`（顺利完成全部 ${levels} 关闯关挑战）`, CERT_WIDTH / 2, 372)

  c.fillStyle = GOLD
  c.font = '600 13px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('C E R T I F I C A T E   O F   A C H I E V E M E N T', CERT_WIDTH / 2, 402)

  // 装饰分隔
  c.strokeStyle = GOLD
  c.lineWidth = 1.4
  c.beginPath()
  c.moveTo(260, 424)
  c.lineTo(470, 424)
  c.stroke()
  c.beginPath()
  c.moveTo(530, 424)
  c.lineTo(740, 424)
  c.stroke()
  star(c, 500, 424, 9, GOLD)

  // ---- 姓名区 ----
  c.fillStyle = GRAY
  c.font = '16px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('学  生  姓  名', CERT_WIDTH / 2, 468)

  c.fillStyle = RED
  c.font = '800 60px "Microsoft YaHei","PingFang SC",sans-serif'
  const spaced = name.split('').join(' ')
  c.fillText(spaced, CERT_WIDTH / 2, 536)

  // 姓名下方双线
  c.strokeStyle = 'rgba(181,53,44,0.55)'
  c.lineWidth = 2
  c.beginPath()
  c.moveTo(330, 556)
  c.lineTo(670, 556)
  c.stroke()
  c.strokeStyle = 'rgba(181,53,44,0.28)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(370, 562)
  c.lineTo(630, 562)
  c.stroke()

  c.fillStyle = INK
  c.font = '700 22px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText(`班  级：${cls} 班`, CERT_WIDTH / 2, 598)

  // ---- 发证语句 ----
  c.fillStyle = INK
  c.font = '23px "KaiTi","STKaiti","Kaiti SC","SimSun","Microsoft YaHei",serif'
  c.fillText(`兹证明 ${full} 同学，`, CERT_WIDTH / 2, 656)
  c.fillText(`已完成《和安娜、艾莎一起编程》冰雪编程乐园全部 ${levels} 关闯关挑战，`, CERT_WIDTH / 2, 694)
  c.fillText('程序设计思路清晰，循环与咒语运用得当，', CERT_WIDTH / 2, 732)
  c.fillText('特发此证，以资鼓励！', CERT_WIDTH / 2, 770)

  // ---- 数据栏 ----
  const cells = [
    ['获得星星', `${stars} / ${total} ★`],
    ['通关日期', iso],
    ['证书编号', no],
  ]
  const cw = 250
  const gap = 18
  const x0 = CERT_WIDTH / 2 - (cw * 3 + gap * 2) / 2

  cells.forEach((cell, i) => {
    const x = x0 + i * (cw + gap)
    c.strokeStyle = GREEN2
    c.lineWidth = 1.4
    roundRectPath(c, x, 812, cw, 78, 12)
    c.stroke()
    c.fillStyle = GRAY
    c.font = '14px "Microsoft YaHei","PingFang SC",sans-serif'
    c.fillText(cell[0], x + cw / 2, 838)
    c.fillStyle = GREEN
    c.font = cell[1].length > 18 ? '700 14px "Microsoft YaHei","PingFang SC",sans-serif' : '800 21px "Microsoft YaHei","PingFang SC",sans-serif'
    c.fillText(cell[1], x + cw / 2, 870)
  })

  // ---- 底部：落款 + 印章 ----
  c.textAlign = 'left'
  c.fillStyle = INK
  c.font = '22px "KaiTi","STKaiti","Kaiti SC","SimSun","Microsoft YaHei",serif'
  c.fillText('发证单位：祁阳一中信息技术教研组', 150, 1058)
  c.fillText(`发证日期：${chineseDate(iso)}`, 150, 1094)
  c.fillStyle = GRAY
  c.font = '14px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('（本证书由系统根据闯关记录自动生成）', 150, 1124)

  // 红色圆形印章
  const sx = 780
  const sy = 1062
  const sr = 62
  c.save()
  c.globalAlpha = 0.92
  c.strokeStyle = RED
  c.lineWidth = 5
  c.beginPath()
  c.arc(sx, sy, sr, 0, Math.PI * 2)
  c.stroke()
  c.lineWidth = 1.8
  c.beginPath()
  c.arc(sx, sy, sr - 8, 0, Math.PI * 2)
  c.stroke()
  arcText(c, '祁阳一中', sx, sy, sr - 22, Math.PI * 1.18, Math.PI * 1.82, '700 20px "Microsoft YaHei",sans-serif', RED, false)
  star(c, sx, sy - 6, 13, RED)
  arcText(c, '证书专用章', sx, sy, sr - 22, Math.PI * 0.18, Math.PI * 0.82, '700 20px "Microsoft YaHei",sans-serif', RED, true)
  c.restore()

  // ---- 底部细则 ----
  c.textAlign = 'center'
  c.fillStyle = GRAY
  c.font = '12px "Microsoft YaHei","PingFang SC",sans-serif'
  c.fillText('本证书为祁阳一中《冰雪编程乐园》闯关成果证明，仅限校园学习评价使用。', CERT_WIDTH / 2, 1300)
  c.fillText(`证书编号 ${no} · 可在信息技术老师处核验 · 祁阳一中信息技术教研组 制`, CERT_WIDTH / 2, 1322)
}

/**
 * 渲染证书到 canvas（浏览器端）。
 * @param {{ cls?: string|number, name?: string }} user
 * @param {{ stars?: number, total?: number, levels?: number, date?: string, no?: string,
 *           badge?: HTMLImageElement|null, canvas?: HTMLCanvasElement }} [opts]
 * @returns {HTMLCanvasElement|null}
 */
export function renderCertificate(user, opts = {}) {
  if (typeof document === 'undefined') return null

  const canvas = opts.canvas || document.createElement('canvas')
  canvas.width = CERT_WIDTH
  canvas.height = CERT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas

  draw(context, user || {}, opts)
  return canvas
}

/** 文件名：班级+姓名+冰雪编程世界通关证书.png */
export function certFilename(user) {
  const cls = String((user && user.cls) || '').trim()
  const name = String((user && user.name) || '').trim()
  let base = `${cls ? `${cls}班` : ''}${name}冰雪编程世界通关证书`
  base = base.replace(/[\\/:*?"<>|\r\n\t]/g, '').slice(0, 80) || '冰雪编程世界通关证书'
  return `${base}.png`
}

/** 触发浏览器下载并返回文件名。 */
export function downloadCertificate(canvas, user) {
  if (typeof document === 'undefined' || !canvas) return ''
  const filename = certFilename(user)
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  return filename
}
