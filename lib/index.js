import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
//#region src/index.ts
/**
* NewType host 半（P3.1 图页通道，FR-4.1）：
*  - 监听产出页目录（默认：NewType data/pages + HB skillpages 池），fs.watch + 全量重扫（目录都是平铺池）
*  - 127.0.0.1 只读 HTTP：GET /newtype/pages（JSON 列表）、/newtype/page/<id>（页面本体）
*  - FR-5.3：只绑 127.0.0.1、无写端点；路径只经 id 白名单解析，无遍历面
* 归属（哪会话的页）不在 host 做——client 按水位归当前会话（HB 教训口径），host 保持无会话耦合。
* 端口被占 → 降级为无图页功能（log warn），绝不炸宿主。
*/
const name = "@dsh-external/dsh-newtype-multititle";
/** v1 常量口径；要配置面等有第二个消费场景再说（简单优先）。 */
/** 端口候选：web 开发实例与桌面版可能并存，占用则顺延（client 端做同序探测）。 */
const PAGE_PORTS = [
	7917,
	7918,
	7919
];
const PAGE_ROOTS = ["D:/000_AI_Workspace/01_Projects/Project-DSH-NewType/data/pages", "D:/000_AI_Workspace/01_Projects/Project-HB_Tao_mix/data/skillpages"];
const MAX_PAGES = 200;
/** E31 spike：工作台内点文件 → 工作台窗格渲染。只读白名单根 + 2MB 上限。 */
const FILE_ROOT = "D:/000_AI_Workspace";
const MAX_FILE_BYTES = 2097152;
const FILE_MIME = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".html": "text/html; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".md": "text/plain; charset=utf-8",
	".yml": "text/plain; charset=utf-8",
	".yaml": "text/plain; charset=utf-8"
};
function apply(ctx) {
	ctx.logger("dsh-newtype-multititle").info("host half mounted");
	ctx.effect(() => {
		const entries = /* @__PURE__ */ new Map();
		const watchers = [];
		let dirty = true;
		const rescan = async () => {
			const next = /* @__PURE__ */ new Map();
			for (const root of PAGE_ROOTS) {
				let names = [];
				try {
					names = await readdir(root);
				} catch {
					continue;
				}
				for (const name of names) {
					if (!name.toLowerCase().endsWith(".html")) continue;
					const abs = join(root, name);
					try {
						const st = await stat(abs);
						if (!st.isFile()) continue;
						const id = createHash("sha1").update(abs).digest("hex").slice(0, 12);
						next.set(id, {
							id,
							name: name.replace(/\.html$/i, ""),
							mtime: Math.floor(st.mtimeMs),
							bytes: st.size
						});
					} catch {}
				}
			}
			entries.clear();
			for (const [k, v] of next) entries.set(k, v);
			dirty = false;
		};
		rescan();
		for (const root of PAGE_ROOTS) try {
			const w = watch(root, () => {
				dirty = true;
			});
			w.on("error", () => {});
			watchers.push(w);
		} catch {}
		const timer = setInterval(() => {
			if (dirty) rescan();
		}, 1e3);
		setInterval(() => {
			rescan();
		}, 3e3);
		const send = (res, code, body, type = "application/json; charset=utf-8") => {
			res.writeHead(code, {
				"Content-Type": type,
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "no-store"
			});
			res.end(body);
		};
		const handler = async (req, res) => {
			if (req.method === "OPTIONS") {
				res.writeHead(204, {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type",
					"Access-Control-Max-Age": "600"
				});
				res.end();
				return;
			}
			if (dirty) await rescan();
			const url = (req.url ?? "").split("?")[0];
			if (url === "/newtype/pages") {
				const list = [...entries.values()].sort((a, b) => b.mtime - a.mtime).slice(0, MAX_PAGES);
				send(res, 200, JSON.stringify(list));
				return;
			}
			const page = url.match(/^\/newtype\/page\/([0-9a-f]{12})$/);
			if (page) {
				const ent = entries.get(page[1]);
				if (!ent) {
					send(res, 404, "page not found");
					return;
				}
				for (const root of PAGE_ROOTS) try {
					const abs = join(root, ent.name + ".html");
					const st = await stat(abs);
					if (st.isFile() && Math.floor(st.mtimeMs) === ent.mtime) {
						send(res, 200, (await readFile(abs)).toString("utf8"), "text/html; charset=utf-8");
						return;
					}
				} catch {}
				send(res, 404, "page file gone");
				return;
			}
			if (url === "/newtype/file") {
				const raw = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("path") ?? "";
				if (!raw) {
					send(res, 400, "path required");
					return;
				}
				let abs = "";
				try {
					abs = join(raw);
				} catch {
					send(res, 400, "bad path");
					return;
				}
				if (!abs.replace(/\\/g, "/").toLowerCase().startsWith(FILE_ROOT.toLowerCase() + "/")) {
					send(res, 403, "outside workspace root");
					return;
				}
				const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
				const mime = FILE_MIME[ext];
				if (!mime) {
					send(res, 415, "extension not allowed");
					return;
				}
				try {
					const st = await stat(abs);
					if (!st.isFile() || st.size > MAX_FILE_BYTES) {
						send(res, st.isFile() ? 413 : 404, "not a readable file");
						return;
					}
					const buf = await readFile(abs);
					send(res, 200, buf.toString("utf8"), mime);
				} catch {
					send(res, 404, "file gone");
				}
				return;
			}
			send(res, 404, "not found");
		};
		const server = createServer((req, res) => {
			handler(req, res).catch(() => send(res, 500, "oops"));
		});
		let portIdx = 0;
		server.on("error", (e) => {
			portIdx += 1;
			if (portIdx < PAGE_PORTS.length) server.listen(PAGE_PORTS[portIdx], "127.0.0.1");
			else ctx.logger("dsh-newtype-multititle").warn(`页面服务降级（${PAGE_PORTS.join("/")} 全占用）: ${String(e)}`);
		});
		server.listen(PAGE_PORTS[0], "127.0.0.1", () => ctx.logger("dsh-newtype-multititle").info(`页面服务 http://127.0.0.1:${PAGE_PORTS[portIdx]}/newtype/pages`));
		return () => {
			clearInterval(timer);
			for (const w of watchers) w.close();
			server.close();
		};
	}, "dsh-newtype-multititle: 图页 watcher + 只读页面服务");
}
//#endregion
export { apply, name };
