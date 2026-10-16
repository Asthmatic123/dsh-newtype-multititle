/**
 * NewType host 半（P3.1 图页通道，FR-4.1）：
 *  - 监听产出页目录（默认：NewType data/pages + HB skillpages 池），fs.watch + 全量重扫（目录都是平铺池）
 *  - 127.0.0.1 只读 HTTP：GET /newtype/pages（JSON 列表）、/newtype/page/<id>（页面本体）
 *  - FR-5.3：只绑 127.0.0.1、无写端点；路径只经 id 白名单解析，无遍历面
 * 归属（哪会话的页）不在 host 做——client 按水位归当前会话（HB 教训口径），host 保持无会话耦合。
 * 端口被占 → 降级为无图页功能（log warn），绝不炸宿主。
 */
import { createHash } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

export const name = '@dsh-external/dsh-newtype-multititle'

/**
 * 白名单根跟随 DSH 自己的 workspace 模型——零配置、全平台通用：
 *  - 点文件窗格：白名单 = workspace registry 的全部路径（会话按 canonical cwd
 *    挂到 workspace，对话里正常打开的文件必然落在某个 workspace 根之下）；
 *  - 图页池：每个 workspace 贡献 <workspace>/data/pages 与
 *    <workspace>/data/skillpages（原两处硬编码根正是这个口径）。
 * registry 惰性读 + 全程防御（与 client 半可选服务同款套路）：特殊组合缺它
 * 也只是降级为空列表，绝不卡 host 半的挂载。3s 全量重扫自愈启动后才建的
 * workspace——与「池目录迟到」沿用同一套自愈机制。
 * 可选环境变量兜底（特殊场景才需要）：
 *  - DSH_NEWTYPE_PAGE_ROOTS：';' 分隔的图页目录列表；整体替换默认池
 *    （用 ';' 是因为 Windows 盘符含 ':'）
 *  - DSH_NEWTYPE_FILE_ROOT：额外只读根，在 workspace 根之外追加
 */
/** 端口候选：web 开发实例与桌面版可能并存，占用则顺延（client 端做同序探测）。 */
const PAGE_PORTS = [7917, 7918, 7919]
const MAX_PAGES = 200
/** E31 spike：工作台内点文件 → 工作台窗格渲染。只读白名单根 + 2MB 上限。 */
const MAX_FILE_BYTES = 2 * 1024 * 1024
const FILE_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8', '.yaml': 'text/plain; charset=utf-8',
  // NT1013B（bug&spec 10-13）：md 之外附件打不开——pdf 走 iframe 原生查看器，
  // 其余文本扩展 FilePane fetch 回来自绘（mime 仅声明用，fetch 不挑）。
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8', '.tsv': 'text/plain; charset=utf-8',
  '.markdown': 'text/plain; charset=utf-8', '.xml': 'text/plain; charset=utf-8',
}

interface PageEntry {
  id: string
  name: string
  mtime: number
  bytes: number
}

/** workspace registry 的 canonical 路径；防御式读取：服务缺席 => 空列表。 */
function workspacePaths(ctx: Context): readonly string[] {
  try {
    // registry 用 reflect.get 读：不占 inject 依赖，服务迟到/缺席都只是空列表；
    // 旧版 cordis 回落裸属性读。
    const reflect = (ctx as Context & { reflect?: { get?: (name: string) => unknown } }).reflect
    const reg = reflect?.get?.('workspaceRegistry')
      ?? (ctx as Context & { workspaceRegistry?: unknown }).workspaceRegistry
    const items = (reg as { list?: () => readonly unknown[] } | undefined)?.list?.() ?? []
    const out: string[] = []
    for (const w of items) {
      const p = (w as { path?: unknown }).path
      if (typeof p === 'string' && p !== '') out.push(p)
    }
    return out
  } catch { return [] }
}

/** 图页池根：每 workspace 的 data/pages + data/skillpages；环境变量则整体替换。 */
function pageRoots(ctx: Context): readonly string[] {
  const raw = process.env.DSH_NEWTYPE_PAGE_ROOTS
  if (raw !== undefined) return raw.split(';').map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const ws of workspacePaths(ctx)) out.push(join(ws, 'data/pages'), join(ws, 'data/skillpages'))
  return out
}

/** 点文件白名单根：全部 workspace 路径 + 可选环境变量根。 */
function fileRoots(ctx: Context): readonly string[] {
  const roots = [...workspacePaths(ctx)]
  const extra = process.env.DSH_NEWTYPE_FILE_ROOT
  if (extra !== undefined && extra.trim() !== '') roots.push(extra.replace(/[\\/]+$/, ''))
  return roots
}

/** 大小写不敏感的「abs 在某个根之下」判定（反斜杠归一，兼容 Windows）。 */
function insideRoots(abs: string, roots: readonly string[]): boolean {
  const norm = abs.replace(/\\/g, '/').toLowerCase()
  return roots.some((r) => norm.startsWith(r.replace(/\\/g, '/').replace(/[\\/]+$/, '').toLowerCase() + '/'))
}

export function apply(ctx: Context): void {
  ctx.logger('dsh-newtype-multititle').info('host half mounted')

  ctx.effect(() => {
    const entries = new Map<string, PageEntry>()
    const watchers = new Map<string, FSWatcher>()
    let dirty = true

    // watcher 跟随活的根集合：新根（新建 workspace / 环境变量池）下轮重扫补挂；
    // 消失的根就地关闭，不留孤儿 watcher。
    const syncWatchers = (roots: readonly string[]): void => {
      for (const root of roots) {
        if (watchers.has(root)) continue
        try {
          const w = watch(root, () => { dirty = true })
          w.on('error', () => { /* 目录消失：该源停摆，不影响其他源 */ })
          watchers.set(root, w)
        } catch { /* 同上 */ }
      }
      for (const [root, w] of watchers) {
        if (!roots.includes(root)) {
          watchers.delete(root)
          try { w.close() } catch { /* 已消亡，忽略 */ }
        }
      }
    }

    const rescan = async (): Promise<void> => {
      const next = new Map<string, PageEntry>()
      const roots = pageRoots(ctx)
      for (const root of roots) {
        let names: string[] = []
        try { names = await readdir(root) } catch { continue } // 目录不存在 = 该源静默缺席（迟到的目录下轮自愈）
        for (const name of names) {
          if (!name.toLowerCase().endsWith('.html')) continue
          const abs = join(root, name)
          try {
            const st = await stat(abs)
            if (!st.isFile()) continue
            const id = createHash('sha1').update(abs).digest('hex').slice(0, 12)
            next.set(id, { id, name: name.replace(/\.html$/i, ''), mtime: Math.floor(st.mtimeMs), bytes: st.size })
          } catch { /* 竞态删除：跳过 */ }
        }
      }
      entries.clear()
      for (const [k, v] of next) entries.set(k, v)
      syncWatchers(roots)
      dirty = false
    }
    void rescan()

    // 无条件重扫兜底（fs.watch 在 Windows 偶发丢事件；目录迟到建不出来 watch 也得能自愈）
    const timer = setInterval(() => { if (dirty) void rescan() }, 1000)
    const fullRescan = setInterval(() => { void rescan() }, 3000)

    const send = (res: ServerResponse, code: number, body: string, type = 'application/json; charset=utf-8'): void => {
      res.writeHead(code, {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      })
      res.end(body)
    }

    const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      // CORS preflight：client（宿主页面源）跨源 POST 探针数据，浏览器先发 OPTIONS
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        })
        res.end()
        return
      }
      if (dirty) await rescan()
      const url = (req.url ?? '').split('?')[0]
      if (url === '/newtype/pages') {
        const list = [...entries.values()].sort((a, b) => b.mtime - a.mtime).slice(0, MAX_PAGES)
        send(res, 200, JSON.stringify(list))
        return
      }
      const page = url.match(/^\/newtype\/page\/([0-9a-f]{12})$/)
      if (page) {
        const ent = entries.get(page[1])
        if (!ent) { send(res, 404, 'page not found'); return }
        for (const root of pageRoots(ctx)) {
          try {
            const abs = join(root, ent.name + '.html')
            const st = await stat(abs)
            if (st.isFile() && Math.floor(st.mtimeMs) === ent.mtime) {
              send(res, 200, (await readFile(abs)).toString('utf8'), 'text/html; charset=utf-8')
              return
            }
          } catch { /* 试下一个根 */ }
        }
        send(res, 404, 'page file gone')
        return
      }
      // E31 spike：只读文件端点（?path= 绝对路径）。白名单根 + 遍历归一校验 + 扩展名白名单 + 大小上限。
      if (url === '/newtype/file') {
        const qs = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
        const raw = qs.get('path') ?? ''
        if (!raw) { send(res, 400, 'path required'); return } // FilePane 探活判据（E31）
        let abs = ''
        try { abs = join(raw) } catch { send(res, 400, 'bad path'); return }
        // 白名单 = 活的 workspace 根（+ 可选环境变量根）；大小写不敏感前缀判定。
        if (!insideRoots(abs, fileRoots(ctx))) { send(res, 403, 'outside workspace root'); return }
        const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase()
        const mime = FILE_MIME[ext]
        if (!mime) { send(res, 415, 'extension not allowed'); return }
        try {
          const st = await stat(abs)
          if (!st.isFile() || st.size > MAX_FILE_BYTES) { send(res, st.isFile() ? 413 : 404, 'not a readable file'); return }
          const buf = await readFile(abs)
          send(res, 200, buf.toString('utf8'), mime)
        } catch { send(res, 404, 'file gone') }
        return
      }
      send(res, 404, 'not found')
    }

    const server = createServer((req, res) => { void handler(req, res).catch(() => send(res as ServerResponse, 500, 'oops')) })
    // 端口顺延：web 实例与桌面版并存时后启动的自动换口，客户端按同序探测发现
    let portIdx = 0
    server.on('error', (e) => {
      portIdx += 1
      if (portIdx < PAGE_PORTS.length) {
        server.listen(PAGE_PORTS[portIdx], '127.0.0.1')
      } else {
        ctx.logger('dsh-newtype-multititle').warn(`页面服务降级（${PAGE_PORTS.join('/')} 全占用）: ${String(e)}`)
      }
    })
    server.listen(PAGE_PORTS[0], '127.0.0.1', () => ctx.logger('dsh-newtype-multititle').info(`页面服务 http://127.0.0.1:${PAGE_PORTS[portIdx]}/newtype/pages`))

    return () => {
      clearInterval(timer)
      clearInterval(fullRescan)
      for (const w of watchers.values()) w.close()
      server.close()
    }
  }, 'dsh-newtype-multititle: 图页 watcher + 只读页面服务')
}
