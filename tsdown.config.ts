/**
 * tsdown 双配置（沿 dsh-canvas-ogrid 已验证逻辑，自写）：
 *  ① node 半：src/index.ts → lib/index.js（ESM）
 *  ② browser 半：src/client/index.tsx → lib/client.js（CJS，__ModuleLoader__ 包装）
 * 平台模块 external；跨包 value import 构建报错（purity gate）；
 * CSS modules 经 lightningcss 编译内联，<style> 用内容指纹 tagId、只清同 tagId。
 */
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PLUGIN_ID = '@dsh-external/dsh-newtype-multititle'

/** 宿主 web shell 冻结模块表里的平台模块（external，运行时由 loader 提供）。 */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-schema-form',
] as const

const CLIENT_EXTERNALS: readonly string[] = [...PLATFORM_MODULES, '@deepseek-ai/dsh-client-runtime/client']

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    deps: { neverBundle: ['schemastery', 'cordis'] },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      alwaysBundle: (id: string) => !CLIENT_EXTERNALS.includes(id),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    plugins: [{
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (CLIENT_EXTERNALS.includes(source)) return null
        throw new Error(
          `client bundle purity: "${source}" is not a platform module — `
          + '跨插件 value import 禁止；协作走 cordis 服务',
        )
      },
    }, {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.css')) return null
        let abs: string
        if (source.startsWith('.') || source.startsWith('/')) {
          abs = importer !== undefined ? resolve(dirname(importer), source) : source
        } else {
          abs = resolve(process.cwd(), 'node_modules', source)
        }
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        // tagId=内容指纹（非文件名）：热更新旧 style 不残留；只清同 tagId：多 CSS 模块互不覆盖
        const tagId = `${PLUGIN_ID}/${createHash('sha1').update(source).digest('hex').slice(0, 8)}`
        const inject = (css: string) => [
          `const css = ${JSON.stringify(css)};`,
          `const pluginId = ${JSON.stringify(PLUGIN_ID)};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          `document.querySelectorAll('style[data-plugin=' + JSON.stringify(pluginId) + '][data-plugin-css=' + JSON.stringify(tagId) + ']').forEach((t) => t.remove());`,
          `const tag = document.createElement('style');`,
          `tag.dataset.plugin = pluginId;`,
          `tag.dataset.pluginCss = tagId;`,
          `tag.textContent = css;`,
          `document.head.appendChild(tag);`,
        ].join('\n')
        if (!fileId.endsWith('.module.css')) {
          return `${inject(source.toString())}\nexport default {};`
        }
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
        return [inject(code.toString()), `export default ${JSON.stringify(classMap)};`].join('\n')
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: `return module.exports; } });`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
