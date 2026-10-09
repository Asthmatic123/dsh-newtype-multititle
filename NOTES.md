# NewType 插件（dsh-newtype）骨架笔记

> 状态：**1.1c web 端实测通过**（3080 左栏真变 tab 栏 + 点击切会话，0 错误）。

## 已定事实（ogrid + 5011dd34 API 卡 + 实测校准）

- **插件清单 = package.json 的 `dsh` 字段**（bundle.patch + client.platform/inject；`dsh.plugin.json` 无任何读取方，已废弃）。
- 注册写法：`ctx.effect(() => ctx.slots.inject('<slot>', () => ctx.slots.register(entry, Comp)))`（client/index.tsx，卸载自动回收）；SlotMap 用 `declare module '@deepseek-ai/dsh-client-ui-slots'` 补声明。
- tsdown 双配置模板 = ogrid tsdown.config.ts：node 半 ESM + browser 半 CJS（`window.__ModuleLoader__.load({id,factory})` banner/footer 包装）；PLATFORM_MODULES external；purity gate 拦跨包 value import；CSS modules → lightningcss 内联 + 内容指纹 tagId。
- 双半纪律：改 host 半重启 DSH；改 client 刷新页面。

## 目录现状

```
plugin/dsh-newtype/
├─ package.json          ✅（scripts: build/typecheck/test；dsh-plugin 字段待 API 卡补）
├─ tsconfig.json         ✅
├─ tsdown.config.ts      ⬜ 照 ogrid 逻辑自写（1.1b）
├─ src/
│  ├─ index.ts           ⬜ host 半空壳（P3 前不碰）
│  └─ client/
│     ├─ index.tsx       ⬜ 注册 sidebar.workspaces（等 API 卡）
│     ├─ layout/state.ts ✅ 二叉 split 树状态机（纯逻辑，node:test 10/10）
│     ├─ layout/Workspace.tsx ✅ 渲染器（flex 排版/divider 改 grow/边缘 zone 检测）
│     ├─ tabs/           ⬜ Pane/TabBar 组件（Ely 口径 CSS）
│     └─ newtype.module.css ⬜
└─ test/state.test.mjs   ✅
```

## vendor 面（D7=(b')，P2.1 才拉）

`src/client/vendor/renderer/` 4 文件 + `core-pin.json`（tag+sha）+ blob 级 diff 门禁。0.1.7 装不进 0.2.0 桌面壳（#7/#8 根因），vendor 基线直接锁 0.2.0-rc.2 宿主。

## 接线完成（2026-10-07，5011dd34 API 卡校准）

- `client/index.tsx`：`inject ['slots','uiWorkspace']`；`sidebar.workspaces` single/root 注册，**priority:-10**（⚠️ 修正：宿主语义 = lowest priority renders，先写 +10 实测无效）；register options 带 `inject:()=>({openSession})` 把 `ctx.uiWorkspace.openSession` 注进 props。
- `NewTypePanel.tsx`：真数据 = GlobalStandardProps `useSessions(ids/byId/retainedBy/running/updatedAt)`；激活判定 = `retainedBy` 含 `mainView`（root scope 无 sessionId）；全 props 可选链（速查卡风险 7：0.2.0 字段漂移只表现为 undefined）。
- `host.d.ts`：Context.slots/uiWorkspace/effect 最小声明面（真类型在未安装的 ui-renderer 包）——**升级宿主时第一个复验这里**。
- 门禁三绿：`tsc --noEmit` exit 0 / `tsdown` 出 loader 包装 client.js 6.39kB / `npm test` 10/10。
- tsconfig：`allowImportingTsExtensions:true`（.tsx 显式后缀是 loader 生态惯例）。

## 1.1c web 端实测 ✅（2026-10-07，3080 全链打通）

- 左栏真变 NewType tab 栏：329 条真会话、SVG 图标、当前会话高亮；点击 → `uiWorkspace.openSession` 真切换（实拍 `Docs/demos/shots/11c-*.png`，0 console 错误）。
- **根因坑 ①（静默不挂载）**：bundle 的 cordis.patch.yml 必须**自我 insert**（`- insert: - id: dsh-newtype / name: '@dsh-external/dsh-newtype'`）。写成"改已存在行"格式时该行不存在 → **无警告无日志无挂载**（huabu patch 实证格式）。
- **根因坑 ②（priority 方向）**：**lowest priority renders**（ui-slots lib/index.js:167-190），顶掉占 0 的 WorkspaceBrowser 要负数；-10 实测生效（升级复验点）。
- peer 对齐运行时：`dsh-client-ui-slots@0.1.7-rc.2` + `cordis@^4.0.4`（钉老 rc → skip + 要 compatibility.json exact 豁免）。
- 验证手法：host 半写 marker 判挂载；boot entries 判 client 图；`style[data-plugin]` 判 CSS 注入。

## 工作台实装（2026-10-08，(c) 路线全通，详见 Docs/05 §E15/E16）

- **conversation.view 注册姿势**：`{name:'conversation.view', id:'newtype-workbench', order:100, label:'工作台', inject}` + 组件；kind=list/**scope=session** → 组件自带 sessionId（inject 里别再塞 sessionId，会盖掉）；**没开会话时切换器入口不出现**。
- **(c) 数据面**：`ctx.sessions.retain(id,{source:'dsh-newtype'})` → `await ref.ready` → `binding.eventSource`（getSnapshot+subscribe，useSyncExternalStore 直连）；卸载 `ref.release()`。整窗派生渲染无增量状态；transient live-chunk 按 attemptId 折 text-delta 成流式尾巴。source 必须插件自有，勿用宿主 mainView 源（#8③）。
- **跨树拖拽**：sidebar 与工作台是两棵 React 树 → `drag.ts` 模块单例 + 订阅（HTML5 dataTransfer 在 dragover 读不到数据）；React 状态异步，headless 合成拖拽 dragstart 后要等一拍再发 dragover/drop。
- **高度链**：工作台根 `.wb` 必须 `flex:1 1 0; min-height:0`（只写 height:100% 会被内容撑爆，落点 zone 判别跟着坏）。
- **冒烟基建**：关键节点带 `data-nt` 属性（CSS modules 哈希类没法探测）；`scripts/smoke-plugin.cjs` = 全链门禁；**playwright 每次启动=全新 context，localStorage 不跨启动，测持久化必须同 context reload**。
- **桌面安装**（等主人开桌面版验收）：package.json link + bundles 追加 + compatibility.json `"@dsh-external/dsh-newtype@0.0.1":["0.2.0-rc.2"]`（anysearch 同款豁免）+ node_modules junction。⚠️ desktop 全量 `pnpm install` 会被存量 `dsh-our-free-model`（npmmirror 404）卡死——lock 落后 package.json，下次装包前先解决它。
- asar sanity（0.2.0-rc.2）：conversation.view×22 / sidebar.workspaces×73 / renderFactorySlot×14 / eventSource×109，我们消费的面全在。

## 图页通道（2026-10-08，P3.1 全通，详见 Docs/05 §E17）

- host 半：7917 只读面（列表 + 按 id 取页），双根 watcher（NewType data/pages + HB skillpages 池），3s 无条件重扫自愈（目录迟到/事件丢失都能自愈），端口占用降级不炸宿主。
- client 半：pages.ts 轮询+水位归属（**首次同步只记水位**，防旧池全灌给当前会话）、无聚焦归收件箱 ''、openTabBus 打开总线、PagePane iframe。
- 坑：① 同数据两处渲染口（title 属性 + 内层 span）只改了一处 → 'page:b27' 悬案 1.5h，改 UI 先 grep 全部消费点；② `.nt-child` 必须 `flex-basis:0`，否则分栏比例被内容宽带偏。
- 邻居插件 dsh-workbuddy-connect 偶发 conversation.input.right 崩（null.provider），非本项目；门禁已改分拣制（只卡 dsh-newtype 自家报错）。

## 右栏面板 + 徽标（2026-10-08，P3.3 + AC-3 可见面，详见 05 §E18）

- 右栏两段式：`ctx.sidebarRightTabs.register`（类型，id 唯一/kind 开页用）+ keyed `sidebar.right.pane.tab`（key=类型定义 **id** 不是 kind）；程序化开 `ctx.sidebarRight.openTab(kind)`。
- 徽标：fresh 是模块 Set，**必须把版本号塞进 snap**（fv）否则 useMemo 不重算——跨快照可变状态的通用坑。
- P4.2/P4.3 设计提案在 02（hook 载体=ZCode 先行、交卡=单工具 newtype_emit_page 幂等键=文件名），编码等拍板。

## 侧栏 tab 化（2026-10-08，D11：trellis IDE 布局对齐）

- NewTypePanel 顶部 stabs：会话 N / 图页（fresh 徽标挂 tab 上）/ 画布占位；active tab 存 localStorage（dsh-newtype.sidebartab.nt-v1）。
- 切进图页 tab = 过目清徽标（switchTab 里 markSeen）；行点击另单清。
- 对齐边界：标题栏/状态栏/命令中心是宿主的（无槽可注册），插件只占侧栏/会话区/右栏。

## trellis 全包裹（P1.7 batch 1，2026-10-08，D12）

- 接管 `sidebar`（priority:-10，宿主 ui-sidebar 同位）：TrellisSidebar = 品牌/新会话(startSession)/工作台·对话(selectPanel('newtype'|null))/NewTypePanel(tab 面板)/panellist 导航(entriesOfSlot 动态枚举)/紧凑栏(collapsed)。
- 工作台升格 `main` key 'newtype'：`selectPanel('newtype')` 显示，无宿主头部包覆；conversation.view 旧入口过渡期保留。
- 导航零损失 = `sidebar.panellist` 槽枚举 + `selectPanel(id)`；web profile 没装 plugin-manager/schedule → nav 空是环境事实。
- batch 2 ⬜：rightbar 整条接管（产出物面板升格，消解「main=newtype 态右栏不开」）、shell.overlay 状态栏。
- 坑：嵌套结构别用 `div:last-of-type`（会咬到别的 div），用 data-attr 选择器。

## batch 2（2026-10-08）：右侧产出物栏 + 状态栏

- 右侧栏做在**工作台 main 面板内**（不碰 rightbar 槽——显隐开关在宿主会话头部，语义浑浊）；artStore（bus.ts）开合，ArtifactsPanel mode=global（新到+收件箱）。
- 状态栏走 `shell.overlay`（list 槽，{name,id,order} 注册）；**用 panelInfo 订阅做条件渲染，只在工作台态出现**；浮层点击穿透，root 设 pointer-events:auto。
- sidebar openart 请求 = selectPanel('newtype') + artRail.set(true)（切面板+开栏一步到位）。

## D13 回退侧栏接管（2026-10-08）

- 删 TrellisSidebar，`sidebar` 槽交还宿主 → 设定按钮/插件/自动化任务/原版字体位置 icon 自动全回来。
- NewTypePanel 简化：迷你 tab 标签（会话 N/图页 +N/画布）+ 右侧「工作台」小按钮（selectPanel('newtype') 正门）。无品牌/无五角星/无收起/无大 tab 条/无气泡 icon/无说明文字。
- 状态栏去 NEWTYPE 品牌 → 「DSH · 工作台」。
- 主面板正门 vs conversation.view 入口：前者 activePanelId='newtype'（状态栏显示），后者会话内视图（状态栏不显示）——两入口语义不同。

## 端口顺延（2026-10-08 晚）

- **双实例并存坑**：web 开发实例（3080）与桌面版同时跑，7917 被先到者占走 → 后到者页面服务降级（10-08 主人重启桌面版时实锤：7917 被 3080 占着，桌面图页降级）。
- 修法：host 半 `PAGE_PORTS=[7917,7918,7919]` 顺延绑定；client 半 `resolveBase()` 同序探测（800ms 超时），`pagesBase()` 给 iframe 用。实测：3080 占 7917 时新实例落 7918 ✓。
- 门禁报错分拣**不能宽匹配 `@dsh-external`**：批量 URL 里含邻居包名（dsh-visualize 同 @dsh-external scope），只认 `dsh-newtype`。

## 待办

- [ ] 主人下次重启桌面版 → 图页通道自动生效（host 半变了，client 上次重启已带）；顺带复验工作台
- [ ] 卸载还原验证（FR-5.2）：删 bundles 行 + 依赖 + junction → 冷启动应原样
- [ ] P3.2 卡片标题 tab（等 P4.3 交卡）、P3.3 右栏产出物面板
- [ ] P5 huabu 形态专题（讨论线）
