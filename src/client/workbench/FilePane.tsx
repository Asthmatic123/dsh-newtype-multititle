/**
 * 文件窗格（E31 spike → E41d 文本自绘）：host 半 `/newtype/file?path=` 只读端点。
 * 触发链：对话内点文件 → E41 捕获层 → trellis 'file' 视图。
 *
 * 渲染分两种：
 *  - 文本类（md/yml/yaml/json/txt）：fetch 回来自绘 <pre>——iframe 的 text/plain
 *    查看器在深色环境下白字白底（主人真机实证：选中有字、看得见=撞色），自绘
 *    颜色跟 --dsh-* 主题变量走，彻底摆脱 UA 配色。
 *  - 图片 / html：仍走 iframe（浏览器原生渲染，无撞色问题）。
 *
 * 端口自探：按「file 路由对空 path 应答 400」判活，独立缓存（旧包 404 区分）。
 */
import { useEffect, useState } from 'react'
import { marked } from 'marked'
import s from '../newtype.module.css'

const PORTS = [7917, 7918, 7919]
let cached: string | null | undefined

async function resolveFileBase(): Promise<string | null> {
  if (cached !== undefined) return cached
  for (const port of PORTS) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 1200)
      const res = await fetch(`http://127.0.0.1:${port}/newtype/file`, { signal: ctl.signal })
      clearTimeout(t)
      // 新服务对空 path 应答 400；旧包（无路由）404 —— 以此区分
      if (res.status === 400) { cached = `http://127.0.0.1:${port}`; return cached }
    } catch { /* 端口无服务：下一个 */ }
  }
  cached = null
  return cached
}

/** 走自绘文本的扩展名（其余：图片/html 交 iframe 原生渲染） */
const TEXT_EXT = /\.(md|markdown|yml|yaml|json|txt|log|csv|tsv|xml)$/i
const IS_MD = /\.(md|markdown)$/i
/** NT1013B：pdf 交 iframe 原生查看器（host 半已放行 application/pdf） */
const IS_PDF = /\.pdf$/i
/** 内嵌预览覆盖不了的格式（office/压缩包/媒体等）：host 415，与其让 iframe
 *  显示裸报错，不如提前给出明确空态（是否做「系统打开」待主人拍板）。 */
const PREVIEWABLE_EXT = /\.(md|markdown|yml|yaml|json|txt|log|csv|tsv|xml|pdf|png|jpe?g|gif|webp|svg|html?)$/i

/**
 * E41e：md → srcDoc HTML（marked 打包内置 + mermaid CDN 懒加载）。
 * mermaid 走 jsdelivr ESM：加载失败（断网/被墙）自动保留代码原样，不影响正文。
 * 主题：读宿主根元素 color-scheme（E36 口径），dark→mermaid dark 主题。
 */
function buildMdDoc(md: string): string {
  let body = marked.parse(md, { async: false, gfm: true, breaks: true })
  const dark = (typeof document !== 'undefined'
    && getComputedStyle(document.documentElement).colorScheme !== 'light')
  // 防止正文里的 </script> 提前闭合我们的脚本标签
  body = body.replace(/<\/script/gi, '<\\/script')
  const theme = dark ? 'dark' : 'default'
  const fg = dark ? '#d8d5d0' : '#16181d'
  const bg = dark ? '#16181d' : '#ffffff'
  const codeBg = dark ? '#0f1113' : '#f3f4f6'
  const line = dark ? '#2b2e33' : '#e5e7eb'
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html{color-scheme:${dark ? 'dark' : 'light'}}
body{margin:0;padding:16px 18px;font:14px/1.75 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;color:${fg};background:${bg};word-break:break-word}
h1,h2,h3,h4{line-height:1.35;margin:1.2em 0 .5em}
h1{font-size:1.5em}h2{font-size:1.3em;border-bottom:1px solid ${line};padding-bottom:.25em}
a{color:#4d8bff}
pre{background:${codeBg};border:1px solid ${line};border-radius:8px;padding:12px;overflow:auto}
code{font-family:ui-monospace,Consolas,monospace;font-size:.92em}
:not(pre)>code{background:${codeBg};border-radius:4px;padding:.15em .4em}
table{border-collapse:collapse;margin:.8em 0}
th,td{border:1px solid ${line};padding:6px 12px;text-align:left}
img{max-width:100%}
blockquote{margin:.8em 0;padding:.1em 1em;border-left:3px solid ${line};color:inherit;opacity:.85}
.mermaid{text-align:center;margin:1em 0}
</style></head><body>${body}
<script>
document.querySelectorAll('code.language-mermaid').forEach(function (el) {
  var d = document.createElement('div'); d.className = 'mermaid'
  d.textContent = el.textContent; el.closest('pre').replaceWith(d)
})
</script>
<script type="module">
try {
  const m = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
  m.default.initialize({ startOnLoad: false, theme: '${theme}', fontFamily: 'inherit' })
  await m.default.run()
} catch (e) { /* mermaid CDN 不可达：代码块原样保留 */ }
</script></body></html>`
}

export function FilePane({ path }: { path: string }) {
  const [base, setBase] = useState<string | null>(cached ?? null)
  const [text, setText] = useState<string | null>(null)
  const [textErr, setTextErr] = useState('')
  const isText = TEXT_EXT.test(path)
  const isMd = IS_MD.test(path)
  useEffect(() => {
    let alive = true
    void resolveFileBase().then((b) => { if (alive) setBase(b) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!base || !path || !isText) { setText(null); setTextErr(''); return }
    let alive = true
    setTextErr('')
    void fetch(`${base}/newtype/file?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const body = await r.text()
        if (!alive) return
        if (!r.ok) { setTextErr(`${r.status} ${body.slice(0, 120)}`); setText(null); return }
        setText(body)
      })
      .catch((e) => { if (alive) { setText(null); setTextErr(String(e)) } })
    return () => { alive = false }
  }, [base, path, isText])
  const src = base && path ? `${base}/newtype/file?path=${encodeURIComponent(path)}` : ''
  return (
    <div className={s.webPane}>
      {path ? (
        !PREVIEWABLE_EXT.test(path) ? (
          <div className={s.pempty}>该格式暂不支持内嵌预览（{path.slice(path.lastIndexOf('.') + 1) || '?'}）</div>
        ) : base ? (
          isText ? (
            textErr ? (
              <div className={s.pempty}>读取失败：{textErr}</div>
            ) : text !== null ? (
              isMd ? (
                <iframe
                  className={s.pif}
                  srcDoc={buildMdDoc(text)}
                  title={path}
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                />
              ) : (
                <pre
                  style={{
                    flex: 1, minHeight: 0, margin: 0, overflow: 'auto', padding: '14px 16px',
                    font: '12px/1.6 ui-monospace, Consolas, monospace',
                    color: 'var(--dsh-text, #d8d5d0)', background: 'var(--trellis-stage, #16181d)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text',
                  }}
                >{text}</pre>
              )
            ) : (
              <div className={s.pempty}>读取中…</div>
            )
          ) : (
            <iframe className={s.pif} src={src} title={path} />
          )
        ) : (
          <div className={s.pempty}>文件服务未就绪（host 半未挂载）</div>
        )
      ) : (
        <div className={s.pempty}>缺少文件路径</div>
      )}
    </div>
  )
}
