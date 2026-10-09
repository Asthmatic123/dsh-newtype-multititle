window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-newtype-multititle",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region node_modules/@danfessler/trellis/dist/index.js
		var UNIT = {
			x: 0,
			y: 0,
			w: 1,
			h: 1
		};
		function edgeAxis(edge) {
			return edge === "left" || edge === "right" ? "x" : "y";
		}
		function edgeBefore(edge) {
			return edge === "left" || edge === "top";
		}
		function layoutRects(node, metrics) {
			const out = /* @__PURE__ */ new Map();
			if (!metrics) layoutByWeights(node, UNIT, null, out);
			else layoutWithMinimums(node, UNIT, {
				w: metrics.width,
				h: metrics.height
			}, 1, null, metrics, out);
			return out;
		}
		function layoutByWeights(node, rect, parent, out) {
			if (!node) return;
			out.set(node.id, {
				node,
				rect,
				parent
			});
			if (node.kind === "stage") {
				if (node.child) layoutByWeights(node.child, rect, node.id, out);
			} else if (node.kind === "split") {
				const total = sum(node.weights);
				let offset = 0;
				node.children.forEach((child, i) => {
					const share = node.weights[i] / total;
					layoutByWeights(child, slice(rect, node.axis, offset, share), node.id, out);
					offset += share;
				});
			}
		}
		function layoutWithMinimums(node, rect, size, scale, parent, metrics, out) {
			if (!node) return;
			if (node.kind === "stage") {
				out.set(node.id, {
					node,
					rect,
					parent,
					scale
				});
				if (node.child) layoutWithMinimums(node.child, rect, size, scale, node.id, metrics, out);
				return;
			}
			if (node.kind !== "split") {
				out.set(node.id, {
					node,
					rect,
					parent,
					scale
				});
				return;
			}
			const along = node.axis === "x" ? "w" : "h";
			const across = node.axis === "x" ? "h" : "w";
			const crossAxis = node.axis === "x" ? "y" : "x";
			const mins = node.children.map((c) => metrics.min(c, node.axis));
			const needAlong = sum(mins);
			const needAcross = Math.max(0, ...node.children.map((c) => metrics.min(c, crossAxis)));
			const s = Math.min(1, needAlong > 0 ? size[along] / needAlong : 1, needAcross > 0 ? size[across] / needAcross : 1);
			const natural = {
				w: size.w / s,
				h: size.h / s
			};
			const extents = distribute(natural[along], node.weights, mins);
			const fractions = extents.map((e) => e / natural[along]);
			out.set(node.id, {
				node: {
					...node,
					weights: fractions
				},
				rect,
				parent,
				scale
			});
			let offset = 0;
			node.children.forEach((child, i) => {
				const childSize = along === "w" ? {
					w: extents[i],
					h: natural.h
				} : {
					w: natural.w,
					h: extents[i]
				};
				layoutWithMinimums(child, slice(rect, node.axis, offset, fractions[i]), childSize, scale * s, node.id, metrics, out);
				offset += fractions[i];
			});
		}
		function distribute(total, weights, mins) {
			const fixed = /* @__PURE__ */ new Set();
			let extents = weights.map(() => 0);
			for (;;) {
				const free = weights.map((_, i) => i).filter((i) => !fixed.has(i));
				const left = total - sum([...fixed].map((i) => mins[i]));
				const weight = sum(free.map((i) => weights[i]));
				extents = weights.map((w, i) => fixed.has(i) ? mins[i] : weight > 0 ? left * w / weight : left / free.length);
				const under = free.filter((i) => extents[i] < mins[i] - 1e-9);
				if (!under.length) return extents;
				under.forEach((i) => fixed.add(i));
			}
		}
		function slice(rect, axis, offset, share) {
			return axis === "x" ? {
				...rect,
				x: rect.x + offset * rect.w,
				w: rect.w * share
			} : {
				...rect,
				y: rect.y + offset * rect.h,
				h: rect.h * share
			};
		}
		function sum(values) {
			return values.reduce((a, b) => a + b, 0);
		}
		function findNode(node, id) {
			if (!node) return null;
			if (node.id === id) return node;
			if (node.kind === "stage") return findNode(node.child, id);
			if (node.kind === "split") for (const child of node.children) {
				const found = findNode(child, id);
				if (found) return found;
			}
			return null;
		}
		function panelsOf(node) {
			if (!node) return [];
			if (node.kind === "panel") return [node];
			if (node.kind === "stage") return panelsOf(node.child);
			return node.children.flatMap(panelsOf);
		}
		function findStage(node) {
			if (!node) return null;
			if (node.kind === "stage") return node;
			if (node.kind === "split") for (const child of node.children) {
				const stage = findStage(child);
				if (stage) return stage;
			}
			return null;
		}
		function normalize$1(node) {
			if (node.kind === "panel") return node.views.length ? node : null;
			if (node.kind === "stage") {
				const child = node.child ? normalize$1(node.child) : null;
				if ((child ?? void 0) === node.child) return node;
				return {
					...node,
					child: child ?? void 0
				};
			}
			const children = [];
			const weights = [];
			node.children.forEach((child, i) => {
				const next = normalize$1(child);
				const raw = node.weights[i];
				const weight = Number.isFinite(raw) && raw > 0 ? raw : .001;
				if (!next) return;
				if (next.kind === "split" && next.axis === node.axis) {
					const total2 = sum(next.weights);
					next.children.forEach((grandchild, j) => {
						children.push(grandchild);
						weights.push(weight * next.weights[j] / total2);
					});
				} else {
					children.push(next);
					weights.push(weight);
				}
			});
			if (!children.length) return null;
			if (children.length === 1) return children[0];
			const total = sum(weights);
			const normalized = weights.map((w) => w / total);
			if (children.length === node.children.length && children.every((child, i) => child === node.children[i] && Math.abs(normalized[i] - node.weights[i]) < 1e-12)) return node;
			return {
				...node,
				children,
				weights: normalized
			};
		}
		function removeNode(root, id) {
			if (!root) return null;
			if (root.id === id) return root.kind === "stage" ? root : null;
			if (root.kind === "panel") return root;
			if (root.kind === "stage") {
				if (!root.child) return root;
				if (root.child.id === id) return {
					...root,
					child: void 0
				};
				const child = removeNode(root.child, id);
				return child === root.child ? root : {
					...root,
					child: child ?? void 0
				};
			}
			const index = root.children.findIndex((child) => child.id === id);
			if (index >= 0) {
				if (root.children[index].kind === "stage") return root;
				const children2 = [...root.children];
				const weights2 = [...root.weights];
				const removed = weights2[index];
				children2.splice(index, 1);
				weights2.splice(index, 1);
				if (!children2.length) return null;
				weights2[Math.min(index, weights2.length - 1)] += removed;
				return normalize$1({
					...root,
					children: children2,
					weights: weights2
				});
			}
			let changed = false;
			const children = [];
			const weights = [];
			root.children.forEach((child, i) => {
				const next = removeNode(child, id);
				if (next !== child) changed = true;
				if (next) {
					children.push(next);
					weights.push(root.weights[i]);
				} else if (weights.length) weights[weights.length - 1] += root.weights[i];
			});
			if (!changed) return root;
			if (!children.length) return null;
			return normalize$1({
				...root,
				children,
				weights
			});
		}
		function insertBeside(root, targetId, incoming, edge, splitId, share = .5) {
			if (!root) return incoming;
			share = Math.min(.9, Math.max(.1, share));
			const wrap = (target) => {
				const before = edgeBefore(edge);
				return normalize$1({
					kind: "split",
					id: splitId,
					axis: edgeAxis(edge),
					weights: before ? [share, 1 - share] : [1 - share, share],
					children: before ? [incoming, target] : [target, incoming]
				});
			};
			if (root.id === targetId) return wrap(root);
			if (root.kind === "panel") return root;
			if (root.kind === "stage") {
				if (!root.child) return root;
				const child = insertBeside(root.child, targetId, incoming, edge, splitId, share);
				return child === root.child ? root : {
					...root,
					child
				};
			}
			let changed = false;
			const children = root.children.map((child) => {
				const next = insertBeside(child, targetId, incoming, edge, splitId, share);
				if (next !== child) changed = true;
				return next;
			});
			return changed ? normalize$1({
				...root,
				children
			}) : root;
		}
		function replaceNode(root, id, replacement) {
			if (!root) return root;
			if (root.id === id) return replacement;
			if (root.kind === "panel") return root;
			if (root.kind === "stage") {
				if (!root.child) return root;
				const child = replaceNode(root.child, id, replacement);
				return child === root.child ? root : {
					...root,
					child
				};
			}
			let changed = false;
			const children = root.children.map((child) => {
				const next = replaceNode(child, id, replacement);
				if (next !== child) changed = true;
				return next;
			});
			return changed ? {
				...root,
				children
			} : root;
		}
		var counter = 0;
		function uid(prefix) {
			counter = (counter + 1) % 1e6;
			return `${prefix}-${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
		}
		function emptyDocument() {
			return {
				schema: 1,
				root: null,
				floating: [],
				hidden: [],
				views: {}
			};
		}
		function allPanels(doc) {
			return [
				...panelsOf(doc.root),
				...doc.floating.map((f) => f.panel),
				...doc.hidden.map((h2) => h2.panel)
			];
		}
		function locatePanel(doc, panelId) {
			const docked = findNode(doc.root, panelId);
			if (docked?.kind === "panel") return {
				where: "docked",
				panel: docked
			};
			const float = doc.floating.find((f) => f.panel.id === panelId);
			if (float) return {
				where: "floating",
				panel: float.panel,
				float
			};
			const hidden = doc.hidden.find((h2) => h2.panel.id === panelId);
			if (hidden) return {
				where: "hidden",
				panel: hidden.panel,
				restore: hidden.restore
			};
			return null;
		}
		function panelOfView(doc, viewId) {
			return allPanels(doc).find((p) => p.views.includes(viewId)) ?? null;
		}
		function updatePanel(doc, panel) {
			if (!panel.views.length) return removePanel(doc, panel.id);
			if (!panel.views.includes(panel.selected)) panel = {
				...panel,
				selected: panel.views[0]
			};
			const location = locatePanel(doc, panel.id);
			if (!location) return doc;
			if (location.where === "docked") return {
				...doc,
				root: replaceNode(doc.root, panel.id, panel)
			};
			if (location.where === "floating") return {
				...doc,
				floating: doc.floating.map((f) => f.panel.id === panel.id ? {
					...f,
					panel
				} : f)
			};
			return {
				...doc,
				hidden: doc.hidden.map((h2) => h2.panel.id === panel.id ? {
					...h2,
					panel
				} : h2)
			};
		}
		function removePanel(doc, panelId) {
			const location = locatePanel(doc, panelId);
			if (!location) return doc;
			if (location.where === "docked") return {
				...doc,
				root: removeNode(doc.root, panelId)
			};
			if (location.where === "floating") return {
				...doc,
				floating: doc.floating.filter((f) => f.panel.id !== panelId)
			};
			return {
				...doc,
				hidden: doc.hidden.filter((h2) => h2.panel.id !== panelId)
			};
		}
		function detachView(doc, viewId) {
			const panel = panelOfView(doc, viewId);
			if (!panel) return doc;
			const views = panel.views.filter((id) => id !== viewId);
			let selected = panel.selected;
			if (selected === viewId) {
				const index = panel.views.indexOf(viewId);
				selected = views[Math.min(index, views.length - 1)] ?? "";
			}
			return updatePanel(doc, {
				...panel,
				views,
				selected
			});
		}
		function closeView(doc, viewId) {
			const next = detachView(doc, viewId);
			const views = { ...next.views };
			delete views[viewId];
			return {
				...next,
				views
			};
		}
		function selectView(doc, viewId) {
			const panel = panelOfView(doc, viewId);
			if (!panel || panel.selected === viewId) return doc;
			return updatePanel(doc, {
				...panel,
				selected: viewId
			});
		}
		function reorderTabs(doc, panelId, order) {
			const location = locatePanel(doc, panelId);
			if (!location) return doc;
			const views = location.panel.views;
			if (order.length !== views.length || order.some((id) => !views.includes(id))) return doc;
			return updatePanel(doc, {
				...location.panel,
				views: order
			});
		}
		function insertPanel(doc, panel, target) {
			if ("into" in target) {
				const node = findNode(doc.root, target.into);
				if (node?.kind === "stage") {
					if (!node.child) return {
						...doc,
						root: replaceNode(doc.root, node.id, {
							...node,
							child: panel
						})
					};
					const first = panelsOf(node.child)[0];
					return mergeInto(doc, panel, first.id, target.index);
				}
				return mergeInto(doc, panel, target.into, target.index);
			}
			if (!doc.root) return {
				...doc,
				root: panel
			};
			if (!findNode(doc.root, target.beside)) return insertPanel(doc, panel, {
				beside: doc.root.id,
				edge: target.edge
			});
			return {
				...doc,
				root: insertBeside(doc.root, target.beside, panel, target.edge, uid("split"), target.share)
			};
		}
		function mergeInto(doc, panel, intoId, index) {
			const location = locatePanel(doc, intoId);
			if (!location) return doc;
			const views = [...location.panel.views];
			views.splice(index ?? views.length, 0, ...panel.views);
			return updatePanel(doc, {
				...location.panel,
				views,
				selected: panel.selected
			});
		}
		function floatPanel(doc, panel, rect, layer) {
			const z = Math.max(0, ...doc.floating.map((f) => f.z)) + 1;
			return {
				...removePanel(doc, panel.id),
				floating: [...removePanel(doc, panel.id).floating, {
					panel,
					rect: clampFloat(rect),
					z,
					layer
				}]
			};
		}
		function clampFloat(rect) {
			const w = Math.min(1, Math.max(.02, rect.w));
			const h2 = Math.min(1, Math.max(.02, rect.h));
			return {
				w,
				h: h2,
				x: Math.min(1 - Math.min(w, .05), Math.max(-w + .05, rect.x)),
				y: Math.min(1 - Math.min(h2, .05), Math.max(0, rect.y))
			};
		}
		function raiseFloat(doc, panelId) {
			const top = Math.max(0, ...doc.floating.map((f) => f.z));
			const float = doc.floating.find((f) => f.panel.id === panelId);
			if (!float || float.z === top) return doc;
			return {
				...doc,
				floating: doc.floating.map((f) => f.panel.id === panelId ? {
					...f,
					z: top + 1
				} : f)
			};
		}
		function restoreTargetFor(doc, panelId) {
			const location = locatePanel(doc, panelId);
			if (!location) return null;
			if (location.where === "floating") return {
				kind: "floating",
				rect: location.float.rect,
				layer: location.float.layer
			};
			if (location.where === "hidden") return location.restore;
			const parent = parentSplit(doc.root, panelId);
			if (!parent) {
				const stage = findStage(doc.root);
				if (stage && stage.child?.id === panelId) return {
					kind: "tab",
					panel: stage.id
				};
				return {
					kind: "docked",
					beside: doc.root?.id ?? "",
					edge: "left",
					share: .5
				};
			}
			const index = parent.children.findIndex((c) => c.id === panelId);
			const after = !!parent.children[index + 1];
			const neighbourIndex = after ? index + 1 : index - 1;
			const neighbour = parent.children[neighbourIndex];
			const own = parent.weights[index];
			const share = own / (own + parent.weights[neighbourIndex]);
			const edge = parent.axis === "x" ? after ? "left" : "right" : after ? "top" : "bottom";
			return {
				kind: "docked",
				beside: neighbour.id,
				edge,
				share
			};
		}
		function parentSplit(root, id) {
			if (!root || root.kind === "panel") return null;
			if (root.kind === "stage") return parentSplit(root.child ?? null, id);
			if (root.children.some((c) => c.id === id)) return root;
			for (const child of root.children) {
				const found = parentSplit(child, id);
				if (found) return found;
			}
			return null;
		}
		function hidePanel(doc, panelId) {
			const location = locatePanel(doc, panelId);
			if (!location || location.where === "hidden") return doc;
			const restore = restoreTargetFor(doc, panelId);
			const removed = removePanel(doc, panelId);
			return {
				...removed,
				hidden: [...removed.hidden, {
					panel: location.panel,
					restore
				}]
			};
		}
		function restorePanel(doc, panelId, fallbackLayer) {
			const hidden = doc.hidden.find((h2) => h2.panel.id === panelId);
			if (!hidden) return doc;
			const without = {
				...doc,
				hidden: doc.hidden.filter((h2) => h2.panel.id !== panelId)
			};
			const { restore, panel } = hidden;
			if (restore.kind === "floating") return floatPanel(without, panel, restore.rect, restore.layer);
			if (restore.kind === "tab") {
				const target = locatePanel(without, restore.panel);
				const node = findNode(without.root, restore.panel);
				if (target && target.where !== "hidden" || node?.kind === "stage") return insertPanel(without, panel, { into: restore.panel });
			}
			if (restore.kind === "docked" && findNode(without.root, restore.beside)) return insertPanel(without, panel, {
				beside: restore.beside,
				edge: restore.edge,
				share: restore.share
			});
			if (without.root) return floatPanel(without, panel, {
				x: .25,
				y: .2,
				w: .5,
				h: .6
			}, fallbackLayer);
			return {
				...without,
				root: panel
			};
		}
		function sanitize(input, isKnownType = () => true) {
			const doc = {
				schema: 1,
				version: input.version,
				root: input.root ?? null,
				floating: Array.isArray(input.floating) ? input.floating : [],
				hidden: Array.isArray(input.hidden) ? input.hidden : [],
				views: { ...input.views ?? {} },
				navigation: input.navigation
			};
			const seen = /* @__PURE__ */ new Set();
			const seenPanels = /* @__PURE__ */ new Set();
			const keep = (id) => {
				const record = doc.views[id];
				if (!record || typeof record.type !== "string" || seen.has(id)) return false;
				if (!isKnownType(record.type)) return false;
				seen.add(id);
				return true;
			};
			const fixPanel = (panel) => {
				if (!panel || panel.kind !== "panel" || seenPanels.has(panel.id)) return null;
				seenPanels.add(panel.id);
				const views = (panel.views ?? []).filter(keep);
				if (!views.length) return null;
				return {
					...panel,
					views,
					selected: views.includes(panel.selected) ? panel.selected : views[0]
				};
			};
			let stages = 0;
			const fixNode = (node) => {
				if (!node || typeof node !== "object") return null;
				if (node.kind === "panel") return fixPanel(node);
				if (node.kind === "stage") {
					if (stages++) return node.child ? fixNode(node.child) : null;
					const child = node.child ? fixNode(node.child) : null;
					return {
						kind: "stage",
						id: node.id,
						child: child?.kind === "stage" ? void 0 : child ?? void 0
					};
				}
				if (node.kind === "split" && Array.isArray(node.children)) {
					const children = [];
					const weights = [];
					node.children.forEach((c, i) => {
						const fixed = fixNode(c);
						if (fixed) {
							children.push(fixed);
							const w = node.weights?.[i];
							weights.push(Number.isFinite(w) && w > 0 ? w : 1);
						}
					});
					if (!children.length) return null;
					return normalize$1({
						kind: "split",
						id: node.id,
						axis: node.axis === "y" ? "y" : "x",
						weights,
						children
					});
				}
				return null;
			};
			doc.root = doc.root ? fixNode(doc.root) : null;
			doc.root = doc.root ? normalize$1(doc.root) : null;
			doc.floating = doc.floating.map((f) => {
				const panel = f && fixPanel(f.panel);
				return panel ? {
					panel,
					rect: clampFloat(f.rect ?? {
						x: .2,
						y: .2,
						w: .4,
						h: .4
					}),
					z: Number.isFinite(f.z) ? f.z : 1,
					layer: f.layer === "stage" ? "stage" : "overlay"
				} : null;
			}).filter((f) => !!f);
			doc.hidden = doc.hidden.map((h2) => {
				const panel = h2 && fixPanel(h2.panel);
				return panel ? {
					panel,
					restore: h2.restore ?? {
						kind: "floating",
						rect: {
							x: .2,
							y: .2,
							w: .5,
							h: .5
						},
						layer: "overlay"
					}
				} : null;
			}).filter((h2) => !!h2);
			for (const id of Object.keys(doc.views)) if (!seen.has(id)) delete doc.views[id];
			return doc;
		}
		function viewIds(doc) {
			return allPanels(doc).flatMap((p) => p.views);
		}
		function createDocument(root, options = {}) {
			const views = {};
			const explicit = /* @__PURE__ */ new Set();
			const collect = (spec) => {
				if (!spec) return;
				if (spec.kind === "view") spec.id && explicit.add(spec.id);
				else if (spec.kind === "panel") spec.views.forEach(collect);
				else if (spec.kind === "split") spec.children.forEach(collect);
				else collect(spec.child);
			};
			collect(root ?? void 0);
			for (const f of options.floating ?? []) collect(f.panel);
			const counters = /* @__PURE__ */ new Map();
			const nextId = (type) => {
				let id;
				do {
					const n = (counters.get(type) ?? 0) + 1;
					counters.set(type, n);
					id = `${type}-${n}`;
				} while (explicit.has(id) || views[id]);
				return id;
			};
			const addView = (spec) => {
				const id = spec.id ?? nextId(spec.type);
				if (views[id]) throw Error(`Trellis: duplicate view id "${id}"`);
				views[id] = {
					type: spec.type,
					...spec.params ? { params: spec.params } : {},
					...spec.title ? { title: spec.title } : {}
				};
				return id;
			};
			const panel = (spec) => {
				const ids = (spec.kind === "view" ? [spec] : spec.views).map(addView);
				const index = spec.kind === "panel" ? spec.selected ?? 0 : 0;
				return {
					kind: "panel",
					id: spec.kind === "panel" && spec.id || uid("panel"),
					views: ids,
					selected: ids[Math.min(index, ids.length - 1)] ?? ""
				};
			};
			let stages = 0;
			const build = (spec) => {
				switch (spec.kind) {
					case "view":
					case "panel": return panel(spec);
					case "stage": {
						if (stages++) throw Error("Trellis: a layout may contain one stage");
						const child = spec.child ? build(spec.child) : void 0;
						if (child?.kind === "stage") throw Error("Trellis: a stage cannot contain a stage");
						return {
							kind: "stage",
							id: spec.id ?? "stage",
							child
						};
					}
					case "split": {
						const children = spec.children.map(build);
						const weights = spec.weights && spec.weights.length === children.length ? spec.weights : children.map(() => 1);
						return {
							kind: "split",
							id: spec.id ?? uid("split"),
							axis: spec.axis,
							weights,
							children
						};
					}
				}
			};
			const tree = root ? normalize$1(build(root)) : null;
			return {
				schema: 1,
				...options.version !== void 0 ? { version: options.version } : {},
				root: tree,
				floating: (options.floating ?? []).map((f, i) => ({
					panel: panel(f.panel),
					rect: f.rect,
					z: i + 1,
					layer: f.layer ?? "overlay"
				})),
				hidden: [],
				views
			};
		}
		function dragBoundary(root, metrics, splitId, index) {
			const entries = layoutRects(root, metrics);
			const dragged = entries.get(splitId)?.node;
			if (dragged?.kind !== "split" || index < 0 || index >= dragged.children.length - 1) return null;
			const axis = dragged.axis;
			const pixels = axis === "x" ? metrics.width : metrics.height;
			const lo = (r) => axis === "x" ? r.x : r.y;
			const len = (r) => axis === "x" ? r.w : r.h;
			const scaleOf = (id) => entries.get(id)?.scale ?? 1;
			const pos = [];
			const next = [];
			const prev = [];
			const position = (at) => {
				pos.push(at);
				next.push([]);
				prev.push([]);
				return pos.length - 1;
			};
			const atLeast = (from, to, gap) => {
				next[from].push({
					to,
					gap
				});
				prev[to].push({
					from,
					gap
				});
			};
			const minOf = (node) => metrics.min(node, axis) * scaleOf(node.id) / pixels;
			const groups = /* @__PURE__ */ new Map();
			const walk = (node, a, b) => {
				if (node.kind === "panel") return atLeast(a, b, minOf(node));
				if (node.kind === "stage") return node.child ? walk(node.child, a, b) : atLeast(a, b, minOf(node));
				if (node.axis !== axis) return node.children.forEach((child) => walk(child, a, b));
				const ids = [
					a,
					...node.children.slice(1).map((child) => position(lo(entries.get(child.id).rect))),
					b
				];
				groups.set(node.id, {
					node,
					ids,
					cramped: crampedAlong(node)
				});
				node.children.forEach((child, i) => walk(child, ids[i], ids[i + 1]));
			};
			const crampedAlong = (node) => {
				const own = scaleOf(node.id);
				const factor = scaleOf(node.children[0].id) / own;
				if (factor >= 1 - 1e-9) return false;
				return len(entries.get(node.id).rect) * pixels / own / sum(node.children.map((child) => metrics.min(child, axis))) <= factor + 1e-9;
			};
			const rootRect = entries.get(root.id).rect;
			const first = position(lo(rootRect));
			const last = position(lo(rootRect) + len(rootRect));
			walk(root, first, last);
			const handle = groups.get(splitId).ids[index + 1];
			const order = topological(next);
			const ahead = pos.map(() => -Infinity);
			ahead[handle] = 0;
			for (const u of order) if (ahead[u] > -Infinity) for (const e of next[u]) ahead[e.to] = Math.max(ahead[e.to], ahead[u] + e.gap);
			const behind = pos.map(() => -Infinity);
			behind[handle] = 0;
			for (const u of [...order].reverse()) if (behind[u] > -Infinity) for (const e of prev[u]) behind[e.from] = Math.max(behind[e.from], behind[u] + e.gap);
			const start = pos[handle];
			const reachMax = Math.max(start, pos[last] - ahead[last]);
			const reachMin = Math.min(start, pos[first] + behind[first]);
			const solve = (p) => {
				const moved = pos.map((at, v) => p >= start ? ahead[v] > -Infinity ? Math.max(at, p + ahead[v]) : at : behind[v] > -Infinity ? Math.min(at, p - behind[v]) : at);
				moved[handle] = p;
				const weights = /* @__PURE__ */ new Map();
				for (const { node, ids, cramped } of groups.values()) {
					const before = ids.slice(1).map((id, i) => pos[id] - pos[ids[i]]);
					const after = ids.slice(1).map((id, i) => moved[id] - moved[ids[i]]);
					const total = sum(after);
					const was = sum(before);
					if (after.every((a, i) => Math.abs(a / total - before[i] / was) < 1e-12)) continue;
					if (cramped && ids.slice(1, -1).every((id) => moved[id] === pos[id])) continue;
					weights.set(node.id, after.map((a) => a / total));
				}
				return weights.size ? reweigh(root, weights) : root;
			};
			const beside = dragged.children[index + 1].id;
			const landed = (layout2) => layout2 === root ? start : lo(layoutRects(layout2, metrics).get(beside).rect);
			const min = reachMin === start ? start : Math.min(start, landed(solve(reachMin)));
			const max = reachMax === start ? start : Math.max(start, landed(solve(reachMax)));
			return {
				axis,
				start,
				min,
				max,
				to(target) {
					const p = Math.max(min, Math.min(max, target));
					const guess = solve(Math.max(reachMin, Math.min(reachMax, p)));
					if (Math.abs(landed(guess) - p) < 1e-9) return guess;
					let [below, above] = p >= start ? [start, reachMax] : [reachMin, start];
					for (let i = 0; i < 50 && above - below > 1e-12; i++) {
						const mid = (below + above) / 2;
						if (landed(solve(mid)) < p) below = mid;
						else above = mid;
					}
					return solve(p >= start ? above : below);
				}
			};
		}
		function topological(next) {
			const incoming = next.map(() => 0);
			for (const edges of next) for (const e of edges) incoming[e.to]++;
			const queue = incoming.flatMap((n, v) => n === 0 ? [v] : []);
			const order = [];
			while (queue.length) {
				const u = queue.shift();
				order.push(u);
				for (const e of next[u]) if (--incoming[e.to] === 0) queue.push(e.to);
			}
			return order;
		}
		function reweigh(node, weights) {
			if (node.kind === "panel") return node;
			if (node.kind === "stage") {
				if (!node.child) return node;
				const child = reweigh(node.child, weights);
				return child === node.child ? node : {
					...node,
					child
				};
			}
			const children = node.children.map((child) => reweigh(child, weights));
			const w = weights.get(node.id);
			if (!w && children.every((child, i) => child === node.children[i])) return node;
			return {
				...node,
				children,
				weights: w ?? node.weights
			};
		}
		function leafIds(node) {
			if (!node) return [];
			if (node.kind === "panel") return [node.id];
			if (node.kind === "stage") return node.child ? leafIds(node.child) : [node.id];
			return node.children.flatMap(leafIds);
		}
		function focusLayout(root, metrics) {
			const entries = layoutRects(root, metrics);
			for (const { node } of [...entries.values()]) {
				if (node.kind !== "split" || node.children.length < 3) continue;
				for (let start = 0; start < node.children.length - 1; start++) for (let end = start + 2; end <= node.children.length; end++) {
					if (start === 0 && end === node.children.length) continue;
					const children = node.children.slice(start, end);
					const first = entries.get(children[0].id).rect;
					const last = entries.get(children[children.length - 1].id).rect;
					const id = rangeId(node.id, children.map((c) => c.id));
					const weights = node.weights.slice(start, end);
					const total = sum(weights);
					entries.set(id, {
						node: {
							kind: "split",
							id,
							axis: node.axis,
							children,
							weights: weights.map((w) => w / total)
						},
						rect: {
							x: first.x,
							y: first.y,
							w: last.x + last.w - first.x,
							h: last.y + last.h - first.y
						},
						parent: node.id,
						virtual: true
					});
				}
			}
			return entries;
		}
		var rangeId = (splitId, children) => `range:${JSON.stringify([splitId, ...children])}`;
		function navParent(entries, id) {
			const entry = entries.get(id);
			let at = entry?.parent ?? null;
			while (at) {
				const parent = entries.get(at);
				if (!parent) return null;
				if (!sameRect(parent.rect, entry.rect)) return at;
				at = parent.parent;
			}
			return null;
		}
		function navNode(entries, id) {
			let node = entries.get(id)?.node;
			while (node?.kind === "stage" && node.child) node = node.child;
			return node?.id ?? id;
		}
		function sameRect(a, b) {
			return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.h - b.h) < 1e-9;
		}
		function containsNode(node, id) {
			if (node.id === id) return true;
			if (node.kind === "stage") return !!node.child && containsNode(node.child, id);
			if (node.kind === "split") return node.children.some((c) => containsNode(c, id));
			return false;
		}
		function bestFit(camera, entries) {
			let best = "";
			let score = Infinity;
			for (const [id, { rect: r, node }] of entries) {
				if (node.kind === "stage" && node.child) continue;
				const next = Math.abs(Math.log(r.w / camera.w)) + Math.abs(Math.log(r.h / camera.h)) + Math.hypot((r.x + r.w / 2 - camera.x - camera.w / 2) / camera.w, (r.y + r.h / 2 - camera.y - camera.h / 2) / camera.h) * 2.5;
				if (next < score) {
					best = id;
					score = next;
				}
			}
			return best;
		}
		function hierarchyStep(entries, focused, direction, point) {
			const id = navNode(entries, focused);
			const entry = entries.get(id);
			if (!entry) return focused;
			if (direction === "out") return navParent(entries, id) ?? id;
			if (entry.node.kind !== "split") return id;
			const split = entry.node;
			const coordinate = split.axis === "x" ? point.x : point.y;
			for (const child of split.children.slice(0, -1)) {
				const r = entries.get(child.id).rect;
				if (coordinate < (split.axis === "x" ? r.x + r.w : r.y + r.h)) return navNode(entries, child.id);
			}
			return navNode(entries, split.children[split.children.length - 1].id);
		}
		function frameLeaves(root, ids) {
			if (!root) return null;
			const entries = focusLayout(root);
			const wanted = ids.filter((id) => entries.has(id));
			let best = entries.get(root.id);
			for (const entry of entries.values()) {
				if (entry.node.kind === "stage" && entry.node.child) continue;
				if (entry.rect.w * entry.rect.h < best.rect.w * best.rect.h && wanted.every((id) => containsNode(entry.node, id))) best = entry;
			}
			return best.node.id;
		}
		function rectangleCamera(a, b, viewport, camera) {
			const clamp = (value) => Math.max(0, Math.min(1, value));
			const ax = clamp((a.x - viewport.x) / viewport.w);
			const ay = clamp((a.y - viewport.y) / viewport.h);
			const bx = clamp((b.x - viewport.x) / viewport.w);
			const by = clamp((b.y - viewport.y) / viewport.h);
			return {
				x: camera.x + Math.min(ax, bx) * camera.w,
				y: camera.y + Math.min(ay, by) * camera.h,
				w: Math.abs(bx - ax) * camera.w,
				h: Math.abs(by - ay) * camera.h
			};
		}
		function recordVisit(visits, index, visit) {
			const previous = visits[index];
			if (previous && previous.id === visit.id && previous.leaves.join("|") === visit.leaves.join("|")) return {
				visits,
				index
			};
			const next = [...visits.slice(0, index + 1), visit];
			return {
				visits: next,
				index: next.length - 1
			};
		}
		function savedFrameDestination(root, leaves) {
			const entries = layoutRects(root);
			const surviving = leaves.filter((id) => entries.has(id));
			return surviving.length ? frameLeaves(root, surviving) : null;
		}
		function maximizeTransition(entries, rootId, focused, id, session) {
			if (focused === id) return {
				destination: session?.id === id ? session.returnPath.find((key) => key !== id && entries.has(key)) ?? rootId : navParent(entries, id) ?? rootId,
				session: null
			};
			const returnPath = [];
			let at = focused;
			while (at) {
				returnPath.push(at);
				at = entries.get(at)?.parent ?? null;
			}
			return {
				destination: id,
				session: {
					id,
					returnPath
				}
			};
		}
		function dropEdge(point, rect) {
			if (rect.w <= 0 || rect.h <= 0) return null;
			const x = (point.x - rect.x) / rect.w;
			const y = (point.y - rect.y) / rect.h;
			if (x < 0 || x > 1 || y < 0 || y > 1) return null;
			const edges = [
				["left", x],
				["right", 1 - x],
				["top", y],
				["bottom", 1 - y]
			];
			edges.sort((a, b) => a[1] - b[1]);
			return edges[0][1] <= .28 ? edges[0][0] : null;
		}
		function dropRects(rect, edge) {
			const slot = { ...rect };
			const remaining = { ...rect };
			const collapsed = { ...rect };
			if (edge === "left" || edge === "right") {
				slot.w = remaining.w = rect.w / 2;
				collapsed.w = 0;
				if (edge === "left") remaining.x += slot.w;
				else {
					slot.x += slot.w;
					collapsed.x += rect.w;
				}
			} else {
				slot.h = remaining.h = rect.h / 2;
				collapsed.h = 0;
				if (edge === "top") remaining.y += slot.h;
				else {
					slot.y += slot.h;
					collapsed.y += rect.h;
				}
			}
			return {
				slot,
				remaining,
				collapsed
			};
		}
		function seamTarget(group, boundary) {
			return {
				id: group.id,
				edge: group.axis === "x" ? "left" : "top",
				boundary,
				seam: {
					axis: group.axis,
					leaves: leafIds(group),
					before: group.children.slice(0, boundary).flatMap(leafIds)
				}
			};
		}
		function tileDropTarget(entries, id, edge) {
			const entry = entries.get(id);
			const parent = entry?.parent ? entries.get(entry.parent)?.node : null;
			if (parent?.kind === "split" && parent.axis === edgeAxis(edge)) return seamTarget(parent, parent.children.findIndex((child) => child.id === id) + (edge === "right" || edge === "bottom" ? 1 : 0));
			return {
				id,
				edge
			};
		}
		function frameDropTarget(group, point, width, height, radius) {
			if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) return null;
			const distances = [
				["left", point.x],
				["right", width - point.x],
				["top", point.y],
				["bottom", height - point.y]
			];
			distances.sort((a, b) => a[1] - b[1]);
			const [edge, distance] = distances[0];
			if (distance > radius) return null;
			const axis = edgeAxis(edge);
			const after = edge === "right" || edge === "bottom";
			const inner = group.kind === "stage" && group.child ? group.child : group;
			if (inner.kind === "split" && inner.axis === axis) return seamTarget(inner, after ? inner.children.length : 0);
			return {
				id: group.id,
				edge,
				seam: {
					axis,
					leaves: leafIds(group),
					before: after ? leafIds(group) : []
				}
			};
		}
		function insertAtSeam(root, seam, incoming, splitId) {
			const surviving = new Set(leafIds(root).filter((id) => seam.leaves.includes(id)));
			if (!surviving.size) return root;
			const insert = (node) => {
				if (node.kind === "stage" && node.child) {
					const ids = new Set(leafIds(node.child));
					if ([...surviving].every((id) => ids.has(id)) && !surviving.has(node.id)) return {
						...node,
						child: insert(node.child)
					};
				}
				if (node.kind === "split") {
					const container = node.children.findIndex((child) => {
						const ids = new Set(leafIds(child));
						return [...surviving].every((id) => ids.has(id));
					});
					if (container >= 0) return {
						...node,
						children: node.children.map((child, i) => i === container ? insert(child) : child)
					};
					if (node.axis === seam.axis) {
						const index = node.children.findIndex((child) => leafIds(child).some((id) => !seam.before.includes(id)));
						const children = [...node.children];
						const total = sum(node.weights);
						const share = 1 / (children.length + 1);
						const weights = node.weights.map((w) => w / total * (1 - share));
						children.splice(index < 0 ? children.length : index, 0, incoming);
						weights.splice(index < 0 ? node.children.length : index, 0, share);
						return {
							...node,
							children,
							weights
						};
					}
				}
				const before = ![...surviving].some((id) => seam.before.includes(id));
				const edge = seam.axis === "x" ? before ? "left" : "right" : before ? "top" : "bottom";
				return insertBeside(node, node.id, incoming, edge, splitId);
			};
			return normalize$1(insert(root)) ?? root;
		}
		function applyDockTarget(root, target, incoming, splitId) {
			if (!root) return incoming;
			if (target.seam) return insertAtSeam(root, target.seam, incoming, splitId);
			return insertBeside(root, target.id, incoming, target.edge, splitId);
		}
		var DROP_SLOT = "__trellis-drop-slot";
		var SOURCE_SLOT = "__trellis-source-slot";
		var THRESHOLD = 6;
		var SETTLE_MS = 150;
		var PICKUP_MS = 280;
		var COMPACT = {
			w: 380,
			h: 260
		};
		var DESKTOP_SPLIT_MAX_PX = 64;
		var MIN_SEAM_HIT_WIDTH = 8;
		var OVERLAY_EDGE_BAND = .14;
		function sameTarget(a, b) {
			if (!a || !b) return a === b;
			if (a.kind !== b.kind) return false;
			if (a.kind === "tab" && b.kind === "tab") return a.panel === b.panel && a.index === b.index;
			if (a.kind === "stage" && b.kind === "stage") return a.stage === b.stage;
			if (a.kind === "dock" && b.kind === "dock") return a.spec.id === b.spec.id && a.spec.edge === b.spec.edge && (a.spec.seam ? `${a.spec.seam.axis}|${a.spec.seam.before.join()}|${a.spec.seam.leaves.join()}` : "") === (b.spec.seam ? `${b.spec.seam.axis}|${b.spec.seam.before.join()}|${b.spec.seam.leaves.join()}` : "");
			return true;
		}
		var inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
		function createDragController(host) {
			let session = null;
			let pickupFrame = 0;
			let cleanup = null;
			let suppressClickUntil = 0;
			const local = (e) => {
				const b = host.root.getBoundingClientRect();
				return {
					x: e.clientX - b.left,
					y: e.clientY - b.top
				};
			};
			function begin(e, panel, viewId) {
				if (session || e.button !== 0 || e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
				const doc = host.doc();
				const float = doc.floating.find((f) => f.panel.id === panel.id);
				const tab = viewId && panel.views.length > 1 ? viewId : null;
				const screen = host.lastRects.get(panel.id) ?? {
					x: 0,
					y: 0,
					w: 0,
					h: 0
				};
				const p = local(e);
				session = {
					pointerId: e.pointerId,
					start: {
						x: e.clientX,
						y: e.clientY
					},
					active: false,
					origin: doc,
					lifted: panel,
					inDoc: true,
					pendingTab: tab,
					tabSort: null,
					excludedHost: null,
					tabOrigin: null,
					tabRollback: false,
					fromFloat: float ? float.layer : null,
					fromFrame: host.frameOnly(panel.id),
					base: /* @__PURE__ */ new Map(),
					sourceScreen: { ...screen },
					pdoc: doc,
					dropBase: /* @__PURE__ */ new Map(),
					collapsed: false,
					layoutTargets: /* @__PURE__ */ new Map(),
					floating: { ...screen },
					pickupAt: 0,
					compactFrom: 0,
					compactTo: 0,
					compactAmount: 0,
					desktopAmount: 0,
					sizeTick: performance.now(),
					pointer: p,
					grabX: screen.w ? (p.x - screen.x) / screen.w : .5,
					grabY: p.y - screen.y,
					target: null,
					candidate: null,
					targetTimer: void 0,
					dropLabel: ""
				};
				if (tab) {
					const dom = host.panelDom(panel.id);
					if (dom) {
						const items = panel.views.map((id) => ({
							id,
							el: dom.tabs.get(id)?.el
						})).filter((x) => !!x.el).map(({ id, el }) => {
							const r = el.getBoundingClientRect();
							return {
								id,
								el,
								x: r.left,
								width: r.width
							};
						});
						const grabbed = items.find((item) => item.id === tab);
						session.tabSort = {
							row: dom.tabbar.getBoundingClientRect(),
							items,
							order: items.map((item) => item.id),
							grab: grabbed ? e.clientX - grabbed.x : 0,
							started: false
						};
					}
				}
				const controller = new AbortController();
				const signal = controller.signal;
				const onMove = (ev) => {
					if (session && ev.pointerId === session.pointerId) move(ev);
				};
				const onUp = (ev) => {
					if (!session || ev.pointerId !== session.pointerId) return;
					move(ev);
					end(true);
				};
				const onCancel = (ev) => {
					if (session && ev.pointerId === session.pointerId) end(false);
				};
				window.addEventListener("pointermove", onMove, { signal });
				window.addEventListener("pointerup", onUp, { signal });
				window.addEventListener("pointercancel", onCancel, { signal });
				window.addEventListener("blur", () => end(false), { signal });
				window.addEventListener("keydown", (ev) => {
					if (ev.key === "Escape" && session) {
						ev.preventDefault();
						ev.stopPropagation();
						end(false);
					}
				}, {
					signal,
					capture: true
				});
				host.lifetime.add(() => controller.abort());
				cleanup = () => controller.abort();
			}
			function clearTabSort(d) {
				for (const item of d.tabSort?.items ?? []) {
					item.el.style.removeProperty("transform");
					item.el.removeAttribute("data-sorting");
					item.el.removeAttribute("data-dragging");
				}
			}
			function sortTabAtPointer(d, e) {
				const sort = d.tabSort;
				sort.started = true;
				const dragged = sort.items.find((item) => item.id === d.pendingTab);
				const list = host.panelDom(d.lifted.id)?.tablist.getBoundingClientRect() ?? sort.row;
				const left = Math.max(list.left, Math.min(list.right - dragged.width, e.clientX - sort.grab));
				let x = sort.items[0].x;
				let index = 0;
				for (const id of sort.order) {
					const item = sort.items.find((item2) => item2.id === id);
					if (id !== dragged.id && e.clientX > x + item.width / 2) index++;
					x += item.width;
				}
				sort.order = sort.order.filter((id) => id !== dragged.id);
				sort.order.splice(index, 0, dragged.id);
				x = sort.items[0].x;
				for (const id of sort.order) {
					const item = sort.items.find((item2) => item2.id === id);
					item.el.setAttribute("data-sorting", "");
					if (id === dragged.id) item.el.setAttribute("data-dragging", "");
					item.el.style.transform = `translateX(${(id === dragged.id ? left : x) - item.x}px)`;
					x += item.width;
				}
			}
			function move(e) {
				const d = session;
				if (!d.active) {
					if (Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < THRESHOLD) return;
					if (d.pendingTab && d.tabSort) {
						const row = d.tabSort.row;
						if (e.clientX >= row.left && e.clientX <= row.right && e.clientY >= row.top && e.clientY <= row.bottom) {
							sortTabAtPointer(d, e);
							return;
						}
						clearTabSort(d);
					}
					activate(d);
				}
				d.pointer = local(e);
				retarget(d, e);
				host.schedule();
			}
			function activate(d) {
				host.closeMenus();
				d.active = true;
				let doc = host.doc();
				if (d.pendingTab) {
					const origin = host.lastRects.get(d.lifted.id) ?? d.sourceScreen;
					const hostPanel = d.lifted;
					const order = d.tabSort?.order ?? hostPanel.views;
					doc = reorderTabs(doc, hostPanel.id, order);
					doc = detachView(doc, d.pendingTab);
					d.lifted = {
						kind: "panel",
						id: uid("panel"),
						views: [d.pendingTab],
						selected: d.pendingTab
					};
					d.inDoc = false;
					d.excludedHost = hostPanel.id;
					d.tabOrigin = { ...origin };
					d.tabRollback = true;
					d.fromFloat = d.fromFloat ?? "stage";
					d.fromFrame = false;
					d.sourceScreen = { ...origin };
					d.pendingTab = null;
					host.setDoc(doc);
				}
				d.pdoc = doc;
				d.dropBase = layoutRects(doc.root, host.layoutMetrics());
				d.base = new Map([...d.dropBase].map(([id, e]) => [id, { ...e.rect }]));
				d.layoutTargets = restingLayout(d);
				d.pickupAt = performance.now();
				d.floating = { ...d.sourceScreen };
				try {
					host.root.setPointerCapture(d.pointerId);
				} catch {}
				host.root.setAttribute("data-dragging", "");
				host.busy(true);
				const tick = () => {
					if (session !== d) return;
					host.render();
					pickupFrame = host.lifetime.frame(tick);
				};
				pickupFrame = host.lifetime.frame(tick);
			}
			function retarget(d, e) {
				const viewport = host.viewport();
				const p = d.pointer;
				const point = host.fromScreen(p);
				const within = p.x >= 0 && p.y >= 0 && p.x <= viewport.w && p.y <= viewport.h;
				const layer = host.floatingLayer();
				const doc = d.pdoc;
				const stage = findStage(doc.root);
				const stageIsDesktop = !!stage && !stage.child && layer === "stage";
				const overlayMove = d.fromFloat === "overlay";
				const stageWorld = stage?.child ? d.dropBase.get(stage.id)?.rect : void 0;
				const stageMove = d.fromFloat === "stage" && !d.tabRollback && !!stageWorld && inside(point, stageWorld);
				const floatMove = overlayMove || stageMove;
				let next = null;
				if (within) {
					const overlays = doc.floating.filter((f) => f.layer === "overlay" && f.panel.id !== d.lifted.id).sort((a, b) => b.z - a.z);
					for (const f of overlays) {
						const r = host.lastRects.get(f.panel.id);
						if (!r || !inside(p, r)) continue;
						next = tabTarget(f.panel, p, r) ?? (dropEdge(p, r) ? null : {
							kind: "tab",
							panel: f.panel.id
						});
						return settle(d, filter(d, next));
					}
				}
				let hovered = null;
				if (within) for (const id of leafIds(doc.root)) {
					if (id === d.lifted.id) continue;
					const r = d.dropBase.get(id)?.rect;
					if (r && inside(point, r)) {
						hovered = id;
						break;
					}
				}
				const hoveredNode = hovered ? findNode(doc.root, hovered) : null;
				const collapsed = hovered ? host.collapsedGroupOf(hovered) : null;
				if (collapsed) {
					const rect = d.dropBase.get(collapsed)?.rect;
					const edge = rect ? dropEdge(point, rect) : null;
					next = edge ? {
						kind: "dock",
						spec: tileDropTarget(d.dropBase, collapsed, edge)
					} : null;
				} else if (hovered && hoveredNode?.kind === "panel") {
					const screen = host.panelScreen(d.dropBase.get(hovered).rect);
					const bar = tabTarget(hoveredNode, p, screen);
					if (bar) next = bar;
					else {
						const edge = floatMove ? overlayEdge(p, screen) : dropEdge(point, d.dropBase.get(hovered).rect);
						next = edge ? {
							kind: "dock",
							spec: tileDropTarget(d.dropBase, hovered, edge)
						} : floatMove ? { kind: "float" } : {
							kind: "tab",
							panel: hovered
						};
					}
				}
				const radius = Math.max(host.inset(), MIN_SEAM_HIT_WIDTH / 2);
				let closest = radius;
				if (within) for (const [id, entry] of d.dropBase) {
					const node = entry.node;
					if (node.kind !== "split" || host.collapsedSplit(node.id)) continue;
					if (!inside(p, host.toScreen(entry.rect))) continue;
					node.children.slice(1).forEach((child, index) => {
						const r = host.toScreen(d.dropBase.get(child.id).rect);
						const distance = Math.abs(node.axis === "x" ? p.x - r.x : p.y - r.y);
						if (distance >= closest) return;
						if (!leafIds(node).some((leaf) => leaf !== d.lifted.id)) return;
						closest = distance;
						next = {
							kind: "dock",
							spec: seamTarget(node, index + 1)
						};
					});
				}
				if (within && stage && !stage.child && closest === radius) {
					const world = d.dropBase.get(stage.id)?.rect;
					if (world && inside(point, world)) {
						const s = host.panelScreen(world);
						const distances = [
							["left", p.x - s.x],
							["right", s.x + s.w - p.x],
							["top", p.y - s.y],
							["bottom", s.y + s.h - p.y]
						];
						distances.sort((a, b) => a[1] - b[1]);
						const dimension = distances[0][0] === "left" || distances[0][0] === "right" ? s.w : s.h;
						next = distances[0][1] <= Math.min(DESKTOP_SPLIT_MAX_PX, dimension * .28) ? {
							kind: "dock",
							spec: tileDropTarget(d.dropBase, stage.id, distances[0][0])
						} : stageIsDesktop ? { kind: "float" } : {
							kind: "stage",
							stage: stage.id
						};
					}
				}
				if (next?.kind === "float" && stageIsDesktop) for (const f of [...doc.floating].filter((f2) => f2.layer === "stage").sort((a, b) => b.z - a.z)) {
					if (f.panel.id === d.lifted.id) continue;
					const r = host.floatWorld(f.panel.id);
					if (!r || !inside(point, r)) continue;
					const screen = host.lastRects.get(f.panel.id);
					next = (screen && tabTarget(f.panel, p, screen)) ?? (dropEdge(point, r) ? next : {
						kind: "tab",
						panel: f.panel.id
					});
					break;
				}
				const group = host.framedNode() ?? doc.root;
				if (group) {
					const frame = frameDropTarget(group, p, viewport.w, viewport.h, Math.max(host.inset() * 2, MIN_SEAM_HIT_WIDTH));
					if (frame && leafIds(group).some((id) => id !== d.lifted.id)) next = {
						kind: "dock",
						spec: frame
					};
				}
				if (next?.kind === "tab" && next.panel === d.excludedHost) {
					const hostFloat = doc.floating.find((f) => f.panel.id === d.excludedHost);
					next = hostFloat && hostFloat.layer === "stage" ? { kind: "float" } : null;
				}
				if (!next && within && (overlayMove || stageMove)) next = { kind: "float" };
				settle(d, filter(d, next));
			}
			function tabTarget(panel, p, screen) {
				const bar = host.tabbarHeight(panel);
				if (!bar || !(p.x >= screen.x && p.x <= screen.x + screen.w && p.y >= screen.y && p.y <= screen.y + bar)) return null;
				const dom = host.panelDom(panel.id);
				const rootBox = host.root.getBoundingClientRect();
				let index = panel.views.length;
				if (dom) for (let i = 0; i < panel.views.length; i++) {
					const el = dom.tabs.get(panel.views[i])?.el;
					if (!el) continue;
					const r = el.getBoundingClientRect();
					if (p.x < r.left - rootBox.left + r.width / 2) {
						index = i;
						break;
					}
				}
				return {
					kind: "tab",
					panel: panel.id,
					index
				};
			}
			function overlayEdge(p, r) {
				const x = (p.x - r.x) / r.w;
				const y = (p.y - r.y) / r.h;
				const edges = [
					["left", x],
					["right", 1 - x],
					["top", y],
					["bottom", 1 - y]
				];
				edges.sort((a, b) => a[1] - b[1]);
				return edges[0][1] <= OVERLAY_EDGE_BAND ? edges[0][0] : null;
			}
			function filter(d, next) {
				if (!next) return null;
				const views = d.lifted.views;
				const layer = host.floatingLayer();
				if (next.kind === "float") return layer && host.allowed(views, "floating") ? next : null;
				if (next.kind === "stage") return host.allowed(views, "stage") ? next : null;
				const doc = d.pdoc;
				const stage = findStage(doc.root);
				const inStage = (id) => !!stage?.child && id !== stage.id && containsNode(stage.child, id);
				if (next.kind === "tab") {
					const float = doc.floating.find((f) => f.panel.id === next.panel);
					return host.allowed(views, float ? "floating" : inStage(next.panel) ? "stage" : "side") ? next : null;
				}
				const spec = next.spec;
				const region = spec.seam ? spec.seam.leaves.length && spec.seam.leaves.every((id) => inStage(id)) && inStage(spec.id) ? "stage" : "side" : inStage(spec.id) ? "stage" : "side";
				return host.allowed(views, region) ? next : null;
			}
			function settle(d, next) {
				host.root.setAttribute("data-drop", next ? next.kind : "none");
				if (sameTarget(next, d.candidate)) return;
				d.candidate = next;
				host.lifetime.clearTimeout(d.targetTimer);
				d.targetTimer = void 0;
				if (sameTarget(next, d.target)) return;
				d.targetTimer = host.lifetime.timeout(() => {
					d.targetTimer = void 0;
					if (session !== d) return;
					apply(d, d.candidate);
					host.render();
				}, SETTLE_MS);
			}
			function seamOrigin(d, preview, slot) {
				const parentId = preview.get(DROP_SLOT)?.parent;
				const parent = parentId ? preview.get(parentId)?.node : null;
				const collapsedAtCenter = parent?.kind === "split" && parent.axis === "y" ? {
					...slot,
					y: slot.y + slot.h / 2,
					h: 0
				} : {
					...slot,
					x: slot.x + slot.w / 2,
					w: 0
				};
				if (!parent || parent.kind !== "split") return collapsedAtCenter;
				const index = parent.children.findIndex((c) => c.id === DROP_SLOT);
				const after = parent.children[index + 1];
				const before = parent.children[index - 1];
				const neighbour = after ? currentWorld(d, after.id) : before ? currentWorld(d, before.id) : null;
				if (!neighbour) return collapsedAtCenter;
				if (parent.axis === "x") {
					const x = after ? neighbour.x : neighbour.x + neighbour.w;
					return {
						...slot,
						x,
						w: 0
					};
				}
				const y = after ? neighbour.y : neighbour.y + neighbour.h;
				return {
					...slot,
					y,
					h: 0
				};
			}
			function restingLayout(d) {
				const rects = new Map(d.base);
				for (const [id, entry] of d.dropBase) rects.set(id, entry.rect);
				if (d.collapsed) rects.set(SOURCE_SLOT, collapsedSource(d));
				else if (d.inDoc && !d.fromFloat && d.base.get(d.lifted.id)) rects.set(SOURCE_SLOT, d.base.get(d.lifted.id));
				return rects;
			}
			function collapsedSource(d) {
				const entry = layoutRects(d.origin.root, host.layoutMetrics()).get(d.lifted.id);
				const rect = { ...d.base.get(d.lifted.id) ?? entry?.rect ?? {
					x: 0,
					y: 0,
					w: 0,
					h: 0
				} };
				const parent = entry?.parent ? layoutRects(d.origin.root, host.layoutMetrics()).get(entry.parent)?.node : null;
				if (!parent || parent.kind !== "split") return {
					...rect,
					w: 0
				};
				const hasNext = parent.children.findIndex((c) => c.id === d.lifted.id) < parent.children.length - 1;
				if (parent.axis === "x") {
					if (!hasNext) rect.x += rect.w;
					rect.w = 0;
				} else {
					if (!hasNext) rect.y += rect.h;
					rect.h = 0;
				}
				return rect;
			}
			const worldOf = (id) => host.fromScreenRect(host.lastRects.get(id));
			function currentWorld(d, id) {
				const own = worldOf(id);
				if (own) return own;
				const node = findNode(d.pdoc.root, id);
				const rects = node ? leafIds(node).map(worldOf).filter((r) => !!r) : [];
				if (!rects.length) return d.dropBase.get(id)?.rect ?? null;
				const x = Math.min(...rects.map((r) => r.x));
				const y = Math.min(...rects.map((r) => r.y));
				return {
					x,
					y,
					w: Math.max(...rects.map((r) => r.x + r.w)) - x,
					h: Math.max(...rects.map((r) => r.y + r.h)) - y
				};
			}
			function apply(d, next) {
				if (sameTarget(next, d.target)) return;
				const previous = new Map(host.lastRects);
				const parent = layoutRects(d.origin.root, host.layoutMetrics()).get(d.lifted.id)?.parent;
				if (next && d.inDoc && !d.fromFloat && !d.collapsed && parent) {
					d.collapsed = true;
					d.pdoc = removePanel(d.pdoc, d.lifted.id);
					d.dropBase = layoutRects(d.pdoc.root, host.layoutMetrics());
				}
				d.layoutTargets = restingLayout(d);
				d.dropLabel = "";
				const setSlotFrom = (world) => previous.set(DROP_SLOT, host.panelScreen(world));
				if (next?.kind === "tab") {
					const world = d.dropBase.get(next.panel)?.rect ?? host.floatWorld(next.panel) ?? worldOf(next.panel);
					if (world) {
						d.layoutTargets.set(DROP_SLOT, world);
						setSlotFrom(world);
					} else {
						const screen = host.lastRects.get(next.panel);
						if (screen) {
							d.layoutTargets.set(DROP_SLOT, host.fromScreenRect(screen));
							previous.set(DROP_SLOT, screen);
						}
					}
					d.dropLabel = "Add as tab";
				} else if (next?.kind === "stage") {
					const world = d.dropBase.get(next.stage).rect;
					d.layoutTargets.set(DROP_SLOT, world);
					setSlotFrom({
						...world,
						x: world.x + world.w / 2,
						y: world.y + world.h / 2,
						w: 0,
						h: 0
					});
				} else if (next?.kind === "dock") {
					const placeholder = {
						kind: "panel",
						id: DROP_SLOT,
						views: [DROP_SLOT],
						selected: DROP_SLOT
					};
					const spec = next.spec;
					if (spec.seam || !d.dropBase.get(spec.id)) {
						const preview = layoutRects(applyDockTarget(d.pdoc.root, spec, placeholder, "__trellis-seam-preview"), host.layoutMetrics());
						for (const [id, entry] of preview) d.layoutTargets.set(id, entry.rect);
						const slot = preview.get(DROP_SLOT)?.rect;
						if (slot) setSlotFrom(seamOrigin(d, preview, slot));
					} else {
						const r = dropRects(d.dropBase.get(spec.id).rect, spec.edge);
						d.layoutTargets.set(spec.id, r.remaining);
						d.layoutTargets.set(DROP_SLOT, r.slot);
						const current = currentWorld(d, spec.id);
						setSlotFrom(current ? dropRects(current, spec.edge).collapsed : r.collapsed);
					}
				} else if (!next && d.target && d.target.kind !== "float") {
					const slot = previous.get(DROP_SLOT);
					const world = slot ? host.fromScreenRect(slot) : null;
					if (world) {
						const edge = d.target.kind === "dock" ? d.target.spec.edge : "left";
						d.layoutTargets.set(DROP_SLOT, edge === "left" || edge === "right" ? {
							...world,
							x: world.x + world.w / 2,
							w: 0
						} : {
							...world,
							y: world.y + world.h / 2,
							h: 0
						});
					}
				}
				if (d.collapsed && !previous.has(SOURCE_SLOT)) {
					const base = d.base.get(d.lifted.id);
					if (base) previous.set(SOURCE_SLOT, host.panelScreen(base));
				}
				d.target = next;
				if (!host.reduced()) host.tween.begin(previous, performance.now());
			}
			function liftedRect() {
				const d = session;
				const original = d.sourceScreen;
				const doc = d.pdoc;
				const stage = findStage(doc.root);
				const desktop = stage && !stage.child && host.floatingLayer() === "stage" && d.dropBase.get(stage.id) ? host.panelScreen(d.dropBase.get(stage.id).rect) : null;
				const source = d.collapsed ? null : d.tabOrigin ?? (d.fromFloat && !d.fromFrame ? desktop ?? (d.fromFloat === "overlay" ? fullViewport() : original) : original);
				const now = performance.now();
				const amount = host.reduced() ? 1 : 1 - Math.exp(-(now - d.sizeTick) / 60);
				d.sizeTick = now;
				d.desktopAmount += ((desktop && inside(d.pointer, desktop) ? 1 : 0) - d.desktopAmount) * amount;
				const compactTo = source && inside(d.pointer, source) || !d.fromFrame && desktop && inside(d.pointer, desktop) ? 0 : 1;
				if (compactTo !== d.compactTo) {
					d.compactFrom = d.compactAmount;
					d.compactTo = compactTo;
					d.pickupAt = now;
				}
				const eased = 1 - (1 - (host.reduced() ? 1 : Math.min(1, (now - d.pickupAt) / PICKUP_MS))) ** 3;
				d.compactAmount = d.compactFrom + (d.compactTo - d.compactFrom) * eased;
				const scale = 1 + (Math.min(1, COMPACT.w / Math.max(1, original.w), COMPACT.h / Math.max(1, original.h)) - 1) * d.compactAmount;
				let w = d.fromFrame ? original.w + (COMPACT.w - original.w) * d.compactAmount : original.w * scale;
				let h2 = d.fromFrame ? original.h + (COMPACT.h - original.h) * d.compactAmount : original.h * scale;
				const min = host.minSize(d.lifted.views);
				const bar = host.tabbarHeight(d.lifted);
				w += (Math.max(w, min.w + host.inset() * 2) - w) * d.desktopAmount;
				h2 += (Math.max(h2, min.h + bar + host.inset() * 2) - h2) * d.desktopAmount;
				const grabY = d.grabY + (Math.min(d.grabY, 18) - d.grabY) * d.compactAmount;
				d.floating = {
					x: d.pointer.x - w * d.grabX,
					y: d.pointer.y - grabY,
					w,
					h: h2
				};
				return d.floating;
			}
			const fullViewport = () => ({
				x: 0,
				y: 0,
				...host.viewport()
			});
			function end(commit) {
				const d = session;
				if (!d) return;
				host.lifetime.clearTimeout(d.targetTimer);
				if (commit && d.active) apply(d, d.candidate);
				host.lifetime.cancelFrame(pickupFrame);
				pickupFrame = 0;
				session = null;
				cleanup?.();
				cleanup = null;
				try {
					if (host.root.hasPointerCapture(d.pointerId)) host.root.releasePointerCapture(d.pointerId);
				} catch {}
				host.root.removeAttribute("data-dragging");
				host.root.removeAttribute("data-drop");
				if (!d.active) return endPending(d, commit);
				suppressClickUntil = performance.now() + 350;
				host.busy(false);
				const lifted = d.lifted;
				const from = new Map(host.lastRects);
				from.set(lifted.id, { ...d.floating });
				const target = commit ? d.target : null;
				if (!target) {
					host.setDoc(d.origin);
					host.commit(d.origin, from, lifted.id);
					return;
				}
				const base = host.doc();
				const without = d.inDoc ? removePanel(base, lifted.id) : base;
				let next;
				const layer = host.floatingLayer() || "overlay";
				if (target.kind === "tab") next = insertPanel(without, lifted, {
					into: target.panel,
					index: target.index
				});
				else if (target.kind === "stage") next = insertPanel(without, lifted, { into: target.stage });
				else if (target.kind === "dock") {
					const root = applyDockTarget(without.root, target.spec, lifted, uid("split"));
					next = {
						...without,
						root
					};
				} else {
					const floatLayer = d.fromFloat === "overlay" ? "overlay" : layer;
					next = floatPanel(without, lifted, floatRect(d, without, floatLayer), floatLayer);
				}
				const repositioning = target.kind === "float" && !!d.fromFloat && !d.tabRollback;
				host.setDoc(d.origin);
				host.commit(next, from, repositioning || target.kind === "tab" ? null : lifted.id);
				host.moved(lifted, d.fromFloat && !d.tabRollback ? "floating" : "docked", target.kind);
				host.announce("Moved");
			}
			function floatRect(d, next, layer) {
				const viewport = host.viewport();
				const container = layer === "overlay" ? {
					x: 0,
					y: 0,
					w: viewport.w,
					h: viewport.h
				} : (() => {
					const stage = findStage(next.root);
					const world = stage ? layoutRects(next.root, host.layoutMetrics()).get(stage.id)?.rect : null;
					return host.toScreen(world ?? {
						x: 0,
						y: 0,
						w: 1,
						h: 1
					});
				})();
				const current = d.fromFloat && !d.tabRollback ? host.lastRects.get(d.lifted.id) : null;
				const original = d.fromFrame ? d.floating : current ?? d.sourceScreen;
				const min = host.minSize(d.lifted.views);
				const bar = host.tabbarHeight(d.lifted);
				let w;
				let h2;
				if (d.fromFloat && !d.fromFrame && !d.tabRollback) {
					w = original.w;
					h2 = original.h;
				} else {
					w = Math.min(container.w * (2 / 3), original.w);
					h2 = Math.min(container.h * (2 / 3), original.h);
				}
				w = Math.max(w, min.w + host.inset() * 2);
				h2 = Math.max(h2, min.h + bar + host.inset() * 2);
				const grabY = Math.min(d.grabY, 18 + (d.grabY - 18) * (1 - d.compactAmount));
				const x = d.pointer.x - w * d.grabX;
				const y = d.pointer.y - grabY;
				return {
					x: (x - container.x) / container.w,
					y: (y - container.y) / container.h,
					w: w / container.w,
					h: h2 / container.h
				};
			}
			function endPending(d, commit) {
				const sort = d.tabSort;
				const positions = new Map(sort?.items.map((item) => [item.id, item.el.getBoundingClientRect().left]) ?? []);
				clearTabSort(d);
				if (!commit || !sort?.started || !d.pendingTab) return;
				suppressClickUntil = performance.now() + 350;
				let next = reorderTabs(host.doc(), d.lifted.id, sort.order);
				next = selectView(next, d.pendingTab);
				host.commit(next, /* @__PURE__ */ new Map(), null);
				if (host.reduced()) return;
				for (const item of sort.items) {
					const before = positions.get(item.id);
					if (before === void 0) continue;
					const after = item.el.getBoundingClientRect().left;
					if (Math.abs(before - after) < .5) continue;
					item.el.animate([{ transform: `translateX(${before - after}px)` }, { transform: "translateX(0)" }], {
						duration: 180,
						easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
					});
				}
			}
			return {
				get session() {
					return session;
				},
				get active() {
					return !!session?.active;
				},
				/** Clicks right after a drag or sort are swallowed. */
				get suppressClicks() {
					return performance.now() < suppressClickUntil;
				},
				begin,
				cancel: () => end(false),
				liftedRect,
				/** World rect overrides for docked nodes and the two slots while dragging. */
				layoutTargets: () => session?.active ? session.layoutTargets : null,
				dropLabel: () => session?.dropLabel ?? ""
			};
		}
		function h$1(tag, attrs = {}, ...children) {
			const el = document.createElement(tag);
			for (const [key, value] of Object.entries(attrs)) {
				if (value === void 0 || value === false) continue;
				if (key === "class") el.className = String(value);
				else el.setAttribute(key, value === true ? "" : value);
			}
			el.append(...children);
			return el;
		}
		var icons = {
			close: "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M4.5 4.5l7 7m0-7l-7 7\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" fill=\"none\"/></svg>",
			more: "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><circle cx=\"3.5\" cy=\"8\" r=\"1.25\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"8\" r=\"1.25\" fill=\"currentColor\"/><circle cx=\"12.5\" cy=\"8\" r=\"1.25\" fill=\"currentColor\"/></svg>",
			chevron: "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M6 4l4 4-4 4\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></svg>",
			check: "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M3.5 8.5l3 3 6-7\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/></svg>"
		};
		function setStyle(el, key, value) {
			const cache = el.__trellis ??= {};
			if (cache[key] === value) return;
			cache[key] = value;
			if (key.startsWith("--")) el.style.setProperty(key, value);
			else el.style[key] = value;
		}
		function setAttr(el, key, value) {
			if (value === null) {
				if (el.hasAttribute(key)) el.removeAttribute(key);
			} else if (el.getAttribute(key) !== value) el.setAttribute(key, value);
		}
		function place(el, r, round) {
			let { x, y, w, h: h2 } = r;
			if (round) {
				const x2 = Math.round(x + w);
				const y2 = Math.round(y + h2);
				x = Math.round(x);
				y = Math.round(y);
				w = x2 - x;
				h2 = y2 - y;
			}
			setStyle(el, "transform", `translate(${x}px, ${y}px)`);
			setStyle(el, "width", `${Math.max(0, w)}px`);
			setStyle(el, "height", `${Math.max(0, h2)}px`);
		}
		var DEFAULT_KEYMAP = {
			"frame.toggle": "Mod+Shift+Enter",
			"navigation.back": "Mod+Alt+ArrowLeft",
			"navigation.forward": "Mod+Alt+ArrowRight",
			"navigation.overview": "Mod+Alt+ArrowUp",
			"navigation.stepOut": "Escape",
			"panel.next": "F6",
			"panel.previous": "Shift+F6",
			"tab.next": "Mod+Alt+]",
			"tab.previous": "Mod+Alt+[",
			"view.close": "Mod+Alt+W",
			"panel.float": null,
			"panel.hide": null
		};
		var isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
		var CODES = {
			"[": "BracketLeft",
			"]": "BracketRight",
			".": "Period",
			",": "Comma",
			"/": "Slash",
			";": "Semicolon",
			"'": "Quote",
			"-": "Minus",
			"=": "Equal",
			"`": "Backquote",
			"\\": "Backslash"
		};
		function parseCombo(combo) {
			const parts = combo.split("+").map((p) => p.trim());
			let key = parts.pop() || "+";
			if (key === "" && parts.length) key = "+";
			const has = (name) => parts.some((p) => p.toLowerCase() === name.toLowerCase());
			const result = {
				key,
				mod: has("Mod"),
				ctrl: has("Ctrl") || has("Control"),
				meta: has("Meta") || has("Cmd"),
				alt: has("Alt") || has("Option"),
				shift: has("Shift")
			};
			if (/^[a-z0-9]$/i.test(key)) result.code = /\d/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`;
			else if (CODES[key]) result.code = CODES[key];
			return result;
		}
		function matches(event, combo) {
			const c = parseCombo(combo);
			const mac = isMac();
			const wantCtrl = c.ctrl || c.mod && !mac;
			const wantMeta = c.meta || c.mod && mac;
			if (event.ctrlKey !== wantCtrl || event.metaKey !== wantMeta) return false;
			if (event.altKey !== c.alt || event.shiftKey !== c.shift) return false;
			if (c.code) return event.code === c.code;
			return event.key.toLowerCase() === c.key.toLowerCase();
		}
		function formatCombo(combo) {
			const c = parseCombo(combo);
			const mac = isMac();
			const key = {
				ArrowLeft: "←",
				ArrowRight: "→",
				ArrowUp: "↑",
				ArrowDown: "↓",
				Enter: mac ? "↩" : "Enter"
			}[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
			if (mac) return `${c.ctrl ? "⌃" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.mod || c.meta ? "⌘" : ""}${key}`;
			return [
				c.mod || c.ctrl ? "Ctrl" : "",
				c.meta ? "Meta" : "",
				c.alt ? "Alt" : "",
				c.shift ? "Shift" : "",
				key
			].filter(Boolean).join("+");
		}
		function defaultGestureKeys(mac = isMac()) {
			return {
				pan: "Mod+Alt",
				scale: mac ? ["Mod+Alt+V", "Mod+Ctrl"] : "Mod+Alt+V",
				rect: ["Mod+Alt+Shift", "Mod+Shift"],
				step: "Mod+Alt"
			};
		}
		var MODIFIERS = {
			mod: "mod",
			ctrl: "ctrl",
			control: "ctrl",
			meta: "meta",
			cmd: "meta",
			alt: "alt",
			option: "alt",
			shift: "shift"
		};
		function parseChord(combo) {
			const chord = {
				ctrl: false,
				meta: false,
				alt: false,
				shift: false,
				keys: []
			};
			for (const part of combo.split("+").map((p) => p.trim())) {
				if (!part) continue;
				const modifier = MODIFIERS[part.toLowerCase()];
				if (modifier === "mod") chord[isMac() ? "meta" : "ctrl"] = true;
				else if (modifier) chord[modifier] = true;
				else if (/^[a-z]$/i.test(part)) chord.keys.push(`Key${part.toUpperCase()}`);
				else if (/^\d$/.test(part)) chord.keys.push(`Digit${part}`);
				else chord.keys.push(part === " " || part.toLowerCase() === "space" ? "Space" : part);
			}
			return chord;
		}
		var combosOf = (combo) => combo ? [combo].flat() : [];
		function matchesChord(e, combo, held) {
			return combosOf(combo).some((one) => matchesOne(e, one, held));
		}
		function matchesOne(e, combo, held) {
			const c = parseChord(combo);
			return e.ctrlKey === c.ctrl && e.metaKey === c.meta && e.altKey === c.alt && e.shiftKey === c.shift && c.keys.every((k) => held.has(k));
		}
		function isNotchedWheel(e) {
			if (e.deltaMode !== 0) return true;
			const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
			return Math.abs(d) >= 40 && Number.isInteger(d);
		}
		var MOTION = {
			spring: {
				stiffness: 210,
				damping: 29,
				maxStep: .032,
				epsilon: 1e-4
			},
			layoutMs: 460,
			pickupMs: 280,
			appearMs: 220
		};
		var easeOutQuint = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 5;
		function lerpRect(a, b, t) {
			return {
				x: a.x + (b.x - a.x) * t,
				y: a.y + (b.y - a.y) * t,
				w: a.w + (b.w - a.w) * t,
				h: a.h + (b.h - a.h) * t
			};
		}
		var RectSpring = class {
			value;
			target;
			velocity = {
				x: 0,
				y: 0,
				w: 0,
				h: 0
			};
			constructor(initial) {
				this.value = { ...initial };
				this.target = { ...initial };
			}
			get moving() {
				return !sameRect2(this.value, this.target) || !isZero(this.velocity);
			}
			/** Returns true while still moving. */
			step(dt) {
				const { stiffness, damping, maxStep, epsilon } = MOTION.spring;
				dt = Math.min(dt || .016, maxStep);
				let error = 0;
				for (const key of [
					"x",
					"y",
					"w",
					"h"
				]) {
					this.velocity[key] += ((this.target[key] - this.value[key]) * stiffness - this.velocity[key] * damping) * dt;
					this.value[key] += this.velocity[key] * dt;
					error += Math.abs(this.target[key] - this.value[key]) + Math.abs(this.velocity[key]) * .1;
				}
				if (error <= epsilon) {
					this.finish();
					return false;
				}
				return true;
			}
			finish() {
				this.value = { ...this.target };
				this.velocity = {
					x: 0,
					y: 0,
					w: 0,
					h: 0
				};
			}
			jump(rect) {
				this.target = { ...rect };
				this.finish();
			}
		};
		function sameRect2(a, b, epsilon = 1e-9) {
			return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon && Math.abs(a.w - b.w) < epsilon && Math.abs(a.h - b.h) < epsilon;
		}
		function isZero(r) {
			return sameRect2(r, {
				x: 0,
				y: 0,
				w: 0,
				h: 0
			});
		}
		var LayoutTween = class {
			from = /* @__PURE__ */ new Map();
			start = 0;
			progress = 1;
			begin(from, now) {
				this.from = from;
				this.start = now;
				this.progress = from.size ? 0 : 1;
			}
			step(now, duration = MOTION.layoutMs) {
				const elapsed = duration > 0 ? (now - this.start) / duration : 1;
				this.progress = easeOutQuint(elapsed);
				if (elapsed >= 1) this.stop();
				return this.progress < 1;
			}
			stop() {
				this.progress = 1;
				this.from.clear();
			}
			get active() {
				return this.progress < 1;
			}
			apply(id, target) {
				const from = this.from.get(id);
				return from && this.progress < 1 ? lerpRect(from, target, this.progress) : target;
			}
		};
		function cubicBezier(x1, y1, x2, y2) {
			const sample = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
			return (x) => {
				if (x <= 0) return 0;
				if (x >= 1) return 1;
				let lo = 0;
				let hi = 1;
				let t = x;
				for (let i = 0; i < 24; i++) {
					const v = sample(x1, x2, t);
					if (Math.abs(v - x) < 1e-5) break;
					if (v < x) lo = t;
					else hi = t;
					t = (lo + hi) / 2;
				}
				return sample(y1, y2, t);
			};
		}
		var DOCK_EASE = cubicBezier(.2, .75, .2, 1);
		var DOCK_MS = {
			hide: 300,
			restore: 380
		};
		var MAX_HISTORY = 100;
		function createNavigator(host) {
			let entries = /* @__PURE__ */ new Map();
			let framed = null;
			let framedLeaves = [];
			let visits = [{
				id: "",
				leaves: []
			}];
			let visitIndex = 0;
			let session = null;
			let overviewReturn = null;
			let framings = [];
			let gesture = false;
			let suppressClickUntil = 0;
			let wheelTimer;
			const rootId = () => host.doc().root?.id ?? "";
			const on = () => !!host.mode();
			const free = () => host.mode() === "free";
			function sync() {
				entries = focusLayout(host.doc().root, host.layoutMetrics());
				if (framed && !entries.has(framed)) {
					const surviving = framedLeaves.filter((id) => entries.has(id));
					const next = surviving.length ? frameLeaves(host.doc().root, surviving) : null;
					framed = next && next !== rootId() ? next : null;
					framedLeaves = framed ? leafIds(entries.get(framed).node) : [];
				} else if (framed) framedLeaves = leafIds(entries.get(framed).node);
				if (session && !entries.has(session.id)) session = null;
				retarget();
			}
			function rectOf(id) {
				return id && entries.get(id)?.rect || UNIT;
			}
			function retarget() {
				const target = rectOf(framed);
				if (!sameRect2(host.camera.target, target)) {
					host.camera.target = { ...target };
					if (host.reduced()) host.camera.finish();
					host.schedule();
				}
				host.root.toggleAttribute("data-framed", !!framed);
			}
			function focus(id, record = true) {
				if (!on()) id = null;
				const doc = host.doc();
				if (id && doc.floating.some((f) => f.panel.id === id)) id = findStage(doc.root)?.id ?? null;
				if (id && !entries.has(id)) id = null;
				if (id) id = navNode(entries, id);
				if (id === rootId()) id = null;
				if (session && session.id !== id) session = null;
				if (record) {
					const visit = {
						id: id ?? rootId(),
						leaves: leafIds(id ? entries.get(id).node : doc.root)
					};
					({visits, index: visitIndex} = recordVisit(visits, visitIndex, visit));
					if (visits.length > MAX_HISTORY) {
						visits = visits.slice(-MAX_HISTORY);
						visitIndex = visits.length - 1;
					}
				}
				endGesture();
				const changed = framed !== id;
				framed = id;
				framedLeaves = id ? leafIds(entries.get(id).node) : [];
				retarget();
				if (changed) host.changed();
			}
			function endGesture() {
				host.lifetime.clearTimeout(wheelTimer);
				snapEl.removeAttribute("data-visible");
				if (gesture) {
					gesture = false;
					host.setGesture(false);
				}
			}
			function toggle(id) {
				if (!on()) return false;
				if (host.doc().floating.some((f) => f.panel.id === id)) return false;
				const node = entries.has(id) ? id : null;
				if (!node) return false;
				const next = maximizeTransition(entries, rootId(), framed ?? rootId(), navNode(entries, node), session);
				focus(next.destination);
				session = next.session;
				return true;
			}
			function stepOut() {
				if (!framed) return;
				focus(navParent(entries, framed) ?? null);
			}
			function stepIn(point) {
				const p = point ?? host.fromScreen({
					x: host.viewport().w / 2,
					y: host.viewport().h / 2
				});
				focus(hierarchyStep(entries, framed ?? rootId(), "in", p));
			}
			function historyGo(direction) {
				const next = visitIndex + direction;
				if (next < 0 || next >= visits.length) return;
				visitIndex = next;
				session = null;
				focus(savedFrameDestination(host.doc().root, visits[next].leaves) ?? findStage(host.doc().root)?.id ?? null, false);
			}
			function toggleOverview() {
				if (!framed && overviewReturn) {
					const leaves = overviewReturn;
					overviewReturn = null;
					focus(savedFrameDestination(host.doc().root, leaves));
				} else if (framed) {
					overviewReturn = [...framedLeaves];
					focus(null);
				}
			}
			function frame(target) {
				if (target === "all") return focus(null);
				if (target === "stage") return focus(findStage(host.doc().root)?.id ?? null);
				const ids = (Array.isArray(target) ? target : [target]).flatMap((id) => entries.has(id) ? leafIds(entries.get(id).node) : [panelOf(id)].filter((x) => !!x));
				if (!ids.length) return;
				focus(frameLeaves(host.doc().root, ids));
			}
			function panelOf(viewId) {
				const doc = host.doc();
				for (const id of leafIds(doc.root)) {
					const node = entries.get(id)?.node;
					if (node?.kind === "panel" && node.views.includes(viewId)) return id;
				}
				return null;
			}
			function ensureVisible(panelId) {
				if (!framed) return;
				const doc = host.doc();
				const node = entries.get(framed)?.node;
				if (!node) return;
				const float = doc.floating.find((f) => f.panel.id === panelId);
				if (float) {
					if (float.layer === "overlay") return;
					const stage = findStage(doc.root);
					if (stage && leafIds(node).includes(stage.id)) return;
					if (stage && (node.id === stage.id || contains(node, stage.id))) return;
					focus(stage?.id ?? null);
					return;
				}
				if (contains(node, panelId)) return;
				focus(frameLeaves(doc.root, [...framedLeaves, panelId]));
			}
			const contains = (node, id) => node.id === id || node.kind === "split" && node.children.some((c) => contains(c, id)) || node.kind === "stage" && !!node.child && contains(node.child, id);
			const bounds = () => host.root.getBoundingClientRect();
			function zoom(factor, clientX, clientY, panX = 0, panY = 0) {
				if (!entries.size) return;
				if (!gesture) {
					gesture = true;
					host.setGesture(true);
				}
				host.camera.velocity = {
					x: 0,
					y: 0,
					w: 0,
					h: 0
				};
				const b = bounds();
				const c = host.camera.value;
				const px = (clientX - b.left) / b.width;
				const py = (clientY - b.top) / b.height;
				const min = Math.min(...[...entries.values()].map((e) => Math.min(e.rect.w, e.rect.h))) * .65;
				factor = Math.max(min / Math.min(c.w, c.h), Math.min(factor, 1.35 / Math.max(c.w, c.h)));
				const next = {
					x: c.x + c.w * px * (1 - factor) - panX / b.width * c.w,
					y: c.y + c.h * py * (1 - factor) - panY / b.height * c.h,
					w: c.w * factor,
					h: c.h * factor
				};
				next.x = Math.max(-next.w * .3, Math.min(1 - next.w * .7, next.x));
				next.y = Math.max(-next.h * .3, Math.min(1 - next.h * .7, next.y));
				host.camera.jump(next);
				host.render();
				const candidate = entries.get(bestFit(host.camera.value, entries));
				if (candidate) {
					place2(snapEl, host.panelScreen(candidate.rect));
					snapEl.setAttribute("data-visible", "");
				}
			}
			function finishGesture() {
				if (!gesture) return;
				focus(bestFit(host.camera.value, entries));
			}
			let stepWheel = {
				last: -Infinity,
				total: 0,
				steppedAt: -Infinity,
				direction: 0
			};
			const resetStepWheel = () => stepWheel = {
				last: -Infinity,
				total: 0,
				steppedAt: -Infinity,
				direction: 0
			};
			function step(e) {
				e.preventDefault();
				if (host.busy() || drag) return;
				const now = performance.now();
				const raw = e.deltaY || e.deltaX;
				const direction = Math.sign(raw);
				if (!direction) return;
				if (now - stepWheel.last > 260 || direction !== stepWheel.direction) resetStepWheel();
				stepWheel.last = now;
				stepWheel.direction = direction;
				stepWheel.total += raw * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.viewport().h : 1);
				if (now - stepWheel.steppedAt >= 140 && Math.abs(stepWheel.total) >= 12) {
					stepWheel.steppedAt = now;
					const b = bounds();
					const point = host.fromScreen({
						x: e.clientX - b.left,
						y: e.clientY - b.top
					});
					const next = hierarchyStep(entries, framed ?? rootId(), stepWheel.total > 0 ? "out" : "in", point);
					stepWheel.total = 0;
					focus(next);
				}
			}
			host.lifetime.listen(host.root, "wheel", (e) => {
				if (!free()) return;
				const target = e.target;
				if (target.closest?.(".trellis-menu")) return;
				if (matchesChord(e, host.gestureKeys().step, held)) return step(e);
				const owner = host.gestureOwner(target);
				if (e.ctrlKey) {
					if (owner === "exclusive") return;
					if (isNotchedWheel(e)) return step(e);
					e.preventDefault();
					if (host.busy() || drag) return;
					const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.viewport().h : 1);
					zoom(Math.exp(Math.max(-.3, Math.min(.3, delta * .009))), e.clientX, e.clientY);
					host.lifetime.clearTimeout(wheelTimer);
					wheelTimer = host.lifetime.timeout(finishGesture, 180);
					return;
				}
				if (owner === "workspace" && !e.shiftKey && !e.altKey && !e.metaKey) step(e);
			}, { passive: false });
			const held = /* @__PURE__ */ new Set();
			let heldMode = null;
			function dragMode(e) {
				const keys = host.gestureKeys();
				for (const mode of [
					"scale",
					"rect",
					"pan"
				]) if (matchesChord(e, keys[mode], held)) return mode;
				return null;
			}
			function syncHeld(e) {
				const mode = e && free() && !host.busy() ? dragMode(e) : null;
				if (mode === heldMode) return;
				heldMode = mode;
				if (mode) host.root.setAttribute("data-gesture-key", mode);
				else host.root.removeAttribute("data-gesture-key");
			}
			host.lifetime.listen(window, "keydown", (e) => {
				if (e.key === "Escape" && drag) {
					e.preventDefault();
					e.stopPropagation();
					finishDrag(false);
					return;
				}
				held.add(e.code);
				syncHeld(e);
				if (heldMode && isChordKey(e)) {
					e.preventDefault();
					e.stopPropagation();
				}
			}, { capture: true });
			host.lifetime.listen(window, "keyup", (e) => {
				held.delete(e.code);
				if (e.key === "Meta") held.clear();
				resetStepWheel();
				syncHeld(e);
			}, { capture: true });
			const isChordKey = (e) => {
				const { pan, scale, rect } = host.gestureKeys();
				return [
					pan,
					scale,
					rect
				].flatMap(combosOf).some((combo) => parseChord(combo).keys.includes(e.code));
			};
			host.lifetime.listen(host.root, "contextmenu", (e) => {
				if (!drag && !heldMode) return;
				e.preventDefault();
				e.stopPropagation();
			}, { capture: true });
			host.lifetime.listen(window, "blur", () => {
				held.clear();
				syncHeld(null);
				resetStepWheel();
				finishDrag(true);
			});
			const snapEl = h$1("div", {
				"data-trellis-part": "snap-preview",
				"aria-hidden": "true"
			}, h$1("span", {}, "Release to focus"));
			host.root.append(snapEl);
			host.lifetime.add(() => snapEl.remove());
			const place2 = (el, r) => {
				el.style.transform = `translate(${r.x}px, ${r.y}px)`;
				el.style.width = `${Math.max(0, r.w)}px`;
				el.style.height = `${Math.max(0, r.h)}px`;
			};
			const marqueeEl = h$1("div", {
				"data-trellis-part": "marquee",
				"aria-hidden": "true"
			});
			const candidateEl = h$1("div", {
				"data-trellis-part": "marquee-target",
				"aria-hidden": "true"
			}, h$1("span"));
			host.root.append(marqueeEl, candidateEl);
			host.lifetime.add(() => {
				marqueeEl.remove();
				candidateEl.remove();
			});
			let drag = null;
			function moveRect(e) {
				const d = drag;
				const world = rectangleCamera({
					x: d.x,
					y: d.y
				}, {
					x: e.clientX,
					y: e.clientY
				}, d.viewport, d.view);
				const screen = host.toScreen(world);
				place2(marqueeEl, screen);
				d.candidate = screen.w >= 8 && screen.h >= 8 ? bestFit(world, entries) : null;
				candidateEl.toggleAttribute("data-visible", !!d.candidate);
				if (d.candidate) {
					const entry = entries.get(d.candidate);
					place2(candidateEl, host.panelScreen(entry.rect));
					candidateEl.querySelector("span").textContent = `Release to focus ${host.titleOf(entry.node)} \xB7 Esc to cancel`;
				}
			}
			function finishDrag(commit) {
				if (!drag) return;
				const { pointerId, mode, candidate } = drag;
				drag = null;
				suppressClickUntil = performance.now() + 350;
				host.root.removeAttribute("data-gesture");
				candidateEl.removeAttribute("data-visible");
				try {
					if (host.root.hasPointerCapture(pointerId)) host.root.releasePointerCapture(pointerId);
				} catch {}
				if (mode === "rect") focus(commit && candidate ? candidate : framed);
				else if (commit) finishGesture();
				else focus(framed);
			}
			host.lifetime.listen(host.root, "pointerdown", (e) => {
				if (!free() || host.busy() || drag || e.button !== 0 || e.pointerType === "touch") return;
				const mode = dragMode(e);
				if (!mode) return;
				e.preventDefault();
				e.stopPropagation();
				const r = bounds();
				drag = {
					mode,
					pointerId: e.pointerId,
					x: e.clientX,
					y: e.clientY,
					lastX: e.clientX,
					lastY: e.clientY,
					view: { ...host.camera.value },
					viewport: {
						x: r.left,
						y: r.top,
						w: r.width,
						h: r.height
					},
					candidate: null
				};
				host.root.setPointerCapture(e.pointerId);
				host.root.setAttribute("data-gesture", mode);
				if (mode === "rect") {
					endGesture();
					moveRect(e);
				} else zoom(1, e.clientX, e.clientY);
			}, { capture: true });
			host.lifetime.listen(host.root, "pointermove", (e) => {
				if (!drag || e.pointerId !== drag.pointerId) return;
				e.preventDefault();
				e.stopPropagation();
				const dx = e.clientX - drag.lastX;
				const dy = e.clientY - drag.lastY;
				drag.lastX = e.clientX;
				drag.lastY = e.clientY;
				if (drag.mode === "rect") moveRect(e);
				else if (drag.mode === "pan") zoom(1, e.clientX, e.clientY, dx, dy);
				else zoom(Math.exp((dy - dx) * .006), drag.x, drag.y);
			}, { capture: true });
			for (const type of [
				"pointerup",
				"pointercancel",
				"lostpointercapture"
			]) host.lifetime.listen(host.root, type, (e) => {
				if (drag?.pointerId !== e.pointerId) return;
				e.stopPropagation();
				finishDrag(true);
			}, { capture: true });
			for (const type of ["click", "dblclick"]) host.lifetime.listen(host.root, type, (e) => {
				if (performance.now() < suppressClickUntil) {
					e.preventDefault();
					e.stopPropagation();
				}
			}, { capture: true });
			const pointers = /* @__PURE__ */ new Map();
			let lastPinch = null;
			const pinchState = () => {
				const [a, b] = [...pointers.values()];
				return {
					distance: Math.hypot(a.x - b.x, a.y - b.y),
					x: (a.x + b.x) / 2,
					y: (a.y + b.y) / 2
				};
			};
			const ownsPinch = (e) => host.gestureOwner(e.target) === "exclusive";
			host.lifetime.listen(host.root, "pointerdown", (e) => {
				if (!free() || host.busy() || e.pointerType !== "touch" || ownsPinch(e)) return;
				pointers.set(e.pointerId, {
					x: e.clientX,
					y: e.clientY
				});
				if (pointers.size === 2) lastPinch = pinchState();
			});
			host.lifetime.listen(host.root, "pointermove", (e) => {
				if (!pointers.has(e.pointerId)) return;
				pointers.set(e.pointerId, {
					x: e.clientX,
					y: e.clientY
				});
				if (pointers.size === 2 && lastPinch) {
					const p = pinchState();
					zoom(lastPinch.distance / Math.max(1, p.distance), p.x, p.y, p.x - lastPinch.x, p.y - lastPinch.y);
					lastPinch = p;
				}
			});
			for (const type of ["pointerup", "pointercancel"]) host.lifetime.listen(host.root, type, (e) => {
				pointers.delete(e.pointerId);
				if (pointers.size < 2 && lastPinch) {
					lastPinch = null;
					finishGesture();
				}
			});
			let safariScale = 1;
			let safariPinch = false;
			host.lifetime.listen(host.root, "gesturestart", (e) => {
				safariPinch = free() && !ownsPinch(e);
				if (!safariPinch) return;
				e.preventDefault();
				safariScale = 1;
			});
			host.lifetime.listen(host.root, "gesturechange", (e) => {
				if (!safariPinch) return;
				e.preventDefault();
				const g = e;
				zoom(safariScale / g.scale, g.clientX, g.clientY);
				safariScale = g.scale;
			});
			host.lifetime.listen(host.root, "gestureend", (e) => {
				if (!safariPinch) return;
				safariPinch = false;
				e.preventDefault();
				finishGesture();
			});
			function serialize() {
				return {
					...framed ? { frame: [...framedLeaves] } : {},
					...framings.length ? { framings } : {}
				};
			}
			function restore(nav) {
				framings = nav?.framings ?? [];
				const leaves = nav?.frame ?? [];
				const destination = leaves.length ? savedFrameDestination(host.doc().root, leaves) : null;
				visits = [{
					id: rootId(),
					leaves: leafIds(host.doc().root)
				}];
				visitIndex = 0;
				session = null;
				overviewReturn = null;
				framed = null;
				framedLeaves = [];
				if (destination && on()) focus(destination);
				else retarget();
			}
			return {
				sync,
				focus,
				toggle,
				stepOut,
				stepIn,
				back: () => historyGo(-1),
				forward: () => historyGo(1),
				overview: () => {
					if (framed) overviewReturn = [...framedLeaves];
					focus(null);
				},
				toggleOverview,
				frame,
				ensureVisible,
				/** Widen the framing to include these nodes (after a move). */
				include(ids) {
					if (!framed) return;
					focus(frameLeaves(host.doc().root, [...framedLeaves.filter((id) => entries.has(id)), ...ids]));
				},
				serialize,
				restore,
				cancelGestures() {
					finishDrag(true);
					endGesture();
				},
				get entries() {
					return entries;
				},
				get framed() {
					return framed;
				},
				get framedNode() {
					return framed ? entries.get(framed)?.node ?? null : null;
				},
				get gesture() {
					return gesture;
				},
				get canGoBack() {
					return visitIndex > 0;
				},
				get canGoForward() {
					return visitIndex < visits.length - 1;
				},
				get suppressClicks() {
					return performance.now() < suppressClickUntil;
				},
				framings: {
					save(name) {
						if (!name.trim()) return null;
						const framing = {
							id: uid("framing"),
							name: name.trim(),
							frame: framed ? [...framedLeaves] : leafIds(host.doc().root)
						};
						framings = [...framings, framing];
						host.changed();
						return framing;
					},
					go(id) {
						const framing = framings.find((f) => f.id === id);
						if (!framing) return;
						focus(savedFrameDestination(host.doc().root, framing.frame));
					},
					remove(id) {
						framings = framings.filter((f) => f.id !== id);
						host.changed();
					},
					list: () => framings
				}
			};
		}
		var Lifetime = class {
			controller = new AbortController();
			frames = /* @__PURE__ */ new Set();
			timers = /* @__PURE__ */ new Set();
			cleanups = [];
			get signal() {
				return this.controller.signal;
			}
			get disposed() {
				return this.controller.signal.aborted;
			}
			listen(target, type, handler, options = {}) {
				target.addEventListener(type, handler, {
					...options,
					signal: this.signal
				});
			}
			frame(callback) {
				if (this.disposed) return 0;
				const id = requestAnimationFrame((time) => {
					this.frames.delete(id);
					callback(time);
				});
				this.frames.add(id);
				return id;
			}
			cancelFrame(id) {
				if (!id) return;
				cancelAnimationFrame(id);
				this.frames.delete(id);
			}
			timeout(callback, ms) {
				if (this.disposed) return void 0;
				const id = setTimeout(() => {
					this.timers.delete(id);
					callback();
				}, ms);
				this.timers.add(id);
				return id;
			}
			clearTimeout(id) {
				if (id === void 0) return;
				clearTimeout(id);
				this.timers.delete(id);
			}
			add(cleanup) {
				this.cleanups.push(cleanup);
			}
			dispose() {
				if (this.disposed) return;
				this.controller.abort();
				for (const id of this.frames) cancelAnimationFrame(id);
				for (const id of this.timers) clearTimeout(id);
				this.frames.clear();
				this.timers.clear();
				for (const cleanup of this.cleanups.splice(0).reverse()) try {
					cleanup();
				} catch (error) {
					console.error(error);
				}
			}
		};
		var Emitter = class {
			handlers = /* @__PURE__ */ new Map();
			on(event, handler) {
				let set = this.handlers.get(event);
				if (!set) this.handlers.set(event, set = /* @__PURE__ */ new Set());
				set.add(handler);
				return () => set.delete(handler);
			}
			emit(event, ...args) {
				const set = this.handlers.get(event);
				if (!set) return void 0;
				let result;
				for (const handler of [...set]) try {
					const value = handler(...args);
					if (value !== void 0) result = value;
				} catch (error) {
					console.error(error);
				}
				return result;
			}
			has(event) {
				return !!this.handlers.get(event)?.size;
			}
			clear() {
				this.handlers.clear();
			}
		};
		function tidyMenu(entries) {
			const out = [];
			for (const entry of entries) {
				if (entry === "separator" && (!out.length || out[out.length - 1] === "separator")) continue;
				out.push(entry);
			}
			while (out[out.length - 1] === "separator") out.pop();
			return out;
		}
		var Menu = class _Menu {
			constructor(host, onClose = () => {}) {
				this.host = host;
				this.onClose = onClose;
			}
			host;
			onClose;
			el = null;
			submenu = null;
			restoreFocus = null;
			get open() {
				return !!this.el;
			}
			show(entries, anchor, focusFirst = true) {
				this.close(false);
				this.restoreFocus = document.activeElement;
				const el = h$1("div", {
					class: "trellis-menu",
					role: "menu",
					"data-trellis-part": "menu"
				});
				entries = tidyMenu(entries);
				for (const entry of entries) {
					if (entry === "separator") {
						el.append(h$1("div", {
							class: "trellis-menu-separator",
							role: "separator"
						}));
						continue;
					}
					el.append(this.item(entry));
				}
				this.host.append(el);
				this.el = el;
				const bounds = this.host.getBoundingClientRect();
				const width = el.offsetWidth;
				const height = el.offsetHeight;
				let x = anchor.alignRight ? anchor.x - width : anchor.x;
				let y = anchor.y;
				x = Math.max(4, Math.min(bounds.width - width - 4, x));
				if (y + height > bounds.height - 4) y = Math.max(4, bounds.height - height - 4);
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.addEventListener("keydown", (e) => this.keydown(e));
				const outside = (e) => {
					if (!this.el) return document.removeEventListener("pointerdown", outside, true);
					if (!(e.target instanceof Node) || !this.contains(e.target)) this.close();
				};
				document.addEventListener("pointerdown", outside, true);
				const cleanup = () => document.removeEventListener("pointerdown", outside, true);
				el.__cleanup = cleanup;
				if (focusFirst) this.items()[0]?.focus();
				else el.focus();
			}
			contains(node) {
				return !!this.el?.contains(node) || !!this.submenu?.contains(node);
			}
			items() {
				return [...this.el?.querySelectorAll(":scope > [role=menuitem]:not([aria-disabled=true]), :scope > [role=menuitemcheckbox]:not([aria-disabled=true])") ?? []];
			}
			item(entry) {
				const role = entry.checked !== void 0 ? "menuitemcheckbox" : "menuitem";
				const button = h$1("button", {
					class: `trellis-menu-item${entry.danger ? " trellis-danger" : ""}`,
					role,
					tabindex: "-1",
					"aria-disabled": entry.disabled ? "true" : void 0,
					"aria-checked": entry.checked === void 0 ? void 0 : String(entry.checked),
					"aria-haspopup": entry.items ? "menu" : void 0
				});
				const check = h$1("span", { class: "trellis-menu-check" });
				if (entry.checked) check.innerHTML = icons.check;
				button.append(check, h$1("span", { class: "trellis-menu-label" }, entry.label));
				if (entry.shortcut) button.append(h$1("span", { class: "trellis-menu-shortcut" }, entry.shortcut));
				if (entry.items) {
					const chevron = h$1("span", { class: "trellis-menu-chevron" });
					chevron.innerHTML = icons.chevron;
					button.append(chevron);
				}
				const openSub = () => {
					if (!entry.items || entry.disabled) return;
					this.submenu?.close(false);
					this.submenu = new _Menu(this.host);
					const r = button.getBoundingClientRect();
					const b = this.host.getBoundingClientRect();
					this.submenu.show(entry.items, {
						x: r.right - b.left - 4,
						y: r.top - b.top - 5
					});
					this.submenu.parent = this;
				};
				button.addEventListener("pointerenter", () => {
					if (entry.items) openSub();
					else if (this.submenu) {
						this.submenu.close(false);
						this.submenu = null;
					}
				});
				button.addEventListener("click", (e) => {
					e.stopPropagation();
					if (entry.disabled) return;
					if (entry.items) return openSub();
					this.root().close();
					entry.run?.();
				});
				return button;
			}
			parent = null;
			root() {
				let menu = this;
				while (menu.parent) menu = menu.parent;
				return menu;
			}
			keydown(e) {
				const items = this.items();
				const index = items.indexOf(document.activeElement);
				const move = (to) => {
					e.preventDefault();
					items[(to + items.length) % items.length]?.focus();
				};
				switch (e.key) {
					case "ArrowDown": return move(index + 1);
					case "ArrowUp": return move(index - 1);
					case "Home": return move(0);
					case "End": return move(items.length - 1);
					case "ArrowRight":
						if (items[index]?.getAttribute("aria-haspopup")) {
							e.preventDefault();
							items[index].click();
						}
						return;
					case "ArrowLeft":
					case "Escape":
						e.preventDefault();
						e.stopPropagation();
						if (this.parent) {
							const parent = this.parent;
							this.close(false);
							parent.submenu = null;
							parent.el?.querySelector("[aria-haspopup]")?.focus();
						} else this.close();
						return;
					case "Tab":
						e.preventDefault();
						this.root().close();
						return;
				}
			}
			close(restore = true) {
				this.submenu?.close(false);
				this.submenu = null;
				if (!this.el) return;
				this.el.__cleanup?.();
				this.el.remove();
				this.el = null;
				if (restore && this.restoreFocus?.isConnected) this.restoreFocus.focus();
				if (!this.parent) this.onClose();
			}
		};
		var ViewController = class {
			constructor(id, type, host, initial) {
				this.id = id;
				this.type = type;
				this.host = host;
				this.state = initial;
			}
			id;
			type;
			host;
			events = new Emitter();
			guards = /* @__PURE__ */ new Set();
			listeners = /* @__PURE__ */ new Set();
			state;
			get params() {
				return this.state.params;
			}
			get workspace() {
				return this.host.workspace;
			}
			get panelId() {
				return this.state.panelId;
			}
			get visible() {
				return this.state.visible;
			}
			get focused() {
				return this.state.focused;
			}
			get selected() {
				return this.state.selected;
			}
			get placement() {
				return this.state.placement;
			}
			get interactive() {
				return this.state.interactive;
			}
			get size() {
				return this.state.size;
			}
			get scale() {
				return this.state.scale;
			}
			get title() {
				return this.state.title;
			}
			get badge() {
				return this.state.badge;
			}
			setTitle(title) {
				this.host.setTitle(this.id, title);
			}
			setParams(patch) {
				this.host.setParams(this.id, patch);
			}
			get element() {
				return this.host.element(this.id);
			}
			setBadge(badge) {
				this.host.setBadge(this.id, badge);
			}
			focus() {
				this.host.focus(this.id);
			}
			close(options) {
				return this.host.close(this.id, options);
			}
			hide() {
				this.host.hide(this.id);
			}
			guardClose(guard) {
				this.guards.add(guard);
				return () => this.guards.delete(guard);
			}
			on(event, handler) {
				return this.events.on(event, handler);
			}
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			getState = () => this.state;
			/** Apply new presentation state; notify only what changed. */
			update(patch) {
				const prev = this.state;
				let changed = false;
				for (const key of Object.keys(patch)) {
					const value = patch[key];
					const old = prev[key];
					if (key === "size") {
						const a = old;
						const b = value;
						if (a.width === b.width && a.height === b.height) continue;
					} else if (old === value) continue;
					changed = true;
					break;
				}
				if (!changed) return;
				const next = {
					...prev,
					...patch
				};
				this.state = next;
				if (next.size.width !== prev.size.width || next.size.height !== prev.size.height) this.events.emit("resize", next.size);
				if (next.visible !== prev.visible) this.events.emit("visibility", next.visible);
				if (next.focused !== prev.focused) this.events.emit("focus", next.focused);
				if (next.interactive !== prev.interactive) this.events.emit("interactive", next.interactive);
				if (next.scale !== prev.scale) this.events.emit("scale", next.scale);
				this.events.emit("change", next);
				for (const listener of [...this.listeners]) listener();
			}
			/** Run close guards. Any false vetoes. */
			async canClose() {
				for (const guard of [...this.guards]) try {
					if (await guard() === false) return false;
				} catch (error) {
					console.error(error);
					return false;
				}
				return true;
			}
			dispose() {
				this.events.clear();
				this.listeners.clear();
				this.guards.clear();
			}
		};
		var TYPE_PLACEHOLDER = (type) => ({
			title: type,
			mount(el) {
				el.append(h$1("div", { class: "trellis-placeholder" }, h$1("strong", {}, "Unavailable"), h$1("span", {}, `No view type named \u201C${type}\u201D is registered.`)));
			}
		});
		var escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		})[c]);
		var DEFAULT_FLOAT_SIZE = {
			w: 560,
			h: 400
		};
		var FRAME_ONLY = {
			w: 160,
			h: 64
		};
		var PANEL_MIN = { w: 80 };
		var DETAIL = {
			size: 48,
			outline: 2
		};
		function createWorkspace(host, initialOptions) {
			let options = { ...initialOptions };
			const lifetime = new Lifetime();
			const events = new Emitter();
			const listeners = /* @__PURE__ */ new Set();
			const root = h$1("div", {
				class: "trellis",
				"data-trellis-root": "",
				role: "region",
				"aria-label": options.label ?? "Workspace",
				tabindex: "-1"
			});
			const backdrop = h$1("div", { "data-trellis-part": "backdrop" });
			const stageEmpty = h$1("div", { "data-trellis-part": "stage-empty" });
			const empty = h$1("div", { "data-trellis-part": "empty" });
			const layer = h$1("div", { class: "trellis-layer" });
			const dividers = h$1("div", { class: "trellis-dividers" });
			const sourceSlot = h$1("div", {
				"data-trellis-part": "source-slot",
				"aria-hidden": "true"
			});
			const dropLabel = h$1("span", { "data-trellis-part": "drop-label" });
			const dropSlot = h$1("div", {
				"data-trellis-part": "drop-slot",
				"aria-hidden": "true"
			}, dropLabel);
			const chrome = h$1("div", { "data-trellis-part": "chrome" });
			const live = h$1("div", {
				class: "trellis-sr",
				"aria-live": "polite"
			});
			root.append(backdrop, stageEmpty, empty, layer, dividers, sourceSlot, dropSlot, chrome, live);
			host.append(root);
			lifetime.add(() => root.remove());
			const slots = {
				backdrop,
				stageEmpty,
				empty,
				chrome
			};
			let menuCloseHook = null;
			const menu = new Menu(root, () => {
				menuCloseHook?.();
				menuCloseHook = null;
			});
			lifetime.add(() => menu.close(false));
			let doc = emptyDocument();
			let entries = /* @__PURE__ */ new Map();
			let focusedPanel = null;
			let focusedView = null;
			let lastStagePanel = null;
			const badges = /* @__PURE__ */ new Map();
			const panelDoms = /* @__PURE__ */ new Map();
			const records = /* @__PURE__ */ new Map();
			const dividerEls = /* @__PURE__ */ new Map();
			const lastRects = /* @__PURE__ */ new Map();
			const leaving = /* @__PURE__ */ new Map();
			const entering = /* @__PURE__ */ new Map();
			const settling = /* @__PURE__ */ new Set();
			let surfacesList = [];
			let viewport = {
				w: host.clientWidth,
				h: host.clientHeight
			};
			let gap = 6;
			let tabbarHeight = 34;
			const tween = new LayoutTween();
			const camera = new RectSpring(UNIT);
			let nav;
			let dragger;
			const lifted = () => dragger?.session?.active ? dragger.session.lifted : null;
			const dragActive = () => !!dragger?.active;
			let gesture = false;
			let zooming = false;
			let frame = 0;
			let lastTime = 0;
			let snapshot = null;
			let persistTimer;
			let openCounter = 0;
			const reducedQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
			const reduced = () => options.motion === "reduced" || options.motion !== "full" && !!reducedQuery?.matches;
			const floatingLayer = () => options.floating === void 0 ? "overlay" : options.floating;
			const navigationMode = () => options.navigation === void 0 ? "focus" : options.navigation;
			const placeholders = /* @__PURE__ */ new Map();
			function typeOf(viewId) {
				const type = doc.views[viewId]?.type ?? "unknown";
				const def = options.types[type];
				if (def) return def;
				let placeholder = placeholders.get(type);
				if (!placeholder) placeholders.set(type, placeholder = TYPE_PLACEHOLDER(type));
				return placeholder;
			}
			function titleOf(viewId) {
				const record = doc.views[viewId];
				if (!record) return "";
				if (record.title) return record.title;
				const title = options.types[record.type]?.title;
				if (typeof title === "function") {
					const controller = records.get(viewId)?.controller;
					if (controller) try {
						return title(controller);
					} catch (error) {
						console.error(error);
					}
				} else if (title) return title;
				return record.type;
			}
			let appliedTokens = /* @__PURE__ */ new Set();
			function applyTheme() {
				setAttr(root, "data-theme", options.theme ?? "system");
				const tabs = options.tabs ?? {};
				setAttr(root, "data-tab-fill", tabs.fill ? "" : null);
				setAttr(root, "data-tab-bleed", tabs.inset === 0 ? "" : null);
				if (tabs.inset !== void 0) root.style.setProperty("--trellis-tab-inset", `${tabs.inset}px`);
				else if (!options.tokens?.["--trellis-tab-inset"]) root.style.removeProperty("--trellis-tab-inset");
				setAttr(root, "aria-label", options.label ?? "Workspace");
				const tokens = options.tokens ?? {};
				for (const key of appliedTokens) if (!(key in tokens)) root.style.removeProperty(key);
				for (const [key, value] of Object.entries(tokens)) if (value === "" || value == null) root.style.removeProperty(key);
				else root.style.setProperty(key, value);
				appliedTokens = new Set(Object.keys(tokens));
				setAttr(root, "data-navigation", String(navigationMode()));
				readMetrics();
			}
			function readMetrics() {
				const style = getComputedStyle(root);
				const g = parseFloat(style.getPropertyValue("--trellis-gap"));
				const t = parseFloat(style.getPropertyValue("--trellis-tabbar-height"));
				if (Number.isFinite(g)) gap = g;
				if (Number.isFinite(t)) tabbarHeight = t;
			}
			const pad = () => gap / 2;
			function toScreen(r) {
				const c = camera.value;
				const p = pad();
				const W = viewport.w - p * 2;
				const H = viewport.h - p * 2;
				return {
					x: p + (r.x - c.x) / c.w * W,
					y: p + (r.y - c.y) / c.h * H,
					w: r.w / c.w * W,
					h: r.h / c.h * H
				};
			}
			function fromScreen(p) {
				const c = camera.value;
				const q = pad();
				return {
					x: c.x + (p.x - q) / (viewport.w - q * 2) * c.w,
					y: c.y + (p.y - q) / (viewport.h - q * 2) * c.h
				};
			}
			const inset = (r, d) => ({
				x: r.x + d,
				y: r.y + d,
				w: Math.max(0, r.w - d * 2),
				h: Math.max(0, r.h - d * 2)
			});
			function stageWorld() {
				const stage = findStage(doc.root);
				return stage && entries.get(stage.id)?.rect || UNIT;
			}
			function stageScreen() {
				const stage = findStage(doc.root);
				if (!stage) return null;
				const e = entries.get(stage.id);
				return e ? inset(toScreen(e.rect), pad()) : null;
			}
			function floatContainer(layerName) {
				if (layerName === "overlay") return {
					x: 0,
					y: 0,
					w: viewport.w,
					h: viewport.h
				};
				return toScreen(stageWorld());
			}
			function floatScreen(rect, layerName) {
				const c = floatContainer(layerName);
				return {
					x: c.x + rect.x * c.w,
					y: c.y + rect.y * c.h,
					w: rect.w * c.w,
					h: rect.h * c.h
				};
			}
			function screenToFloat(r, layerName) {
				const c = floatContainer(layerName);
				return {
					x: (r.x - c.x) / c.w,
					y: (r.y - c.y) / c.h,
					w: r.w / c.w,
					h: r.h / c.h
				};
			}
			function targetRect(panelId) {
				if (lifted()?.id === panelId) return dragger.liftedRect();
				const preview = dragger?.layoutTargets()?.get(panelId);
				if (preview && !doc.floating.some((f) => f.panel.id === panelId)) return inset(toScreen(preview), pad());
				const float2 = doc.floating.find((f) => f.panel.id === panelId);
				if (float2) return floatScreen(float2.rect, float2.layer);
				const e = entries.get(panelId);
				return e ? inset(toScreen(e.rect), pad()) : null;
			}
			function restRect(panelId) {
				const value = camera.value;
				camera.value = camera.target;
				try {
					return targetRect(panelId);
				} finally {
					camera.value = value;
				}
			}
			function regionOf(panelId) {
				if (doc.floating.some((f) => f.panel.id === panelId)) return "floating";
				const stage = findStage(doc.root);
				if (stage && findNode(stage, panelId)) return "stage";
				return "side";
			}
			function viewState(viewId) {
				return {
					visible: false,
					focused: false,
					selected: false,
					placement: "docked",
					interactive: true,
					size: {
						width: 0,
						height: 0
					},
					scale: 1,
					title: titleOf(viewId),
					badge: badges.get(viewId) ?? null,
					panelId: panelOfView(doc, viewId)?.id ?? "",
					params: doc.views[viewId]?.params ?? {}
				};
			}
			const viewHost = {
				get workspace() {
					return handle;
				},
				params: (id) => doc.views[id]?.params ?? {},
				setTitle: (id, title) => setTitle(id, title),
				setParams: (id, patch) => setParams(id, patch),
				element: (id) => records.get(id).content,
				setBadge: (id, badge) => {
					badges.set(id, badge);
					records.get(id)?.controller.update({ badge });
					updateTabs();
				},
				focus: (id) => handle.focus(id),
				close: (id, o) => close(id, o),
				hide: (id) => hide(id)
			};
			function ensureSurface(viewId) {
				let record = records.get(viewId);
				if (record) return record;
				const type = doc.views[viewId].type;
				const shell = h$1("div", {
					"data-trellis-part": "surface",
					"data-view": viewId,
					"data-type": type,
					role: "tabpanel",
					id: `${uidBase}-surface-${cssId(viewId)}`
				});
				const content = h$1("div", {
					"data-trellis-part": "content",
					"data-trellis-content": viewId
				});
				shell.append(content);
				const icon = h$1("span", { "data-trellis-part": "tab-icon" });
				const accessory = h$1("div", {
					"data-trellis-part": "accessory",
					"data-view": viewId
				});
				layer.append(shell);
				const controller = new ViewController(viewId, type, viewHost, viewState(viewId));
				record = {
					controller,
					shell,
					content,
					icon,
					accessory,
					cleanup: null,
					mountedWith: null,
					mountKey: null,
					iconHtml: null,
					surface: {
						view: controller,
						content,
						icon,
						accessory
					}
				};
				records.set(viewId, record);
				controller.update({ title: titleOf(viewId) });
				lifetime.listen(shell, "pointerdown", () => focusView(viewId, false), { capture: true });
				lifetime.listen(shell, "focusin", () => focusView(viewId, false));
				mountContent(record);
				return record;
			}
			function mountContent(record) {
				const def = typeOf(record.controller.id);
				record.mountedWith = def;
				setAttr(record.shell, "class", def.className ?? null);
				const raw = def.iframe ? typeof def.iframe === "function" ? def.iframe(record.controller) : def.iframe : null;
				const frame2 = raw === null ? null : typeof raw === "string" ? { src: raw } : raw;
				const key = frame2 ? `iframe:${JSON.stringify(frame2)}` : def.mount ?? null;
				if (key !== record.mountKey) {
					if (record.mountKey !== null) {
						try {
							record.cleanup?.();
						} catch (error) {
							console.error(error);
						}
						record.cleanup = null;
						record.content.replaceChildren();
					}
					record.mountKey = key;
					if (frame2) {
						const frameEl = h$1("iframe", {
							src: frame2.src,
							srcdoc: frame2.srcdoc,
							sandbox: frame2.sandbox,
							allow: frame2.allow,
							referrerpolicy: frame2.referrerPolicy,
							title: frame2.title ?? titleOf(record.controller.id),
							"data-trellis-iframe": ""
						});
						record.content.append(frameEl);
						record.cleanup = () => frameEl.remove();
					} else if (def.mount) try {
						const cleanup = def.mount(record.content, record.controller, {
							icon: record.icon,
							accessory: record.accessory
						});
						record.cleanup = typeof cleanup === "function" ? cleanup : null;
					} catch (error) {
						console.error(error);
					}
				}
				const icon = def.icon ?? null;
				if (icon !== record.iconHtml) {
					if (icon !== null || record.iconHtml !== null) record.icon.innerHTML = icon ?? "";
					record.iconHtml = icon;
				}
			}
			function destroySurface(viewId) {
				const record = records.get(viewId);
				if (!record) return;
				try {
					record.cleanup?.();
				} catch (error) {
					console.error(error);
				}
				record.shell.remove();
				record.icon.remove();
				record.accessory.remove();
				record.controller.dispose();
				records.delete(viewId);
				badges.delete(viewId);
			}
			const uidBase = uid("trellis");
			const cssId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, "_");
			function ensurePanelDom(panelId) {
				let dom = panelDoms.get(panelId);
				if (dom) return dom;
				const el = h$1("div", {
					"data-trellis-part": "panel",
					"data-panel": panelId
				});
				const tablist = h$1("div", {
					"data-trellis-part": "tabs",
					role: "tablist",
					"aria-orientation": "horizontal"
				});
				const accessories = h$1("div", { "data-trellis-part": "accessories" });
				const menuButton = h$1("button", {
					"data-trellis-part": "panel-menu",
					type: "button",
					"aria-label": "Panel menu",
					"aria-haspopup": "menu",
					tabindex: "-1"
				});
				menuButton.innerHTML = icons.more;
				const tabbar = h$1("div", {
					"data-trellis-part": "tabbar",
					"data-panel": panelId
				}, tablist, accessories, menuButton);
				el.append(tabbar);
				layer.append(el);
				const frameIcon = h$1("span", {
					"data-trellis-part": "frame-icon",
					"aria-hidden": "true"
				});
				el.append(frameIcon);
				dom = {
					id: panelId,
					el,
					tabbar,
					tablist,
					accessories,
					menuButton,
					tabs: /* @__PURE__ */ new Map(),
					handles: null,
					frameIcon,
					endInset: 0
				};
				panelDoms.set(panelId, dom);
				const d = dom;
				const onPointerDown = (e) => {
					const panel = findPanel(d.id);
					if (panel) focusView(panel.selected, false);
					if (doc.floating.some((f) => f.panel.id === d.id)) {
						const raised = raiseFloat(doc, d.id);
						if (raised !== doc) commit(raised, {
							animate: false,
							silent: true
						});
					}
					if (e.button !== 0) return;
					const target = e.target;
					if (target.closest("button, [data-trellis-part=accessory], [data-trellis-part=resize]")) {
						if (!target.closest("[data-trellis-part=tab]")) return;
					}
					const tab = target.closest("[data-trellis-part=tab]");
					if (tab && target.closest("[data-trellis-part=tab-close]")) return;
					if (!panel) return;
					if (tab) dragger.begin(e, panel, tab.dataset.view);
					else if (target.closest("[data-trellis-part=tabbar]") || d.el.hasAttribute("data-frame-only")) dragger.begin(e, panel, null);
				};
				lifetime.listen(el, "pointerdown", onPointerDown);
				lifetime.listen(tabbar, "pointerdown", (e) => {
					if (tabbar.parentElement !== el) onPointerDown(e);
				});
				lifetime.listen(tabbar, "dblclick", (e) => {
					if (e.target.closest("button:not([data-trellis-part=tab]), [data-trellis-part=accessory]")) return;
					if (navigationMode()) toggleFrame(d.id);
				});
				lifetime.listen(el, "dblclick", () => {
					if (el.hasAttribute("data-frame-only") && navigationMode()) toggleFrame(d.id);
				});
				lifetime.listen(menuButton, "click", (e) => {
					e.stopPropagation();
					openPanelMenu(d.id, menuButton);
				});
				lifetime.listen(tabbar, "contextmenu", (e) => {
					const target = e.target;
					if (target.closest("[data-trellis-part=accessory]")) return;
					e.preventDefault();
					const tab = target.closest("[data-trellis-part=tab]");
					if (tab) selectAndFocus(tab.dataset.view);
					const b = root.getBoundingClientRect();
					openPanelMenu(d.id, null, {
						x: e.clientX - b.left,
						y: e.clientY - b.top
					});
				});
				lifetime.listen(tablist, "keydown", (e) => tabKeydown(e, d.id));
				lifetime.listen(tablist, "wheel", (e) => {
					if (e.ctrlKey || e.metaKey || tablist.scrollWidth <= tablist.clientWidth) return;
					if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
						tablist.scrollLeft += e.deltaY;
						e.preventDefault();
						e.stopPropagation();
					}
				}, { passive: false });
				return dom;
			}
			function destroyPanelDom(panelId) {
				const dom = panelDoms.get(panelId);
				if (!dom) return;
				dom.el.remove();
				dom.tabbar.remove();
				dom.handles?.remove();
				panelDoms.delete(panelId);
				lastRects.delete(panelId);
			}
			function barMode(panel) {
				if (!panel) return "normal";
				const modes = panel.views.map((v) => typeOf(v).tabbar ?? "always");
				if (modes.every((m) => m === "never")) return "hidden";
				if (panel.views.length === 1 && modes[0] === "auto") return lifted()?.id === panel.id ? "normal" : "hidden";
				if (panel.views.length === 1 && modes[0] === "overlay") return "overlay";
				return "normal";
			}
			function barHeight(panel) {
				return barMode(panel) === "normal" ? tabbarHeight : 0;
			}
			function findPanel(panelId) {
				if (lifted()?.id === panelId) return lifted();
				return locatePanel(doc, panelId)?.panel ?? leaving.get(panelId)?.panel ?? null;
			}
			function syncTabs(panel) {
				const dom = ensurePanelDom(panel.id);
				const wanted = new Set(panel.views);
				for (const [viewId, tab] of dom.tabs) if (!wanted.has(viewId)) {
					tab.el.remove();
					dom.tabs.delete(viewId);
				}
				panel.views.forEach((viewId, index) => {
					let tab = dom.tabs.get(viewId);
					const record = ensureSurface(viewId);
					if (!tab) {
						const title = h$1("span", { "data-trellis-part": "tab-title" });
						const badge = h$1("span", { "data-trellis-part": "tab-badge" });
						const closeButton = h$1("span", {
							"data-trellis-part": "tab-close",
							"aria-hidden": "true"
						});
						closeButton.innerHTML = icons.close;
						const el = h$1("div", {
							"data-trellis-part": "tab",
							"data-view": viewId,
							role: "tab",
							id: `${uidBase}-tab-${cssId(viewId)}`,
							"aria-controls": record.shell.id
						});
						el.append(record.icon, title, badge, closeButton);
						lifetime.listen(closeButton, "click", (e) => {
							e.stopPropagation();
							close(viewId);
						});
						lifetime.listen(el, "click", (e) => {
							if (e.target.closest("[data-trellis-part=tab-close]")) return;
							selectAndFocus(viewId);
						});
						lifetime.listen(el, "auxclick", (e) => {
							if (e.button === 1 && typeOf(viewId).closable !== false) close(viewId);
						});
						tab = {
							el,
							title,
							badge,
							close: closeButton
						};
						dom.tabs.set(viewId, tab);
					} else if (tab.el.firstChild !== record.icon) tab.el.prepend(record.icon);
					if (dom.tablist.children[index] !== tab.el) dom.tablist.insertBefore(tab.el, dom.tablist.children[index] ?? null);
					if (record.accessory.parentElement !== dom.accessories) dom.accessories.append(record.accessory);
					setAttr(record.shell, "aria-labelledby", tab.el.id);
				});
			}
			function revealTab(list, tab) {
				if (list.scrollWidth <= list.clientWidth) return;
				const left = tab.offsetLeft - list.offsetLeft;
				if (left < list.scrollLeft) list.scrollLeft = left - 8;
				else if (left + tab.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = left + tab.offsetWidth - list.clientWidth + 8;
			}
			function updateTabs() {
				for (const [panelId, dom] of panelDoms) {
					const panel = findPanel(panelId);
					if (!panel) continue;
					for (const [viewId, tab] of dom.tabs) {
						const selected = panel.selected === viewId;
						const title = titleOf(viewId);
						if (tab.title.textContent !== title) tab.title.textContent = title;
						const badge = badges.get(viewId);
						const dot = badge === true;
						const text = badge === null || badge === void 0 || badge === "" || typeof badge === "boolean" ? "" : String(badge);
						if (tab.badge.textContent !== text) tab.badge.textContent = text;
						setAttr(tab.badge, "hidden", text || dot ? null : "");
						setAttr(tab.badge, "data-dot", dot ? "" : null);
						setAttr(tab.el, "data-badge", dot ? "dot" : text ? "" : null);
						setAttr(tab.el, "data-type", doc.views[viewId]?.type ?? null);
						setAttr(tab.el, "aria-selected", String(selected));
						setAttr(tab.el, "tabindex", selected ? "0" : "-1");
						if (selected && !tab.el.hasAttribute("data-selected")) revealTab(dom.tablist, tab.el);
						setAttr(tab.el, "data-selected", selected ? "" : null);
						setAttr(tab.el, "data-focused", focusedView === viewId ? "" : null);
						const closable = typeOf(viewId).closable !== false;
						setAttr(tab.close, "hidden", closable ? null : "");
						setAttr(tab.close, "title", `Close ${title}`);
						setAttr(tab.el, "aria-keyshortcuts", closable ? "Delete Shift+F10" : "Shift+F10");
						const record = records.get(viewId);
						if (record) {
							setAttr(record.accessory, "hidden", selected ? null : "");
							if (record.controller.state.title !== title) record.controller.update({ title });
						}
					}
					setAttr(dom.el, "data-focused", focusedPanel === panelId ? "" : null);
					setAttr(dom.el, "data-single", panel.views.length === 1 ? "" : null);
					setAttr(dom.tabbar, "data-focused", focusedPanel === panelId ? "" : null);
					setAttr(dom.tabbar, "data-single", panel.views.length === 1 ? "" : null);
					const icon = (records.get(panel.selected)?.icon.innerHTML ?? "") || `<b>${escapeHtml(titleOf(panel.selected).slice(0, 1).toUpperCase())}</b>`;
					if (dom.frameIcon.innerHTML !== icon) dom.frameIcon.innerHTML = icon;
					if (barMode(panel) === "overlay") dom.endInset = dom.accessories.offsetWidth + dom.menuButton.offsetWidth + 24;
					const hasMenu = options.panelMenu === true || options.panelMenu === void 0 ? true : panelMenuEntries(panel).length > 0;
					setAttr(dom.menuButton, "hidden", hasMenu ? null : "");
				}
				invalidate();
			}
			function sync() {
				entries = layoutRects(doc.root, layoutMetrics());
				const live2 = new Set(viewIds(doc));
				for (const v of lifted()?.views ?? []) live2.add(v);
				for (const l of leaving.values()) for (const v of l.panel.views) live2.add(v);
				for (const viewId of [...records.keys()]) if (!live2.has(viewId)) destroySurface(viewId);
				const panelIds = /* @__PURE__ */ new Set();
				const visiblePanels = [
					...panelsOf(doc.root),
					...doc.floating.map((f) => f.panel),
					...lifted() ? [lifted()] : [],
					...[...leaving.values()].map((l) => l.panel)
				];
				for (const panel of visiblePanels) {
					panelIds.add(panel.id);
					syncTabs(panel);
				}
				for (const hidden of doc.hidden) for (const v of hidden.panel.views) ensureSurface(v);
				for (const id of [...panelDoms.keys()]) if (!panelIds.has(id)) destroyPanelDom(id);
				for (const record of records.values()) mountContent(record);
				for (const [id, dom] of panelDoms) {
					const floating = doc.floating.some((f) => f.panel.id === id) || lifted()?.id === id;
					setAttr(dom.el, "data-floating", floating ? "" : null);
					setAttr(dom.el, "data-region", floating ? "floating" : regionOf(id));
					if (floating && !dom.handles && lifted()?.id !== id) addResizeHandles(dom);
					if ((!floating || lifted()?.id === id) && dom.handles) {
						dom.handles.remove();
						dom.handles = null;
					}
				}
				syncDividers();
				const list = [...records.values()].map((r) => r.surface);
				if (list.length !== surfacesList.length || list.some((s, i) => s !== surfacesList[i])) {
					surfacesList = list;
					events.emit("surfaces", surfacesList);
				}
				const stage = findStage(doc.root);
				setAttr(root, "data-has-stage", stage ? "" : null);
				setAttr(root, "data-empty", !doc.root && !doc.floating.length ? "" : null);
				setAttr(root, "data-stage-empty", stage && !stage.child ? "" : null);
				updateTabs();
				nav?.sync();
				invalidate();
				schedule();
			}
			function syncDividers() {
				const wanted = /* @__PURE__ */ new Set();
				const visit = (node) => {
					if (!node) return;
					if (node.kind === "stage") return visit(node.child);
					if (node.kind !== "split") return;
					for (let i = 0; i < node.children.length - 1; i++) {
						const key = `${node.id}:${i}`;
						wanted.add(key);
						if (!dividerEls.has(key)) {
							const el2 = h$1("div", {
								"data-trellis-part": "divider",
								role: "separator",
								tabindex: "0",
								"aria-orientation": node.axis === "x" ? "vertical" : "horizontal",
								"aria-label": "Resize panels"
							});
							el2.dataset.split = node.id;
							el2.dataset.index = String(i);
							lifetime.listen(el2, "pointerdown", (e) => beginDivider(e, el2));
							lifetime.listen(el2, "dblclick", () => equalize(el2.dataset.split, Number(el2.dataset.index)));
							lifetime.listen(el2, "keydown", (e) => dividerKey(e, el2));
							dividers.append(el2);
							dividerEls.set(key, el2);
						}
						setAttr(dividerEls.get(key), "data-axis", node.axis);
					}
					node.children.forEach(visit);
				};
				visit(doc.root);
				for (const [key, el] of dividerEls) if (!wanted.has(key)) {
					el.remove();
					dividerEls.delete(key);
				}
			}
			function commit(next, o = {}) {
				const previous = doc;
				if (next === previous) return;
				if (o.animate !== false && !reduced()) {
					const from = new Map(lastRects);
					if (o.from) for (const [k, v] of o.from) from.set(k, v);
					tween.begin(from, performance.now());
				}
				doc = next;
				const before = new Set(viewIds(previous));
				const after = new Set(viewIds(doc));
				sync();
				for (const id of after) if (!before.has(id)) {
					const info = infoOf(id);
					if (info) events.emit("open", info);
				}
				for (const id of before) if (!after.has(id) && !lifted()?.views.includes(id)) {
					const record = previous.views[id];
					if (record) events.emit("close", {
						id,
						type: record.type,
						params: record.params ?? {},
						title: record.title ?? record.type,
						panelId: "",
						placement: "docked",
						selected: false
					});
				}
				if (focusedView && !after.has(focusedView) && !lifted()?.views.includes(focusedView)) setFocus((panelOfView(doc, lastFocusFallback()) ?? panelsOf(doc.root)[0] ?? doc.floating[0]?.panel ?? null)?.selected ?? null, false);
				else if (focusedView) focusedPanel = panelOfView(doc, focusedView)?.id ?? focusedPanel;
				render();
				if (!o.silent) emitChange();
			}
			function lastFocusFallback() {
				return lastStagePanel ? locatePanel(doc, lastStagePanel)?.panel.selected ?? "" : "";
			}
			function emitChange() {
				const snapshotDoc = getDocument();
				events.emit("change", snapshotDoc);
				persist();
			}
			function getDocument() {
				return {
					...doc,
					navigation: nav.serialize()
				};
			}
			function persist() {
				if (!options.persist) return;
				lifetime.clearTimeout(persistTimer);
				persistTimer = lifetime.timeout(() => {
					try {
						localStorage.setItem(options.persist.key, JSON.stringify({
							...getDocument(),
							version: options.persist.version ?? doc.version
						}));
					} catch {}
				}, 120);
			}
			function loadPersisted() {
				if (!options.persist) return null;
				try {
					const raw = localStorage.getItem(options.persist.key);
					if (!raw) return null;
					const parsed = JSON.parse(raw);
					if (parsed?.schema !== 1) return null;
					if ((options.persist.version ?? void 0) !== (parsed.version ?? void 0)) return null;
					return parsed;
				} catch {
					return null;
				}
			}
			function prepare(input) {
				const drop = /* @__PURE__ */ new Set();
				for (const [id, record] of Object.entries(input.views ?? {})) {
					if (!record || options.types[record.type]) continue;
					if ((options.onMissingType?.(record.type, id) ?? "placeholder") === "drop") drop.add(id);
				}
				let result = sanitize(input, () => true);
				for (const id of drop) result = closeView(result, id);
				return result;
			}
			function defaultDocument() {
				const spec = options.defaultLayout;
				if (!spec) return emptyDocument();
				if (spec.schema === 1) return structuredClone(spec);
				return createDocument(spec);
			}
			function schedule() {
				if (frame || lifetime.disposed) return;
				frame = lifetime.frame(tick);
			}
			function tick(time) {
				frame = 0;
				const dt = lastTime ? (time - lastTime) / 1e3 : .016;
				lastTime = time;
				let moving2 = false;
				if (camera.moving && !gesture) {
					if (reduced()) camera.finish();
					else moving2 = camera.step(dt) || moving2;
				}
				cameraChanged();
				if (tween.active) moving2 = tween.step(time) || moving2;
				if (!tween.active) settling.clear();
				if (dragActive()) moving2 = true;
				for (const [id, l] of leaving) if (time - l.start >= l.duration) {
					leaving.delete(id);
					destroyPanelDom(id);
					syncSilently();
				} else moving2 = true;
				if (entering.size) moving2 = true;
				render(time);
				if (moving2) schedule();
				else {
					lastTime = 0;
					settle();
				}
			}
			function syncSilently() {
				surfacesList = [...records.values()].map((r) => r.surface);
			}
			let settledState = true;
			function settle() {
				for (const record of records.values()) {
					const s = record.controller.state;
					const size = record.__size;
					if (size && (size.width !== s.size.width || size.height !== s.size.height)) record.controller.update({ size });
					const scale = record.__scale;
					if (scale !== void 0 && scale !== s.scale) record.controller.update({ scale });
				}
				for (const [id, dom] of panelDoms) if (dom.tabbar.hasAttribute("data-overlay")) {
					const inset2 = dom.accessories.offsetWidth + dom.menuButton.offsetWidth + 24;
					if (inset2 !== dom.endInset) {
						dom.endInset = inset2;
						const panel = findPanel(id);
						if (panel) for (const v of panel.views) records.get(v)?.content.style.setProperty("--trellis-titlebar-inset-end", `${inset2}px`);
					}
				}
				if (!settledState) {
					settledState = true;
					updateInteractivity();
				}
			}
			function updateInteractivity() {
				const busy = !!dragActive() || gesture;
				setAttr(root, "data-busy", busy ? "" : null);
				for (const record of records.values()) {
					const scale = record.controller.state.scale;
					record.controller.update({ interactive: !busy && usableAt(record.controller.id, scale) });
				}
			}
			const moving = () => camera.moving || tween.active || !!dragActive() || gesture || leaving.size > 0 || entering.size > 0;
			const collapsedOf = /* @__PURE__ */ new Map();
			const collapsedGroups = /* @__PURE__ */ new Set();
			const hiddenSplits = /* @__PURE__ */ new Set();
			const groupEls = /* @__PURE__ */ new Map();
			function computeCollapsed() {
				collapsedOf.clear();
				collapsedGroups.clear();
				hiddenSplits.clear();
				const detail = options.detail;
				if (detail === false || !navigationMode()) return;
				const size = detail?.size ?? DETAIL.size;
				const framedId = nav.framed;
				const hide2 = (node) => {
					if (node.kind === "split") {
						hiddenSplits.add(node.id);
						node.children.forEach(hide2);
					} else if (node.kind === "stage" && node.child) hide2(node.child);
				};
				const visit = (node) => {
					if (!node) return;
					if (node.kind === "stage") return visit(node.child);
					if (node.kind !== "split") return;
					const small = (id) => {
						const e = entries.get(id);
						if (!e) return false;
						const r = toScreen(e.rect);
						return r.w < size || r.h < size;
					};
					const nested = node.children.some((c) => c.kind === "split" || c.kind === "stage" && c.child?.kind === "split");
					if (node.id !== framedId && nested && (small(node.id) || node.children.every((c) => small(c.id)))) {
						collapsedGroups.add(node.id);
						hide2(node);
						for (const id of leafIds(node)) collapsedOf.set(id, node.id);
						return;
					}
					node.children.forEach(visit);
				};
				visit(doc.root);
			}
			function groupOutline(node, bounds, depth) {
				let html = "";
				const walk = (n, level) => {
					if (n.kind === "stage") {
						if (n.child) walk(n.child, level);
						return;
					}
					if (n.kind !== "split" || level >= depth) return;
					const r = entries.get(n.id)?.rect;
					if (!r) return;
					const pct = (v, from, size) => `${((v - from) / size * 100).toFixed(3)}%`;
					for (const child of n.children.slice(1)) {
						const c = entries.get(child.id)?.rect;
						if (!c) continue;
						html += n.axis === "x" ? `<i data-axis="x" style="left:${pct(c.x, bounds.x, bounds.w)};top:${pct(r.y, bounds.y, bounds.h)};height:${pct(r.y + r.h, r.y, bounds.h)}"></i>` : `<i data-axis="y" style="top:${pct(c.y, bounds.y, bounds.h)};left:${pct(r.x, bounds.x, bounds.w)};width:${pct(r.x + r.w, r.x, bounds.w)}"></i>`;
					}
					n.children.forEach((c) => walk(c, level + 1));
				};
				walk(node, 0);
				return html;
			}
			function groupSegmentAt(groupId, point) {
				const p = fromScreen(point);
				const outline = (options.detail || void 0)?.outline ?? DETAIL.outline;
				let node = entries.get(groupId)?.node;
				let target = groupId;
				for (let level = 0; node && level < Math.max(1, outline); level++) {
					if (node.kind === "stage") node = node.child ?? void 0;
					if (!node || node.kind !== "split") break;
					const child = node.children.find((c) => {
						const r = entries.get(c.id)?.rect;
						return r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
					});
					if (!child) break;
					target = child.id;
					node = child;
				}
				return target;
			}
			function renderGroups(round) {
				for (const [id, el] of groupEls) if (!collapsedGroups.has(id)) {
					el.remove();
					groupEls.delete(id);
				}
				const outline = (options.detail || void 0)?.outline ?? DETAIL.outline;
				for (const id of collapsedGroups) {
					const e = entries.get(id);
					if (!e || e.node.kind !== "split") continue;
					let el = groupEls.get(id);
					if (!el) {
						el = h$1("div", {
							"data-trellis-part": "group",
							"data-group": id,
							role: "img"
						});
						const groupId = id;
						lifetime.listen(el, "dblclick", (ev) => nav.focus(groupSegmentAt(groupId, localPoint(ev))));
						layer.append(el);
						groupEls.set(id, el);
					}
					const lines = groupOutline(e.node, e.rect, outline);
					if (el.dataset.lines !== lines) {
						el.innerHTML = lines;
						el.dataset.lines = lines;
					}
					const count = leafIds(e.node).length;
					setAttr(el, "aria-label", `${count} panels. Double-click to zoom in.`);
					setAttr(el, "title", "Double-click to zoom in");
					const r = inset(toScreen(e.rect), pad());
					const onscreen = r.x < viewport.w && r.y < viewport.h && r.x + r.w > 0 && r.y + r.h > 0;
					setStyle(el, "display", onscreen ? "" : "none");
					setStyle(el, "zIndex", "10");
					place(el, r, round);
				}
			}
			function render(time = performance.now()) {
				if (lifetime.disposed) return;
				computeCollapsed();
				const round = !moving();
				if (moving()) settledState = false;
				const stage = findStage(doc.root);
				const stagePreview = stage ? dragger?.layoutTargets()?.get(stage.id) : void 0;
				const sScreen = stagePreview ? inset(toScreen(stagePreview), pad()) : stageScreen();
				if (sScreen) {
					const r = tween.apply(stage.id, sScreen);
					setStyle(root, "--trellis-stage-x", `${r.x}px`);
					setStyle(root, "--trellis-stage-y", `${r.y}px`);
					setStyle(root, "--trellis-stage-w", `${r.w}px`);
					setStyle(root, "--trellis-stage-h", `${r.h}px`);
					place(backdrop, r, round);
					place(stageEmpty, r, round);
					lastRects.set(stage.id, r);
					setStyle(backdrop, "display", "");
					setStyle(stageEmpty, "display", stage.child ? "none" : "");
				} else {
					place(backdrop, {
						x: 0,
						y: 0,
						w: viewport.w,
						h: viewport.h
					}, true);
					setStyle(stageEmpty, "display", "none");
				}
				setStyle(empty, "display", !doc.root && !doc.floating.length && !lifted() ? "" : "none");
				const stageFloats = doc.floating.filter((f) => f.layer === "stage").sort((a, b) => a.z - b.z);
				const overlayFloats = doc.floating.filter((f) => f.layer === "overlay").sort((a, b) => a.z - b.z);
				const zOf = /* @__PURE__ */ new Map();
				for (const p of panelsOf(doc.root)) zOf.set(p.id, settling.has(p.id) ? 2900 : 10);
				stageFloats.forEach((f, i) => zOf.set(f.panel.id, settling.has(f.panel.id) ? 2900 : 30 + i * 3));
				overlayFloats.forEach((f, i) => zOf.set(f.panel.id, settling.has(f.panel.id) ? 2900 : 1e3 + i * 3));
				if (lifted()) zOf.set(lifted().id, 3100);
				for (const id of leaving.keys()) zOf.set(id, 2950);
				const shown = /* @__PURE__ */ new Set();
				for (const [panelId, dom] of panelDoms) {
					const panel = findPanel(panelId);
					if (!panel) continue;
					let r;
					let opacity = 1;
					const l = leaving.get(panelId);
					const enter = entering.get(panelId);
					if (l) {
						const e = DOCK_EASE(Math.min(1, (time - l.start) / l.duration));
						r = lerpRect(l.from, l.to, e);
						opacity = 1 - .9 * e;
					} else if (enter) {
						const target = targetRect(panelId);
						if (!target) continue;
						const t = Math.min(1, (time - enter.start) / DOCK_MS.restore);
						const e = DOCK_EASE(t);
						r = lerpRect(enter.from, target, e);
						opacity = .1 + .9 * e;
						if (t >= 1) entering.delete(panelId);
					} else {
						const target = targetRect(panelId);
						if (!target) continue;
						r = lifted()?.id === panelId ? dragger.liftedRect() : tween.apply(panelId, target);
					}
					lastRects.set(panelId, r);
					if (collapsedOf.has(panelId) && !leaving.has(panelId)) {
						setStyle(dom.el, "display", "none");
						if (dom.tabbar.parentElement !== dom.el) setStyle(dom.tabbar, "display", "none");
						if (dom.handles) setStyle(dom.handles, "display", "none");
						continue;
					}
					const onscreen = inView(r) && r.w > 2 && r.h > 2;
					setStyle(dom.el, "display", onscreen ? "" : "none");
					setStyle(dom.el, "opacity", opacity === 1 ? "" : String(opacity));
					const z = zOf.get(panelId) ?? 10;
					setStyle(dom.el, "zIndex", String(z));
					setAttr(dom.el, "data-lifted", lifted()?.id === panelId ? "" : null);
					place(dom.el, r, round);
					const clip = doc.floating.find((f) => f.panel.id === panelId)?.layer === "stage" && sScreen && lifted()?.id !== panelId ? clipInset(r, sScreen) : "";
					setStyle(dom.el, "clipPath", clip);
					const mode = barMode(panel);
					const bar = mode === "normal" ? tabbarHeight : 0;
					const frameOnly = lifted()?.id !== panelId && (r.w < FRAME_ONLY.w || r.h < FRAME_ONLY.h + (panel.views.length > 1 ? tabbarHeight : 0));
					setAttr(dom.el, "data-frame-only", frameOnly ? "" : null);
					if (frameOnly) setStyle(dom.el, "--trellis-frame-icon-size", `${Math.max(0, Math.min(40, r.w - 12, r.h - 12))}px`);
					setAttr(dom.el, "data-compact", r.w < 140 || r.h < bar + 24 ? "" : null);
					setAttr(dom.el, "data-tabbar", mode === "normal" ? null : mode);
					if (mode === "overlay") {
						if (dom.tabbar.parentElement !== layer) layer.append(dom.tabbar);
						setAttr(dom.tabbar, "data-overlay", "");
						setStyle(dom.tabbar, "zIndex", String(z + 2));
						setStyle(dom.tabbar, "display", onscreen ? "" : "none");
						setStyle(dom.tabbar, "opacity", opacity === 1 ? "" : String(opacity));
						setStyle(dom.tabbar, "clipPath", clip ? clipInset({
							x: r.x,
							y: r.y,
							w: r.w,
							h: tabbarHeight
						}, sScreen) : "");
						place(dom.tabbar, {
							x: r.x,
							y: r.y,
							w: r.w,
							h: tabbarHeight
						}, round);
					}
					if (dom.handles) {
						setStyle(dom.handles, "zIndex", String(z + 2));
						setStyle(dom.handles, "display", onscreen && !frameOnly ? "" : "none");
						setStyle(dom.handles, "opacity", opacity === 1 ? "" : String(opacity));
						setStyle(dom.handles, "clipPath", clip);
						place(dom.handles, r, round);
					}
					if (mode !== "overlay" && dom.tabbar.parentElement !== dom.el) {
						dom.el.prepend(dom.tabbar);
						setAttr(dom.tabbar, "data-overlay", null);
						for (const key of [
							"zIndex",
							"display",
							"opacity",
							"clipPath",
							"transform",
							"width",
							"height"
						]) setStyle(dom.tabbar, key, "");
					}
					if (!onscreen) continue;
					const body = {
						x: r.x,
						y: r.y + bar,
						w: r.w,
						h: Math.max(0, r.h - bar)
					};
					const reflow = reflowOf(panelId, !!(l || enter), bar);
					for (const viewId of panel.views) {
						const record = records.get(viewId);
						if (!record) continue;
						shown.add(viewId);
						placeSurface(record, body, panel.selected === viewId, z + 1, round, opacity, clip ? clipInset(body, sScreen) : "", frameOnly, reflow);
						setAttr(record.shell, "data-tabbar", mode === "normal" ? null : mode);
						const scale = record.__scale || 1;
						setStyle(record.content, "--trellis-titlebar-height", mode === "overlay" ? `${tabbarHeight / scale}px` : "0px");
						setStyle(record.content, "--trellis-titlebar-inset-end", mode === "overlay" ? `${dom.endInset / scale}px` : "0px");
					}
				}
				for (const [viewId, record] of records) {
					if (shown.has(viewId)) continue;
					setStyle(record.shell, "visibility", "hidden");
					setAttr(record.shell, "inert", "");
					const panel = panelOfView(doc, viewId);
					const hidden = panel ? doc.hidden.some((x) => x.panel.id === panel.id) : false;
					record.controller.update({
						visible: false,
						selected: panel?.selected === viewId,
						placement: hidden ? "hidden" : placementOf(viewId),
						panelId: panel?.id ?? record.controller.state.panelId,
						focused: focusedView === viewId
					});
				}
				renderDividers(round);
				renderGroups(round);
				renderSlots(round);
			}
			function clipInset(r, bounds) {
				const top = Math.max(0, bounds.y - r.y);
				const left = Math.max(0, bounds.x - r.x);
				const right = Math.max(0, r.x + r.w - (bounds.x + bounds.w));
				const bottom = Math.max(0, r.y + r.h - (bounds.y + bounds.h));
				if (!top && !left && !right && !bottom) return "";
				return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
			}
			const FREE_MIN = {
				width: 480,
				height: 320
			};
			function minSizeOf(viewId) {
				const type = typeOf(viewId);
				if (type.scaling === false) return void 0;
				return type.minSize ?? (navigationMode() === "free" ? FREE_MIN : void 0);
			}
			function usableAt(viewId, scale) {
				return scale >= .999 || typeOf(viewId).scaling !== "inert";
			}
			function placementOf(viewId) {
				const panel = panelOfView(doc, viewId) ?? (lifted()?.views.includes(viewId) ? lifted() : null);
				if (!panel) return "docked";
				if (doc.hidden.some((x) => x.panel.id === panel.id)) return "hidden";
				const r = regionOf(panel.id);
				return r === "floating" ? "floating" : r === "stage" ? "stage" : "docked";
			}
			function inView(r) {
				return r.x < viewport.w - 1 && r.y < viewport.h - 1 && r.x + r.w > 1 && r.y + r.h > 1;
			}
			function reflowOf(panelId, flying, bar) {
				if (flying || zooming) return "keep";
				if (!camera.moving || gesture) return "live";
				const end = restRect(panelId);
				return end && inView(end) ? {
					...end,
					y: end.y + bar,
					h: Math.max(0, end.h - bar)
				} : "keep";
			}
			function placeSurface(record, body, selected, z, round, opacity, clip, concealed = false, reflow = "live") {
				const { shell, content, controller } = record;
				const min = minSizeOf(controller.id);
				const scaleAt = (r) => Math.max(min ? Math.min(1, r.w / Math.max(1, min.width), r.h / Math.max(1, min.height)) : 1, .05);
				const safe = scaleAt(body);
				place(shell, body, round);
				setStyle(shell, "zIndex", String(z));
				setStyle(shell, "visibility", selected && !concealed ? "" : "hidden");
				setStyle(shell, "opacity", opacity === 1 ? "" : String(opacity));
				setStyle(shell, "clipPath", clip);
				const layoutAt = (r) => {
					const s = scaleAt(r);
					const cap = Math.max(1, r.w / s / (2 * viewport.w), r.h / s / (2 * viewport.h));
					return {
						w: Math.round(r.w / s / cap),
						h: Math.round(r.h / s / cap)
					};
				};
				let width, height, transform;
				const frozen = record.__layout;
				const settleAt = typeof reflow === "object" && reflow.w > 1 && reflow.h > 1 ? reflow : null;
				if (settleAt || reflow !== "live" && frozen) {
					const target = settleAt ? layoutAt(settleAt) : frozen;
					width = target.w;
					height = target.h;
					transform = `scale(${Math.max(body.w / width, body.h / height)})`;
					record.__layout = target;
				} else {
					const s = safe;
					const cap = Math.max(1, body.w / s / (2 * viewport.w), body.h / s / (2 * viewport.h));
					width = round ? Math.round(body.w / s / cap) : body.w / s / cap;
					height = round ? Math.round(body.h / s / cap) : body.h / s / cap;
					transform = s * cap < .999 || cap > 1 ? `scale(${s * cap})` : "";
					record.__layout = {
						w: width,
						h: height
					};
				}
				setStyle(content, "width", `${width}px`);
				setStyle(content, "height", `${height}px`);
				setStyle(content, "transform", transform);
				setAttr(shell, "data-scaled", safe < .999 ? usableAt(controller.id, safe) ? "" : "inert" : null);
				setAttr(shell, "inert", selected && !concealed ? null : "");
				record.__size = {
					width: Math.round(width),
					height: Math.round(height)
				};
				record.__scale = Math.round(safe * 1e3) / 1e3;
				const panel = panelOfView(doc, controller.id) ?? (lifted()?.views.includes(controller.id) ? lifted() : null);
				const onscreen = inView(body);
				const busy = !!dragActive() || gesture;
				controller.update({
					visible: selected && !concealed && onscreen && body.w > 1 && body.h > 1,
					selected,
					focused: focusedView === controller.id,
					placement: placementOf(controller.id),
					panelId: panel?.id ?? controller.state.panelId,
					interactive: !busy && usableAt(controller.id, safe),
					...moving() ? {} : {
						size: {
							width: Math.round(width),
							height: Math.round(height)
						},
						scale: Math.round(safe * 1e3) / 1e3
					}
				});
			}
			function renderDividers(round) {
				const show = !tween.active && !dragActive() && !gesture;
				for (const el of dividerEls.values()) {
					const split = effectiveSplit(el.dataset.split);
					const e = split && entries.get(split.id);
					if (!split || !e || !show || hiddenSplits.has(split.id)) {
						setStyle(el, "display", "none");
						continue;
					}
					const index = Number(el.dataset.index);
					const r = toScreen(e.rect);
					const total = split.weights.reduce((a, b) => a + b, 0);
					const boundary = split.weights.slice(0, index + 1).reduce((a, b) => a + b, 0) / total;
					const size = Math.max(8, gap + 4);
					const rect = split.axis === "x" ? {
						x: r.x + r.w * boundary - size / 2,
						y: r.y + pad(),
						w: size,
						h: r.h - gap
					} : {
						x: r.x + pad(),
						y: r.y + r.h * boundary - size / 2,
						w: r.w - gap,
						h: size
					};
					setStyle(el, "display", rect.x < viewport.w && rect.y < viewport.h && rect.x + rect.w > 0 && rect.y + rect.h > 0 ? "" : "none");
					place(el, rect, round);
					setAttr(el, "aria-valuenow", String(Math.round(boundary * 100)));
				}
			}
			function renderSlots(round) {
				const targets = dragger?.layoutTargets();
				for (const [el, id] of [[sourceSlot, SOURCE_SLOT], [dropSlot, DROP_SLOT]]) {
					const world = targets?.get(id);
					if (!world) {
						setAttr(el, "data-visible", null);
						lastRects.delete(id);
						continue;
					}
					const r = tween.apply(id, inset(toScreen(world), pad()));
					lastRects.set(id, r);
					const visible = r.w > 8 && r.h > 8;
					setAttr(el, "data-visible", visible ? "" : null);
					if (visible) place(el, r, round);
				}
				const label = dragger?.dropLabel() ?? "";
				if (dropLabel.textContent !== label) dropLabel.textContent = label;
				setAttr(dropSlot, "data-kind", label ? "tab" : null);
			}
			function setFocus(viewId, emit = true) {
				const nextPanel = (viewId ? panelOfView(doc, viewId) : null)?.id ?? null;
				if (focusedView === viewId && focusedPanel === nextPanel) return;
				focusedView = viewId;
				focusedPanel = nextPanel;
				if (nextPanel && regionOf(nextPanel) === "stage") lastStagePanel = nextPanel;
				updateTabs();
				for (const record of records.values()) record.controller.update({ focused: record.controller.id === viewId });
				if (emit) events.emit("focus", viewId);
			}
			function focusView(viewId, moveDom) {
				if (!doc.views[viewId]) return;
				setFocus(viewId);
				raiseIfFloating(viewId);
				const panel = panelOfView(doc, viewId);
				if (panel && collapsedOf.has(panel.id) && !dragActive()) nav.focus(panel.id);
				if (moveDom) lifetime.frame(() => moveFocusInto(viewId));
			}
			function raiseIfFloating(viewId) {
				const panel = panelOfView(doc, viewId);
				if (!panel || dragActive()) return;
				const raised = raiseFloat(doc, panel.id);
				if (raised !== doc) commit(raised, {
					animate: false,
					silent: true
				});
			}
			function moveFocusInto(viewId) {
				if (focusedView !== viewId) return;
				const target = records.get(viewId)?.content.querySelector("[autofocus], iframe, input, textarea, select, button, [tabindex]:not([tabindex='-1'])");
				if (target) target.focus({ preventScroll: true });
				else panelDoms.get(panelOfView(doc, viewId)?.id ?? "")?.tabs.get(viewId)?.el.focus({ preventScroll: true });
			}
			function selectAndFocus(viewId) {
				const next = selectView(doc, viewId);
				if (next !== doc) commit(next, { animate: false });
				focusView(viewId, false);
			}
			lifetime.listen(window, "blur", () => {
				lifetime.timeout(() => {
					const active = document.activeElement;
					if (active instanceof HTMLIFrameElement && root.contains(active)) {
						const viewId = active.closest("[data-trellis-content]")?.dataset.trellisContent;
						if (viewId) focusView(viewId, false);
					}
				}, 0);
			});
			function infoOf(viewId) {
				const record = doc.views[viewId];
				if (!record) return null;
				const panel = panelOfView(doc, viewId) ?? (lifted()?.views.includes(viewId) ? lifted() : null);
				return {
					id: viewId,
					type: record.type,
					params: record.params ?? {},
					title: titleOf(viewId),
					panelId: panel?.id ?? "",
					placement: placementOf(viewId),
					selected: panel?.selected === viewId
				};
			}
			function allowed(viewIdsList, region) {
				return viewIdsList.every((id) => {
					const allow = typeOf(id).allow;
					if (!allow) return true;
					if (region === "stage") return allow.stage !== false;
					if (region === "side") return allow.side !== false;
					return allow.floating !== false && !!floatingLayer();
				});
			}
			function cascadeRect(layerName) {
				const c = floatContainer(layerName);
				const w = Math.min(DEFAULT_FLOAT_SIZE.w, c.w * .6);
				const hgt = Math.min(DEFAULT_FLOAT_SIZE.h, c.h * .6);
				const step = openCounter++ % 6 * 28;
				return clampFloat({
					x: (c.w * .5 - w / 2 + step - 70) / c.w,
					y: (c.h * .45 - hgt / 2 + step - 50) / c.h,
					w: w / c.w,
					h: hgt / c.h
				});
			}
			function placePanel(d, panel, placement) {
				const views = panel.views;
				const stage = findStage(d.root);
				const fl = floatingLayer();
				const focused = focusedPanel && locatePanel(d, focusedPanel) ? focusedPanel : null;
				const regionOfIn = (id) => {
					if (d.floating.some((f) => f.panel.id === id)) return "floating";
					return stage && findNode(stage, id) ? "stage" : "side";
				};
				const tryPlacements = [placement];
				if (placement !== "side") tryPlacements.push("side");
				for (const p of tryPlacements) {
					if (p === "float" || typeof p === "object" && "float" in p) {
						if (!fl || !allowed(views, "floating")) continue;
						const layerName = typeof p === "object" && "float" in p ? p.layer ?? fl : fl;
						return floatPanel(d, panel, typeof p === "object" && "float" in p ? p.float : cascadeRect(layerName), layerName);
					}
					if (typeof p === "object" && "beside" in p) {
						const target = findNode(d.root, p.beside) ? p.beside : null;
						if (!allowed(views, target && stage && findNode(stage, target) && target !== stage.id ? "stage" : "side")) continue;
						if (!target) return insertPanel(d, panel, {
							beside: d.root?.id ?? "",
							edge: p.edge,
							share: p.share
						});
						return insertPanel(d, panel, {
							beside: target,
							edge: p.edge,
							share: p.share
						});
					}
					if (typeof p === "object" && "into" in p) {
						const loc = locatePanel(d, p.into);
						const node = findNode(d.root, p.into);
						if (!allowed(views, node?.kind === "stage" ? "stage" : loc ? regionOfIn(p.into) : "side") || !loc && node?.kind !== "stage") continue;
						return insertPanel(d, panel, {
							into: p.into,
							index: p.index
						});
					}
					if (p === "stage") {
						if (!stage) {
							if (focused && allowed(views, regionOfIn(focused))) return insertPanel(d, panel, { into: focused });
							continue;
						}
						if (!allowed(views, "stage")) continue;
						if (!stage.child) return insertPanel(d, panel, { into: stage.id });
						const inStage = panelsOf(stage);
						return insertPanel(d, panel, { into: focused && inStage.some((x) => x.id === focused) && focused || lastStagePanel && inStage.some((x) => x.id === lastStagePanel) && lastStagePanel || inStage[0].id });
					}
					if (p === "tab") {
						if (focused && allowed(views, regionOfIn(focused))) return insertPanel(d, panel, { into: focused });
						if (stage) return placePanel(d, panel, "stage");
						continue;
					}
					if (p === "side") {
						if (!d.root) {
							if (allowed(views, "side")) return {
								...d,
								root: panel
							};
							continue;
						}
						if (!allowed(views, "side")) break;
						if (stage && d.root.id !== stage.id) return insertPanel(d, panel, {
							beside: stage.id,
							edge: "right",
							share: .25
						});
						return insertPanel(d, panel, {
							beside: d.root.id,
							edge: "right",
							share: stage ? .25 : .35
						});
					}
				}
				if (fl && d.root) return floatPanel(d, panel, cascadeRect(fl), fl);
				return d.root ? insertPanel(d, panel, {
					beside: d.root.id,
					edge: "right"
				}) : {
					...d,
					root: panel
				};
			}
			function defaultPlacement(type) {
				const def = options.types[type];
				if (def?.placement) return def.placement;
				if (findStage(doc.root)) return "stage";
				if (focusedPanel) return "tab";
				return "side";
			}
			function open(type, o = {}) {
				const def = options.types[type];
				if (!def) throw Error(`Trellis: unknown view type "${type}"`);
				const existing = findExisting(type, o, o.reuse ?? (def.singleton ? "type" : "none"));
				if (existing) {
					reveal(existing, o.focus !== false);
					return infoOf(existing);
				}
				if (o.id && doc.views[o.id]) {
					reveal(o.id, o.focus !== false);
					return infoOf(o.id);
				}
				const id = o.id ?? uid(type);
				const withRecord = {
					...doc,
					views: {
						...doc.views,
						[id]: {
							type,
							...o.params ? { params: o.params } : {},
							...o.title ? { title: o.title } : {}
						}
					}
				};
				const panel = {
					kind: "panel",
					id: uid("panel"),
					views: [id],
					selected: id
				};
				const next = placePanel(withRecord, panel, o.placement ?? defaultPlacement(type));
				const from = o.from ? /* @__PURE__ */ new Map([[panel.id, towardRect(o.from, {
					x: 0,
					y: 0,
					w: 0,
					h: 0
				})]]) : void 0;
				commit(next, { from });
				const appeared = panelDoms.get(panel.id);
				if (appeared && !from) appear(appeared.el, panel.views);
				if (o.focus !== false) {
					const target = panelOfView(doc, id);
					if (target && doc.floating.some((f) => f.panel.id === target.id)) commit(raiseFloat(doc, target.id), {
						silent: true,
						animate: false
					});
					focusView(id, true);
					ensureFramedVisible(id);
				}
				return infoOf(id);
			}
			function appear(el, views) {
				if (reduced()) return;
				for (const node of [el, ...views.map((v) => records.get(v)?.shell).filter(Boolean)]) {
					node.removeAttribute("data-appearing");
					node.offsetWidth;
					node.setAttribute("data-appearing", "");
					lifetime.timeout(() => node.removeAttribute("data-appearing"), MOTION.appearMs + 40);
				}
			}
			function findExisting(type, o, reuse) {
				if (!reuse || reuse === "none") return null;
				for (const id of viewIds(doc)) {
					const record = doc.views[id];
					if (record.type !== type) continue;
					if (reuse === "type") return id;
					if (reuse === "params" && stableJson(record.params ?? {}) === stableJson(o.params ?? {})) return id;
					if (typeof reuse === "function" && reuse(infoOf(id))) return id;
				}
				return null;
			}
			function reveal(viewId, focusIt) {
				const panel = panelOfView(doc, viewId);
				if (!panel) return;
				if (doc.hidden.some((x) => x.panel.id === panel.id)) restore(panel.id);
				let next = selectView(doc, viewId);
				if (doc.floating.some((f) => f.panel.id === panel.id)) next = raiseFloat(next, panel.id);
				if (next !== doc) commit(next, { animate: false });
				if (focusIt) focusView(viewId, true);
				ensureFramedVisible(viewId);
			}
			function ensureFramedVisible(viewId) {
				const panel = panelOfView(doc, viewId);
				if (panel) nav.ensureVisible(panel.id);
			}
			async function close(viewId, o = {}) {
				if (!doc.views[viewId]) return false;
				const record = records.get(viewId);
				if (!o.force && record && !await record.controller.canClose()) return false;
				if (!doc.views[viewId]) return false;
				const active = document.activeElement;
				const panelId = panelOfView(doc, viewId)?.id;
				const tabEl = panelId ? panelDoms.get(panelId)?.tabs.get(viewId)?.el : void 0;
				const hadFocus = !!active && (!!record?.shell.contains(active) || !!tabEl?.contains(active));
				commit(closeView(doc, viewId));
				if (hadFocus) {
					const next = panelId && locatePanel(doc, panelId)?.panel || (focusedView ? panelOfView(doc, focusedView) : null);
					if (next) panelDoms.get(next.id)?.tabs.get(next.selected)?.el.focus({ preventScroll: true });
					else root.focus({ preventScroll: true });
				}
				return true;
			}
			function resolvePanel(id) {
				return locatePanel(doc, id)?.panel ?? panelOfView(doc, id);
			}
			function hide(id, o = {}) {
				const owner = !locatePanel(doc, id) ? panelOfView(doc, id) : null;
				if (owner && owner.views.length > 1 && !doc.hidden.some((x) => x.panel.id === owner.id)) {
					const alone = {
						kind: "panel",
						id: uid("panel"),
						views: [id],
						selected: id
					};
					const detached = detachView(doc, id);
					const from2 = lastRects.get(owner.id);
					if (from2 && !reduced()) leaving.set(alone.id, {
						panel: alone,
						from: from2,
						to: towardRect(o.toward, from2),
						start: performance.now(),
						duration: DOCK_MS.hide
					});
					commit({
						...detached,
						hidden: [...detached.hidden, {
							panel: alone,
							restore: {
								kind: "tab",
								panel: owner.id
							}
						}]
					});
					return;
				}
				const panel = resolvePanel(id);
				if (!panel || doc.hidden.some((x) => x.panel.id === panel.id)) return;
				const from = lastRects.get(panel.id) ?? targetRect(panel.id);
				const next = hidePanel(doc, panel.id);
				if (from && !reduced()) {
					const to = towardRect(o.toward, from);
					leaving.set(panel.id, {
						panel,
						from,
						to,
						start: performance.now(),
						duration: DOCK_MS.hide
					});
				}
				commit(next);
			}
			function towardRect(toward, from) {
				if (toward && "getBoundingClientRect" in toward) {
					const b = root.getBoundingClientRect();
					const r = toward.getBoundingClientRect();
					return {
						x: r.left - b.left,
						y: r.top - b.top,
						w: r.width,
						h: r.height
					};
				}
				if (toward) return toward;
				return {
					x: from.x + from.w * .25,
					y: from.y + from.h,
					w: from.w * .5,
					h: from.h * .1
				};
			}
			function restore(panelId, o = {}) {
				const hidden = doc.hidden.find((x) => x.panel.id === panelId);
				if (!hidden) return;
				leaving.delete(panelId);
				const fl = floatingLayer() || "overlay";
				const next = restorePanel(doc, panelId, fl);
				lastRects.delete(panelId);
				if (o.from && !reduced()) entering.set(panelId, {
					from: towardRect(o.from, {
						x: 0,
						y: 0,
						w: 0,
						h: 0
					}),
					start: performance.now()
				});
				commit(next);
				if (!o.from) {
					const dom = panelDoms.get(panelId);
					if (dom) appear(dom.el, hidden.panel.views);
				}
				focusView(hidden.panel.selected, true);
			}
			const rememberedFloats = /* @__PURE__ */ new Map();
			function toggleDock(id) {
				const panel = resolvePanel(id);
				if (!panel || doc.hidden.some((x) => x.panel.id === panel.id)) return;
				const stage = findStage(doc.root);
				const float2 = doc.floating.find((f) => f.panel.id === panel.id);
				const from = /* @__PURE__ */ new Map();
				const current = lastRects.get(panel.id);
				if (current) from.set(panel.id, current);
				const without = removePanel(doc, panel.id);
				if (float2) {
					if (!allowed(panel.views, "side")) return;
					settling.add(panel.id);
					rememberedFloats.set(panel.id, float2.rect);
					const s = stageScreen();
					commit(stage && without.root && findNode(without.root, stage.id) ? insertPanel(without, panel, {
						beside: stage.id,
						edge: !s || s.w >= s.h ? "right" : "bottom"
					}) : placePanel(without, panel, "side"), { from });
					nav.include(stage ? [stage.id, panel.id] : [panel.id]);
				} else {
					const layer2 = floatingLayer();
					if (!layer2 || !allowed(panel.views, "floating")) return;
					settling.add(panel.id);
					commit(floatPanel(without, panel, rememberedFloats.get(panel.id) ?? cascadeRect(layer2), layer2), { from });
					if (stage) nav.include([stage.id]);
				}
				focusView(panel.selected, false);
			}
			function float(id, rect) {
				const fl = floatingLayer();
				if (!fl) return;
				const loc = locatePanel(doc, id);
				let d = doc;
				let panel = loc?.panel ?? null;
				if (!loc) {
					const owner = panelOfView(doc, id);
					if (!owner) return;
					if (owner.views.length > 1) {
						d = detachView(doc, id);
						panel = {
							kind: "panel",
							id: uid("panel"),
							views: [id],
							selected: id
						};
					} else panel = owner;
				}
				if (!panel || !allowed(panel.views, "floating")) return;
				if (locatePanel(d, panel.id)?.where === "floating" && !rect) return;
				const current = lastRects.get(panel.id) ?? lastRects.get(loc?.panel.id ?? "") ?? null;
				let target = rect;
				if (!target) {
					const base = current ?? floatScreen(cascadeRect(fl), fl);
					const w = Math.min(base.w, DEFAULT_FLOAT_SIZE.w);
					const hh = Math.min(base.h, DEFAULT_FLOAT_SIZE.h);
					target = screenToFloat({
						x: base.x + (base.w - w) / 2 + 24,
						y: base.y + (base.h - hh) / 2 + 24,
						w,
						h: hh
					}, fl);
				}
				const from = /* @__PURE__ */ new Map();
				if (current) from.set(panel.id, current);
				if (locatePanel(d, panel.id)) d = removePanel(d, panel.id);
				commit(floatPanel(d, panel, target, fl), { from });
			}
			function dock(id, target) {
				let panel = resolvePanel(id);
				if (!panel) return;
				let d = doc;
				if (!locatePanel(doc, id) && panel.views.length > 1) {
					d = detachView(doc, id);
					panel = {
						kind: "panel",
						id: uid("panel"),
						views: [id],
						selected: id
					};
				} else d = removePanel(doc, panel.id);
				const t = target === "stage" ? { into: findStage(d.root)?.id ?? d.root?.id ?? "" } : target;
				const from = /* @__PURE__ */ new Map();
				const current = lastRects.get(panel.id);
				if (current) from.set(panel.id, current);
				if ("into" in t && !findNode(d.root, t.into) && !locatePanel(d, t.into)) {
					commit(placePanel(d, panel, "side"), { from });
					return;
				}
				commit(d.root ? insertPanel(d, panel, t) : {
					...d,
					root: panel
				}, { from });
			}
			function setTitle(viewId, title) {
				const record = doc.views[viewId];
				if (!record || record.title === title) return;
				doc = {
					...doc,
					views: {
						...doc.views,
						[viewId]: {
							...record,
							title
						}
					}
				};
				records.get(viewId)?.controller.update({ title });
				updateTabs();
				emitChange();
			}
			function setParams(viewId, patch) {
				const record = doc.views[viewId];
				if (!record) return;
				doc = {
					...doc,
					views: {
						...doc.views,
						[viewId]: {
							...record,
							params: {
								...record.params ?? {},
								...patch
							}
						}
					}
				};
				records.get(viewId)?.controller.update({
					params: doc.views[viewId].params ?? {},
					title: titleOf(viewId)
				});
				updateTabs();
				emitChange();
			}
			function menuFor(panel) {
				const def = typeOf(panel.selected);
				const controller = records.get(panel.selected)?.controller;
				return typeof def.menu === "function" ? controller ? def.menu(controller) : [] : def.menu ?? [];
			}
			function builtInMenu(panel) {
				const panelId = panel.id;
				const region = regionOf(panelId);
				const items = [];
				const keymap = {
					...DEFAULT_KEYMAP,
					...options.keymap
				};
				const hint = (c) => keymap[c] ? formatCombo(keymap[c]) : void 0;
				if (navigationMode() && region !== "floating") items.push({
					id: "maximize",
					label: framed() === panelId ? "Restore size" : "Maximize",
					shortcut: hint("frame.toggle"),
					run: () => toggleFrame(panelId)
				});
				if (region === "floating" && floatingLayer() === "stage") items.push({
					id: "dock",
					label: "Dock beside stage",
					run: () => toggleDock(panelId)
				});
				else if (region === "floating") items.push({
					id: "dock",
					label: "Dock",
					run: () => dock(panelId, findStage(doc.root) && allowed(panel.views, "stage") ? "stage" : {
						beside: doc.root?.id ?? "",
						edge: "right",
						share: .3
					})
				});
				else if (floatingLayer() && allowed(panel.views, "floating")) items.push({
					id: "float",
					label: "Float",
					run: () => floatingLayer() === "stage" ? toggleDock(panelId) : float(panelId)
				});
				const viewId = panel.selected;
				const moves = [...panelsOf(doc.root), ...doc.floating.map((f) => f.panel)].filter((p) => p.id !== panelId && allowed([viewId], regionOf(p.id))).map((p) => ({
					id: `move:${p.id}`,
					label: p.views.length > 1 ? `${titleOf(p.selected)} +${p.views.length - 1}` : titleOf(p.selected),
					run: () => {
						dock(viewId, { into: p.id });
						focusView(viewId, false);
					}
				}));
				if (panel.views.length > 1 && region !== "floating") moves.push({
					id: "split-right",
					label: "New split right",
					run: () => dock(viewId, {
						beside: panelId,
						edge: "right"
					})
				}, {
					id: "split-below",
					label: "New split below",
					run: () => dock(viewId, {
						beside: panelId,
						edge: "bottom"
					})
				});
				if (moves.length) items.push({
					id: "move",
					label: `Move ${titleOf(viewId)} to`,
					items: moves
				});
				items.push({
					id: "hide",
					label: "Hide",
					run: () => hide(panelId, { toward: options.hideToward?.(panelId) ?? void 0 })
				});
				if (panel.views.filter((v) => typeOf(v).closable !== false).length) {
					items.push("separator");
					if (typeOf(panel.selected).closable !== false) items.push({
						id: "close",
						label: `Close ${titleOf(panel.selected)}`,
						shortcut: hint("view.close"),
						run: () => void close(panel.selected)
					});
					if (panel.views.length > 1) items.push({
						id: "close-others",
						label: "Close other tabs",
						run: () => panel.views.filter((v) => v !== panel.selected).forEach((v) => void close(v))
					});
				}
				return items;
			}
			function panelMenuEntries(panel) {
				const setting = options.panelMenu ?? true;
				const entries2 = menuFor(panel);
				if (setting === false) return tidyMenu(entries2);
				const builtIns = builtInMenu(panel);
				const all = entries2.length ? [
					...entries2,
					"separator",
					...builtIns
				] : builtIns;
				if (setting === true) return tidyMenu(all);
				const view = records.get(panel.selected)?.controller;
				if (!view) return tidyMenu(all);
				return tidyMenu(setting(tidyMenu(all), {
					panelId: panel.id,
					view,
					region: regionOf(panel.id)
				}));
			}
			function openPanelMenu(panelId, button, at) {
				const panel = findPanel(panelId);
				if (!panel) return;
				const entries2 = panelMenuEntries(panel);
				if (!entries2.length) return;
				const b = root.getBoundingClientRect();
				const r = button?.getBoundingClientRect();
				if (button) setAttr(button, "aria-expanded", "true");
				const reset = () => button && setAttr(button, "aria-expanded", null);
				if (options.renderMenu) {
					menu.close();
					options.renderMenu({
						entries: entries2,
						x: r ? r.right : b.left + (at?.x ?? 0),
						y: r ? r.bottom + 4 : b.top + (at?.y ?? 0),
						align: r ? "end" : "start",
						anchor: button,
						panelId,
						close: reset
					});
					return;
				}
				menuCloseHook = reset;
				if (r) menu.show(entries2, {
					x: r.right - b.left,
					y: r.bottom - b.top + 4,
					alignRight: true
				});
				else menu.show(entries2, at ?? {
					x: 0,
					y: 0
				});
			}
			function tabKeydown(e, panelId) {
				const panel = findPanel(panelId);
				if (!panel) return;
				const index = panel.views.indexOf(panel.selected);
				const go = (i) => {
					e.preventDefault();
					const viewId = panel.views[(i + panel.views.length) % panel.views.length];
					const next = selectView(doc, viewId);
					if (next !== doc) commit(next, { animate: false });
					setFocus(viewId);
					panelDoms.get(panelId)?.tabs.get(viewId)?.el.focus();
				};
				switch (e.key) {
					case "ArrowRight": return go(index + 1);
					case "ArrowLeft": return go(index - 1);
					case "Home": return go(0);
					case "End": return go(panel.views.length - 1);
					case "Delete":
						if (typeOf(panel.selected).closable !== false) {
							e.preventDefault();
							close(panel.selected);
						}
						return;
					case "Enter":
					case " ":
						e.preventDefault();
						focusView(panel.selected, true);
						return;
					case "ContextMenu":
					case "F10":
						if (e.key === "F10" && !e.shiftKey) return;
						e.preventDefault();
						openPanelMenu(panelId, panelDoms.get(panelId).menuButton);
						return;
				}
			}
			lifetime.listen(root, "keydown", (e) => {
				if (e.defaultPrevented) return;
				if (dragActive()) return;
				const keymap = {
					...DEFAULT_KEYMAP,
					...options.keymap
				};
				const typing = e.target.matches?.("input, textarea, select, [contenteditable=''], [contenteditable=true]");
				const inContent = !!e.target.closest?.("[data-trellis-part=content]");
				for (const [command, combo] of Object.entries(keymap)) {
					if (typing && combo && !e.ctrlKey && !e.metaKey && !e.altKey) continue;
					if (command === "navigation.stepOut" && (!framed() || inContent)) continue;
					if (combo && matches(e, combo)) {
						e.preventDefault();
						run(command);
						return;
					}
				}
			});
			function run(command) {
				const panelId = focusedPanel;
				const panel = panelId ? findPanel(panelId) : null;
				switch (command) {
					case "frame.toggle":
						if (panelId) toggleFrame(panelId);
						return;
					case "navigation.back": return nav.back();
					case "navigation.forward": return nav.forward();
					case "navigation.overview": return nav.toggleOverview();
					case "navigation.stepOut": return nav.stepOut();
					case "panel.next":
					case "panel.previous": {
						const order = [...panelsOf(doc.root), ...doc.floating.map((f) => f.panel)];
						if (!order.length) return;
						const next = order[(order.findIndex((p) => p.id === panelId) + (command === "panel.next" ? 1 : -1) + order.length) % order.length];
						focusView(next.selected, false);
						panelDoms.get(next.id)?.tabs.get(next.selected)?.el.focus();
						ensureFramedVisible(next.selected);
						return;
					}
					case "tab.next":
					case "tab.previous": {
						if (!panel) return;
						const i = panel.views.indexOf(panel.selected);
						const viewId = panel.views[(i + (command === "tab.next" ? 1 : -1) + panel.views.length) % panel.views.length];
						selectAndFocus(viewId);
						return;
					}
					case "view.close":
						if (focusedView && typeOf(focusedView).closable !== false) close(focusedView);
						return;
					case "panel.float":
						if (panelId) float(panelId);
						return;
					case "panel.hide":
						if (panelId) hide(panelId);
						return;
				}
			}
			let lastCamera = { ...UNIT };
			function cameraChanged() {
				if (sameRect2(lastCamera, camera.value)) return;
				lastCamera = { ...camera.value };
				if (events.has("camera")) events.emit("camera", { ...camera.value });
			}
			function toggleFrame(panelId) {
				const float2 = doc.floating.find((f) => f.panel.id === panelId);
				if (float2) {
					if (float2.layer !== "stage") return false;
					nav.frame("stage");
					return true;
				}
				return nav.toggle(panelId);
			}
			const framed = () => nav?.framed ?? null;
			function localPoint(ev) {
				const b = root.getBoundingClientRect();
				return {
					x: ev.clientX - b.left,
					y: ev.clientY - b.top
				};
			}
			function fromScreenRect(screen) {
				if (!screen) return null;
				const p = pad();
				const a = fromScreen({
					x: screen.x - p,
					y: screen.y - p
				});
				const b = fromScreen({
					x: screen.x + screen.w + p,
					y: screen.y + screen.h + p
				});
				return {
					x: a.x,
					y: a.y,
					w: b.x - a.x,
					h: b.y - a.y
				};
			}
			function announce(text) {
				live.textContent = text;
			}
			function layoutMetrics() {
				return {
					width: viewport.w - pad() * 2,
					height: viewport.h - pad() * 2,
					min: (node, axis) => (node.kind === "stage" && !node.child ? 120 : axis === "x" ? PANEL_MIN.w : tabbarHeight + 28) + gap
				};
			}
			function effectiveSplit(id) {
				const node = entries.get(id)?.node;
				return node?.kind === "split" ? node : null;
			}
			function beginDivider(e, el) {
				if (e.button !== 0) return;
				e.preventDefault();
				const origin = doc;
				const splitId = el.dataset.split;
				const index = Number(el.dataset.index);
				const push = doc.root && dragBoundary(doc.root, layoutMetrics(), splitId, index);
				if (!push) return;
				const from = () => options.keepPushed === false ? push : dragBoundary(doc.root, layoutMetrics(), splitId, index) ?? push;
				const along = (ev) => fromScreen(localPoint(ev))[push.axis];
				const grab = along(e);
				el.setPointerCapture(e.pointerId);
				setAttr(root, "data-resizing", push.axis);
				setAttr(el, "data-active", "");
				gesture = true;
				updateInteractivity();
				const move = (ev) => {
					doc = {
						...doc,
						root: from().to(push.start + along(ev) - grab)
					};
					entries = layoutRects(doc.root, layoutMetrics());
					render();
				};
				const up = () => {
					el.removeEventListener("pointermove", move);
					el.removeEventListener("pointerup", up);
					el.removeEventListener("pointercancel", up);
					setAttr(root, "data-resizing", null);
					setAttr(el, "data-active", null);
					gesture = false;
					const next = doc;
					doc = origin;
					commit(next, { animate: false });
					updateInteractivity();
				};
				el.addEventListener("pointermove", move);
				el.addEventListener("pointerup", up);
				el.addEventListener("pointercancel", up);
			}
			function equalize(splitId, index) {
				const split = findNode(doc.root, splitId);
				if (!split) return;
				const weights = [...split.weights];
				const pair = weights[index] + weights[index + 1];
				weights[index] = weights[index + 1] = pair / 2;
				commit({
					...doc,
					root: replaceNode(doc.root, splitId, {
						...split,
						weights
					})
				});
			}
			function dividerKey(e, el) {
				const split = effectiveSplit(el.dataset.split);
				const entry = entries.get(el.dataset.split);
				if (!split || !entry || !doc.root) return;
				const decrease = split.axis === "x" ? "ArrowLeft" : "ArrowUp";
				const increase = split.axis === "x" ? "ArrowRight" : "ArrowDown";
				if (e.key !== decrease && e.key !== increase) return;
				e.preventDefault();
				const push = dragBoundary(doc.root, layoutMetrics(), split.id, Number(el.dataset.index));
				if (!push) return;
				const step = (e.shiftKey ? .1 : .02) * (split.axis === "x" ? entry.rect.w : entry.rect.h);
				const next = push.to(push.start + (e.key === increase ? step : -step));
				if (next !== doc.root) commit({
					...doc,
					root: next
				}, { animate: false });
			}
			function addResizeHandles(dom) {
				const wrap = h$1("div", {
					class: "trellis-handles",
					"data-panel": dom.id
				});
				for (const dir of [
					"n",
					"s",
					"e",
					"w",
					"ne",
					"nw",
					"se",
					"sw"
				]) {
					const handleEl = h$1("div", {
						"data-trellis-part": "resize",
						"data-dir": dir,
						"aria-hidden": "true"
					});
					lifetime.listen(handleEl, "pointerdown", (e) => beginFloatResize(e, dom.id, dir));
					wrap.append(handleEl);
				}
				layer.append(wrap);
				dom.handles = wrap;
			}
			function beginFloatResize(e, panelId, dir) {
				if (e.button !== 0) return;
				e.preventDefault();
				e.stopPropagation();
				const float2 = doc.floating.find((f) => f.panel.id === panelId);
				if (!float2) return;
				const start = floatScreen(float2.rect, float2.layer);
				const origin = doc;
				const startPoint = localPoint(e);
				const target = e.currentTarget;
				target.setPointerCapture(e.pointerId);
				gesture = true;
				updateInteractivity();
				setAttr(root, "data-resizing", "float");
				const minW = 160;
				const minH = tabbarHeight + 60;
				const move = (ev) => {
					const p = localPoint(ev);
					const dx = p.x - startPoint.x;
					const dy = p.y - startPoint.y;
					let { x, y, w, h: hh } = start;
					if (dir.includes("e")) w = Math.max(minW, start.w + dx);
					if (dir.includes("s")) hh = Math.max(minH, start.h + dy);
					if (dir.includes("w")) {
						w = Math.max(minW, start.w - dx);
						x = start.x + start.w - w;
					}
					if (dir.includes("n")) {
						hh = Math.max(minH, start.h - dy);
						y = start.y + start.h - hh;
					}
					const rect = screenToFloat({
						x,
						y,
						w,
						h: hh
					}, float2.layer);
					doc = {
						...doc,
						floating: doc.floating.map((f) => f.panel.id === panelId ? {
							...f,
							rect
						} : f)
					};
					render();
				};
				const up = () => {
					target.removeEventListener("pointermove", move);
					target.removeEventListener("pointerup", up);
					target.removeEventListener("pointercancel", up);
					gesture = false;
					setAttr(root, "data-resizing", null);
					const next = doc;
					doc = origin;
					commit(next, { animate: false });
					updateInteractivity();
				};
				target.addEventListener("pointermove", move);
				target.addEventListener("pointerup", up);
				target.addEventListener("pointercancel", up);
			}
			function invalidate() {
				snapshot = null;
				for (const listener of [...listeners]) listener();
			}
			function getSnapshot() {
				if (snapshot) return snapshot;
				const ids = viewIds(doc);
				for (const id of lifted()?.views ?? []) if (!ids.includes(id)) ids.push(id);
				const views = ids.map((id) => infoOf(id)).filter(Boolean);
				snapshot = {
					document: doc,
					focusedPanel,
					focusedView,
					views,
					hidden: doc.hidden.map((x) => ({
						panelId: x.panel.id,
						views: x.panel.views.map((v) => infoOf(v)).filter(Boolean)
					})),
					framed: nav.framed,
					canGoBack: nav.canGoBack,
					canGoForward: nav.canGoForward,
					framings: nav.framings.list(),
					dragging: !!dragActive()
				};
				return snapshot;
			}
			dragger = createDragController({
				root,
				lifetime,
				tween,
				lastRects,
				reduced,
				doc: () => doc,
				setDoc(next) {
					doc = next;
					sync();
					render();
				},
				commit(next, from, settle2) {
					if (settle2) settling.add(settle2);
					if (next === doc) {
						if (!reduced()) tween.begin(from, performance.now());
						sync();
						render();
						return;
					}
					commit(next, { from });
				},
				render: () => render(),
				schedule,
				busy(active) {
					updateInteractivity();
					if (active) settledState = false;
					invalidate();
				},
				closeMenus: () => menu.close(false),
				camera: () => camera.value,
				viewport: () => viewport,
				inset: pad,
				tabbarHeight: (panel) => barHeight(panel),
				toScreen,
				fromScreen,
				panelScreen: (world) => inset(toScreen(world), pad()),
				fromScreenRect,
				floatWorld(panelId) {
					const float2 = doc.floating.find((f) => f.panel.id === panelId);
					if (!float2 || float2.layer !== "stage") return null;
					const s = stageWorld();
					return {
						x: s.x + float2.rect.x * s.w,
						y: s.y + float2.rect.y * s.h,
						w: float2.rect.w * s.w,
						h: float2.rect.h * s.h
					};
				},
				floatingLayer,
				panelDom: (id) => panelDoms.get(id),
				frameOnly: (id) => !!panelDoms.get(id)?.el.hasAttribute("data-frame-only"),
				layoutMetrics,
				collapsedGroupOf: (id) => collapsedOf.get(id) ?? null,
				collapsedSplit: (id) => hiddenSplits.has(id),
				allowed,
				framedNode: () => nav.framedNode,
				minSize(viewIds2) {
					let w = 0;
					let h2 = 0;
					for (const id of viewIds2) {
						const min = minSizeOf(id);
						w = Math.max(w, min?.width ?? 0);
						h2 = Math.max(h2, min?.height ?? 0);
					}
					return {
						w,
						h: h2
					};
				},
				moved(panel, from, to) {
					const stage = findStage(doc.root);
					if (to === "float" && from === "docked" && stage) nav.include([stage.id]);
					else if (to !== "float" && to !== "tab" && from === "floating") nav.include([panel.id]);
					else ensureFramedVisible(panel.selected);
					focusView(panel.selected, false);
				},
				announce
			});
			nav = createNavigator({
				root,
				lifetime,
				camera,
				layoutMetrics,
				doc: () => doc,
				mode: navigationMode,
				reduced,
				viewport: () => viewport,
				fromScreen,
				toScreen,
				panelScreen: (world) => inset(toScreen(world), pad()),
				setGesture(active) {
					gesture = active;
					zooming = active;
					if (active) {
						tween.stop();
						settledState = false;
					}
					updateInteractivity();
					schedule();
				},
				busy: () => dragActive(),
				gestureOwner(target) {
					const surface = target.closest?.("[data-trellis-part=surface]");
					if (!surface) return "chrome";
					return typeOf(surface.dataset.view).gestures ?? "content";
				},
				gestureKeys: () => ({
					...defaultGestureKeys(),
					...options.gestureKeys
				}),
				titleOf: (node) => node.kind === "panel" ? titleOf(node.selected) : node.kind === "stage" ? "the stage" : "this group",
				schedule,
				render: () => render(),
				changed() {
					for (const [id, dom] of panelDoms) setAttr(dom.el, "data-framed", nav.framed === id ? "" : null);
					events.emit("navigate", nav.framed);
					invalidate();
					emitChange();
				}
			});
			function setDocument(next, o = {}) {
				const prepared = prepare(next);
				commit(prepared, { animate: o.animate ?? true });
				nav.restore(prepared.navigation);
			}
			applyTheme();
			const ro = new ResizeObserver(() => {
				const w = host.clientWidth;
				const hh = host.clientHeight;
				if (w === viewport.w && hh === viewport.h) return;
				viewport = {
					w,
					h: hh
				};
				readMetrics();
				tween.stop();
				sync();
				render();
				schedule();
			});
			ro.observe(host);
			lifetime.add(() => ro.disconnect());
			if (reducedQuery) lifetime.listen(reducedQuery, "change", () => schedule());
			lifetime.listen(root, "pointerdown", (e) => {
				if (menu.open && !e.target.closest(".trellis-menu")) menu.close(false);
			});
			{
				doc = prepare(options.document ?? loadPersisted() ?? defaultDocument());
				sync();
				nav.restore(doc.navigation);
				camera.finish();
				const first = panelsOf(doc.root)[0] ?? doc.floating[0]?.panel;
				if (first) setFocus(first.selected, false);
				render();
			}
			const handle = {
				element: root,
				slots,
				open,
				close,
				focus: (id) => {
					const panel = locatePanel(doc, id)?.panel;
					const viewId = panel ? panel.selected : id;
					if (!doc.views[viewId]) return;
					reveal(viewId, true);
				},
				select: (viewId) => {
					const next = selectView(doc, viewId);
					if (next !== doc) commit(next, { animate: false });
				},
				hide,
				restore,
				float,
				dock,
				toggleDock,
				setTitle,
				setParams,
				navigation: {
					frame: (target) => nav.frame(target),
					toggle: (id) => {
						const target = id ?? focusedPanel;
						return target ? nav.toggle(resolvePanel(target)?.id ?? target) : false;
					},
					back: () => nav.back(),
					forward: () => nav.forward(),
					overview: () => nav.overview(),
					toggleOverview: () => nav.toggleOverview(),
					stepOut: () => nav.stepOut(),
					stepIn: () => nav.stepIn(),
					get framed() {
						return nav.framed;
					},
					get camera() {
						return { ...camera.value };
					},
					framings: nav.framings
				},
				run,
				getDocument,
				getLayoutRects: () => new Map(entries),
				setDocument,
				reset() {
					if (options.persist) try {
						localStorage.removeItem(options.persist.key);
					} catch {}
					setDocument(defaultDocument());
				},
				views: (filter) => viewIds(doc).map((id) => infoOf(id)).filter((v) => !filter?.type || v.type === filter.type),
				view: (id) => records.get(id)?.controller ?? null,
				surfaces: () => surfacesList,
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				getSnapshot,
				on: (event, handler) => events.on(event, handler),
				update(patch) {
					const typesChanged = patch.types && patch.types !== options.types;
					options = {
						...options,
						...patch
					};
					if ("theme" in patch || "tokens" in patch || "navigation" in patch || "label" in patch || "tabs" in patch) applyTheme();
					if ("navigation" in patch && !navigationMode()) nav.focus(null, false);
					if (typesChanged) {
						for (const record of records.values()) mountContent(record);
						for (const record of records.values()) record.controller.update({ title: titleOf(record.controller.id) });
					}
					sync();
					render();
				},
				destroy() {
					if (lifetime.disposed) return;
					dragger.cancel();
					for (const id of [...records.keys()]) destroySurface(id);
					lifetime.dispose();
					events.emit("surfaces", []);
					events.clear();
					listeners.clear();
				}
			};
			return handle;
		}
		function stableJson(value) {
			if (value === null || typeof value !== "object") return JSON.stringify(value);
			if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
			return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
		}
		//#endregion
		//#region node_modules/@danfessler/trellis-react/dist/index.js
		var useIsomorphicLayoutEffect = typeof window === "undefined" ? react.useEffect : react.useLayoutEffect;
		var WorkspaceContext = (0, react.createContext)(null);
		var ViewContext = (0, react.createContext)(null);
		var ProviderContext = (0, react.createContext)(null);
		function useView() {
			const view = (0, react.useContext)(ViewContext);
			if (!view) throw Error("Trellis: useView() must be used inside view content");
			const state = (0, react.useSyncExternalStore)(view.subscribe, view.getState, view.getState);
			return (0, react.useMemo)(() => ({
				...state,
				id: view.id,
				type: view.type,
				workspace: view.workspace,
				setTitle: (title) => view.setTitle(title),
				setParams: (patch) => view.setParams(patch),
				setBadge: (badge) => view.setBadge(badge),
				element: view.element,
				focus: () => view.focus(),
				close: (options) => view.close(options),
				hide: () => view.hide(),
				guardClose: (guard) => view.guardClose(guard),
				on: ((event, handler) => view.on(event, handler)),
				subscribe: view.subscribe,
				getState: view.getState
			}), [view, state]);
		}
		function ViewType(_props) {
			return null;
		}
		function Split(_props) {
			return null;
		}
		function Panel(_props) {
			return null;
		}
		function View(_props) {
			return null;
		}
		function Stage(_props) {
			return null;
		}
		function Floating(_props) {
			return null;
		}
		function Empty(_props) {
			return null;
		}
		function Backdrop(_props) {
			return null;
		}
		function StageEmpty(_props) {
			return null;
		}
		function Chrome(_props) {
			return null;
		}
		function flatten(children) {
			const out = [];
			react.Children.forEach(children, (child) => {
				if (!(0, react.isValidElement)(child)) return;
				if (child.type === react.Fragment) out.push(...flatten(child.props.children));
				else out.push(child);
			});
			return out;
		}
		function parse(children) {
			const parsed = {
				types: [],
				layout: null,
				floating: [],
				stage: null,
				empty: null,
				chrome: null,
				backdrop: null,
				stageEmpty: null
			};
			const layouts = [];
			const toSpec = (el) => {
				const props = el.props;
				if (el.type === View) return {
					kind: "view",
					type: props.type,
					id: props.id,
					params: props.params,
					title: props.title
				};
				if (el.type === Panel) return {
					kind: "panel",
					id: props.id,
					selected: props.selected,
					views: flatten(props.children).filter((c) => c.type === View).map((c) => toSpec(c))
				};
				if (el.type === Split) {
					const kids = flatten(props.children).map(toSpec).filter((x) => !!x);
					return {
						kind: "split",
						axis: props.axis ?? "x",
						weights: props.weights,
						id: props.id,
						children: kids
					};
				}
				if (el.type === Stage) {
					parsed.stage = props;
					const kids = flatten(props.children).map(toSpec).filter((x) => !!x);
					const child = kids.length > 1 ? {
						kind: "split",
						axis: "x",
						children: kids
					} : kids[0];
					return {
						kind: "stage",
						id: props.id,
						child
					};
				}
				return null;
			};
			for (const el of flatten(children)) if (el.type === ViewType) parsed.types.push(el.props);
			else if (el.type === Empty) parsed.empty = el.props.children;
			else if (el.type === Chrome) parsed.chrome = el.props.children;
			else if (el.type === Backdrop) parsed.backdrop = el.props.children;
			else if (el.type === StageEmpty) parsed.stageEmpty = el.props.children;
			else if (el.type === Floating) {
				const props = el.props;
				const inner = flatten(props.children).map(toSpec)[0];
				if (inner && (inner.kind === "panel" || inner.kind === "view")) parsed.floating.push({
					panel: inner,
					rect: props.rect,
					layer: props.layer
				});
			} else {
				const spec = toSpec(el);
				if (spec) layouts.push(spec);
			}
			parsed.layout = layouts.length > 1 ? {
				kind: "split",
				axis: "x",
				children: layouts
			} : layouts[0] ?? null;
			return parsed;
		}
		function isMarkup(icon) {
			return typeof icon === "string";
		}
		function WorkspaceImpl(props, forwarded) {
			const host = (0, react.useRef)(null);
			const [ws, setWs] = (0, react.useState)(null);
			const parsed = parse(props.children);
			const latest = (0, react.useRef)({
				props,
				parsed
			});
			latest.current = {
				props,
				parsed
			};
			const wrappers = (0, react.useRef)(/* @__PURE__ */ new Map());
			const wrap = (id, field) => {
				const key = `${id}\0${field}`;
				let fn = wrappers.current.get(key);
				if (!fn) {
					fn = (...args) => {
						const value = latest.current.parsed.types.find((x) => x.id === id)?.[field];
						return typeof value === "function" ? value(...args) : value;
					};
					wrappers.current.set(key, fn);
				}
				return fn;
			};
			const toDefinition = (t) => ({
				placement: t.placement,
				allow: t.allow,
				singleton: t.singleton,
				closable: t.closable,
				minSize: t.minSize,
				scaling: t.scaling,
				tabbar: t.tabbar,
				gestures: t.gestures,
				className: t.className,
				icon: isMarkup(t.icon) ? t.icon : void 0,
				title: typeof t.title === "function" ? wrap(t.id, "title") : t.title,
				iframe: typeof t.iframe === "function" ? wrap(t.id, "iframe") : t.iframe,
				mount: t.mount ? wrap(t.id, "mount") : void 0,
				menu: t.menu === void 0 ? void 0 : wrap(t.id, "menu")
			});
			const typesKey = parsed.types.map((t) => JSON.stringify([
				t.id,
				typeof t.title === "function" ? "ƒ" : t.title,
				isMarkup(t.icon) ? t.icon : "",
				typeof t.iframe === "function" ? "ƒ" : JSON.stringify(t.iframe ?? null),
				!!t.mount,
				t.menu === void 0,
				t.placement,
				t.allow,
				t.singleton,
				t.closable,
				t.minSize,
				t.scaling,
				t.tabbar,
				t.gestures,
				t.className
			])).join("\n");
			const panelMenuOption = (value) => typeof value === "function" ? (entries, context) => {
				const current = latest.current.props.panelMenu;
				return typeof current === "function" ? current(entries, context) : entries;
			} : value;
			const renderMenuOption = (request) => latest.current.props.renderMenu?.(request);
			const buildTypes = () => {
				const out = {};
				for (const t of latest.current.parsed.types) out[t.id] = toDefinition(t);
				return out;
			};
			useIsomorphicLayoutEffect(() => {
				const { props: p, parsed: initial } = latest.current;
				const handle = createWorkspace(host.current, {
					types: buildTypes(),
					floating: p.floating,
					navigation: p.navigation,
					motion: p.motion,
					theme: p.theme,
					tokens: p.tokens,
					keymap: p.keymap,
					panelMenu: panelMenuOption(p.panelMenu),
					renderMenu: p.renderMenu ? renderMenuOption : void 0,
					detail: p.detail,
					keepPushed: p.keepPushed,
					gestureKeys: p.gestureKeys,
					tabs: p.tabs,
					label: p.label,
					document: p.document,
					defaultLayout: initial.layout || initial.floating.length ? createDocument(initial.layout, { floating: initial.floating }) : p.defaultLayout ?? null,
					persist: p.storageKey ? {
						key: p.storageKey,
						version: p.version
					} : void 0,
					onMissingType: (type, id) => latest.current.props.onMissingType?.(type, id) ?? "placeholder",
					hideToward: (panelId) => latest.current.props.hideToward?.(panelId)
				});
				const offs = [
					handle.on("change", (doc) => {
						lastEmitted.current = doc;
						latest.current.props.onDocumentChange?.(doc);
					}),
					handle.on("open", (v) => latest.current.props.onOpen?.(v)),
					handle.on("close", (v) => latest.current.props.onClose?.(v)),
					handle.on("focus", (v) => latest.current.props.onFocus?.(v)),
					handle.on("navigate", (v) => latest.current.props.onNavigate?.(v))
				];
				setWs(handle);
				return () => {
					offs.forEach((off) => off());
					handle.destroy();
					setWs(null);
				};
			}, []);
			const lastEmitted = (0, react.useRef)(void 0);
			useIsomorphicLayoutEffect(() => {
				if (!ws || !props.document) return;
				if (props.document === lastEmitted.current) return;
				lastEmitted.current = props.document;
				ws.setDocument(props.document);
			}, [ws, props.document]);
			const tokensKey = JSON.stringify(props.tokens ?? {});
			const keymapKey = JSON.stringify(props.keymap ?? {});
			useIsomorphicLayoutEffect(() => {
				if (!ws) return;
				ws.update({
					floating: props.floating,
					navigation: props.navigation,
					motion: props.motion,
					theme: props.theme,
					tokens: props.tokens,
					keymap: props.keymap,
					panelMenu: panelMenuOption(props.panelMenu),
					renderMenu: props.renderMenu ? renderMenuOption : void 0,
					detail: props.detail,
					keepPushed: props.keepPushed,
					gestureKeys: props.gestureKeys,
					label: props.label,
					tabs: props.tabs
				});
			}, [
				ws,
				props.floating,
				props.navigation,
				props.motion,
				props.theme,
				tokensKey,
				keymapKey,
				typeof props.panelMenu === "function" ? "function" : props.panelMenu,
				!!props.renderMenu,
				JSON.stringify(props.detail ?? null),
				props.keepPushed,
				JSON.stringify(props.gestureKeys ?? null),
				props.label,
				props.tabs?.fill,
				props.tabs?.inset
			]);
			useIsomorphicLayoutEffect(() => {
				if (ws) ws.update({ types: buildTypes() });
			}, [ws, typesKey]);
			(0, react.useImperativeHandle)(forwarded ?? props.ref, () => ws, [ws]);
			const setProvided = (0, react.useContext)(ProviderContext)?.set;
			useIsomorphicLayoutEffect(() => {
				if (!setProvided) return;
				setProvided(ws);
				return () => setProvided(null);
			}, [setProvided, ws]);
			const surfaces = (0, react.useSyncExternalStore)((notify) => ws ? ws.on("surfaces", notify) : () => {}, () => ws ? ws.surfaces() : noSurfaces, () => noSurfaces);
			const typeById = new Map(parsed.types.map((t) => [t.id, t]));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(WorkspaceContext.Provider, {
				value: ws,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: host,
						className: props.className,
						style: {
							width: "100%",
							height: "100%",
							...props.style
						},
						"data-trellis-host": ""
					}),
					ws && surfaces.map((surface) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SurfacePortal, {
						surface,
						type: typeById.get(surface.view.type)
					}, surface.view.id)),
					ws && (parsed.stage?.backdrop ?? parsed.backdrop) != null && (0, react_dom.createPortal)(parsed.stage?.backdrop ?? parsed.backdrop, ws.slots.backdrop),
					ws && (parsed.stage?.empty ?? parsed.stageEmpty) != null && (0, react_dom.createPortal)(parsed.stage?.empty ?? parsed.stageEmpty, ws.slots.stageEmpty),
					ws && parsed.empty != null && (0, react_dom.createPortal)(parsed.empty, ws.slots.empty),
					ws && parsed.chrome != null && (0, react_dom.createPortal)(parsed.chrome, ws.slots.chrome)
				]
			});
		}
		var Workspace = Object.assign((0, react.forwardRef)(WorkspaceImpl), {
			Empty,
			Chrome,
			Backdrop,
			StageEmpty
		});
		var noSurfaces = [];
		function SurfacePortal({ surface, type }) {
			const view = surface.view;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(ViewContext.Provider, {
				value: view,
				children: [
					type && !type.iframe && !type.mount && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Content, { type }), surface.content, view.id),
					type && type.icon != null && !isMarkup(type.icon) && (0, react_dom.createPortal)(type.icon, surface.icon),
					type?.accessory != null && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Accessory, { type }), surface.accessory)
				]
			});
		}
		function Content({ type }) {
			if (type.render) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RenderWithView, { render: type.render });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: type.children });
		}
		function RenderWithView({ render }) {
			const view = useView();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: render(view) });
		}
		function Accessory({ type }) {
			if (typeof type.accessory === "function") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RenderWithView, { render: type.accessory });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: type.accessory });
		}
		//#endregion
		//#region \0dsh-css:D:\000_AI_Workspace\01_Projects\Project-DSH-NewType\plugin\dsh-newtype\node_modules\@danfessler\trellis\dist\style.css.mjs
		const css$1 = "/* Trellis — workspace chrome. Every rule is low-specificity (:where) so your CSS wins. */\n\n:where(.trellis) {\n  /* Metrics */\n  --trellis-gap: 6px;\n  --trellis-radius: 10px;\n  --trellis-tab-radius: 7px;\n  --trellis-tabbar-height: 34px;\n  --trellis-font: ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif;\n  --trellis-font-size: 12.5px;\n  --trellis-tab-max-width: 220px;\n  --trellis-tab-inset: 4px;\n\n  /* Colors: light */\n  --trellis-bg: #dfe0e4;\n  --trellis-panel: #ffffff;\n  --trellis-tabbar: #f1f1f4;\n  --trellis-tab-hover: rgba(15, 17, 25, 0.05);\n  --trellis-tab-active: #ffffff;\n  --trellis-text: #1c1d22;\n  --trellis-text-muted: #636670;\n  --trellis-border: rgba(15, 17, 25, 0.1);\n  --trellis-accent: #3a6ff7;\n  --trellis-accent-contrast: #ffffff;\n  --trellis-stage: #eceef1;\n  --trellis-slot: #cdd0d6;\n  --trellis-menu: #ffffff;\n  --trellis-menu-hover: rgba(15, 17, 25, 0.06);\n  --trellis-shadow-float: 0 1px 2px rgba(10, 12, 20, 0.08), 0 12px 32px -8px rgba(10, 12, 20, 0.22);\n  --trellis-shadow-lifted: 0 2px 4px rgba(10, 12, 20, 0.1), 0 24px 48px -12px rgba(10, 12, 20, 0.35);\n  --trellis-focus-ring: 0 0 0 2px var(--trellis-accent);\n\n  /* Motion */\n  --trellis-ease: cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n:where(.trellis[data-theme=\"medium\"]) {\n  --trellis-slot: #2c2c30;\n  --trellis-bg: #1f1f22;\n  --trellis-panel: #45454a;\n  --trellis-tabbar: #38383c;\n  --trellis-tab-hover: rgba(255, 255, 255, 0.06);\n  --trellis-tab-active: #45454a;\n  --trellis-text: #f1f1f3;\n  --trellis-text-muted: #bcbcc3;\n  --trellis-border: rgba(0, 0, 0, 0.28);\n  --trellis-accent: #4d8bff;\n  --trellis-stage: #2a2a2e;\n  --trellis-menu: #3a3a3f;\n  --trellis-menu-hover: rgba(255, 255, 255, 0.08);\n  --trellis-shadow-float: 0 1px 2px rgba(0, 0, 0, 0.3), 0 16px 40px -8px rgba(0, 0, 0, 0.55);\n  --trellis-shadow-lifted: 0 2px 6px rgba(0, 0, 0, 0.35), 0 28px 56px -12px rgba(0, 0, 0, 0.7);\n}\n:where(.trellis[data-theme=\"dark\"]) {\n  --trellis-slot: #1f2024;\n  --trellis-bg: #0c0d0f;\n  --trellis-panel: #1a1b1f;\n  --trellis-tabbar: #141518;\n  --trellis-tab-hover: rgba(255, 255, 255, 0.05);\n  --trellis-tab-active: #1a1b1f;\n  --trellis-text: #e7e8eb;\n  --trellis-text-muted: #9699a3;\n  --trellis-border: rgba(255, 255, 255, 0.07);\n  --trellis-accent: #5b8cff;\n  --trellis-stage: #111215;\n  --trellis-menu: #202126;\n  --trellis-menu-hover: rgba(255, 255, 255, 0.07);\n  --trellis-shadow-float: 0 1px 2px rgba(0, 0, 0, 0.4), 0 16px 40px -8px rgba(0, 0, 0, 0.7);\n  --trellis-shadow-lifted: 0 2px 6px rgba(0, 0, 0, 0.45), 0 28px 60px -12px rgba(0, 0, 0, 0.85);\n}\n:where(.trellis[data-theme=\"darker\"]) {\n  --trellis-slot: #15161a;\n  --trellis-bg: #050506;\n  --trellis-panel: #111215;\n  --trellis-tabbar: #0b0c0e;\n  --trellis-tab-hover: rgba(255, 255, 255, 0.045);\n  --trellis-tab-active: #111215;\n  --trellis-text: #d9dbe0;\n  --trellis-text-muted: #8a8e98;\n  --trellis-border: rgba(255, 255, 255, 0.06);\n  --trellis-accent: #5b8cff;\n  --trellis-stage: #09090b;\n  --trellis-menu: #17181b;\n  --trellis-menu-hover: rgba(255, 255, 255, 0.06);\n  --trellis-shadow-float: 0 1px 2px rgba(0, 0, 0, 0.5), 0 16px 40px -8px rgba(0, 0, 0, 0.8);\n  --trellis-shadow-lifted: 0 2px 6px rgba(0, 0, 0, 0.5), 0 28px 60px -12px rgba(0, 0, 0, 0.9);\n}\n@media (prefers-color-scheme: dark) {\n  :where(.trellis[data-theme=\"system\"]) {\n    --trellis-slot: #1f2024;\n    --trellis-bg: #0c0d0f;\n    --trellis-panel: #1a1b1f;\n    --trellis-tabbar: #141518;\n    --trellis-tab-hover: rgba(255, 255, 255, 0.05);\n    --trellis-tab-active: #1a1b1f;\n    --trellis-text: #e7e8eb;\n    --trellis-text-muted: #9699a3;\n    --trellis-border: rgba(255, 255, 255, 0.07);\n    --trellis-accent: #5b8cff;\n    --trellis-stage: #111215;\n    --trellis-menu: #202126;\n    --trellis-menu-hover: rgba(255, 255, 255, 0.07);\n    --trellis-shadow-float: 0 1px 2px rgba(0, 0, 0, 0.4), 0 16px 40px -8px rgba(0, 0, 0, 0.7);\n    --trellis-shadow-lifted: 0 2px 6px rgba(0, 0, 0, 0.45), 0 28px 60px -12px rgba(0, 0, 0, 0.85);\n  }\n}\n\n/* ------------------------------------------------------------------ root */\n:where(.trellis) {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  contain: strict;\n  isolation: isolate;\n  background: var(--trellis-bg);\n  color: var(--trellis-text);\n  font-family: var(--trellis-font);\n  font-size: var(--trellis-font-size);\n  line-height: 1.3;\n  -webkit-font-smoothing: antialiased;\n  box-sizing: border-box;\n}\n:where(.trellis) :where(*:not([data-trellis-part=\"content\"] *)),\n:where(.trellis) :where(*:not([data-trellis-part=\"content\"] *))::before,\n:where(.trellis) :where(*:not([data-trellis-part=\"content\"] *))::after {\n  box-sizing: border-box;\n}\n:where(.trellis:focus) {\n  outline: none;\n}\n:where(.trellis[data-dragging]) {\n  cursor: grabbing;\n  user-select: none;\n  -webkit-user-select: none;\n}\n:where(.trellis[data-resizing=\"x\"]) {\n  cursor: col-resize;\n  user-select: none;\n}\n:where(.trellis[data-resizing=\"y\"]) {\n  cursor: row-resize;\n  user-select: none;\n}\n:where(.trellis[data-resizing=\"float\"]) {\n  user-select: none;\n}\n:where(.trellis-layer, .trellis-dividers) {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n}\n:where(.trellis-sr) {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip-path: inset(50%);\n  white-space: nowrap;\n}\n\n/* ------------------------------------------------------------------ slots */\n:where(.trellis [data-trellis-part=\"backdrop\"], .trellis [data-trellis-part=\"stage-empty\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  border-radius: var(--trellis-radius);\n  overflow: hidden;\n}\n:where(.trellis [data-trellis-part=\"backdrop\"]) {\n  z-index: 1;\n  background: var(--trellis-stage);\n}\n:where(.trellis:not([data-has-stage]) [data-trellis-part=\"backdrop\"]) {\n  background: transparent;\n  border-radius: 0;\n}\n:where(.trellis [data-trellis-part=\"stage-empty\"]) {\n  z-index: 2;\n  display: grid;\n  place-items: center;\n  pointer-events: none;\n}\n:where(.trellis [data-trellis-part=\"stage-empty\"] > *) {\n  pointer-events: auto;\n}\n:where(.trellis [data-trellis-part=\"empty\"]) {\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  display: grid;\n  place-items: center;\n}\n:where(.trellis [data-trellis-part=\"chrome\"]) {\n  position: absolute;\n  inset: 0;\n  z-index: 4000;\n  pointer-events: none;\n}\n:where(.trellis [data-trellis-part=\"chrome\"] > *) {\n  pointer-events: auto;\n}\n\n/* ------------------------------------------------------------------ panels */\n:where(.trellis [data-trellis-part=\"panel\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  pointer-events: auto;\n  background: var(--trellis-panel);\n  border-radius: var(--trellis-radius);\n  box-shadow: 0 0 0 1px var(--trellis-border);\n  will-change: transform;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-floating]) {\n  box-shadow:\n    0 0 0 1px var(--trellis-border),\n    var(--trellis-shadow-float);\n}\n:where(.trellis[data-dragging] [data-trellis-part=\"panel\"][data-floating]) {\n  box-shadow:\n    0 0 0 1px var(--trellis-border),\n    var(--trellis-shadow-float);\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-lifted]) {\n  box-shadow:\n    0 0 0 1px var(--trellis-border),\n    var(--trellis-shadow-lifted);\n}\n:where(.trellis [data-appearing]) {\n  animation: trellis-appear 220ms var(--trellis-ease) both;\n}\n@keyframes trellis-appear {\n  from {\n    opacity: 0;\n    scale: 0.97;\n  }\n}\n\n/* ------------------------------------------------------------------ tab bar */\n/* Two independent tab options (the `tabs` workspace option):\n * - fill (data-tab-fill on the root): tabs grow to share the tab row's width. Nothing else changes.\n * - inset (--trellis-tab-inset, data-tab-bleed at 0): the space between the tabs and the bar's\n *   top and sides. At 0 the tabs meet the bar's edges.\n * Neither affects the accessories or the panel menu button, which always sit on the bar itself. */\n:where(.trellis [data-trellis-part=\"tabbar\"]) {\n  position: absolute;\n  inset: 0 0 auto 0;\n  height: var(--trellis-tabbar-height);\n  display: flex;\n  align-items: stretch;\n  gap: 2px;\n  padding: 0 2px 0 0;\n  background: var(--trellis-tabbar);\n  border-radius: var(--trellis-radius) var(--trellis-radius) 0 0;\n  box-shadow: inset 0 -1px 0 var(--trellis-border);\n  user-select: none;\n  -webkit-user-select: none;\n  cursor: default;\n  overflow: hidden;\n  touch-action: none;\n}\n:where(.trellis [data-trellis-part=\"tabs\"]) {\n  display: flex;\n  align-items: stretch;\n  gap: 2px;\n  min-width: 0;\n  flex: 1 1 auto;\n  padding: var(--trellis-tab-inset) var(--trellis-tab-inset) 0;\n  /* Room at the end for the selected tab's flared corner, which reaches past the tab. Without it\n   * the flare overflows the row, which then scrolls a few pixels and shifts every tab left. */\n  padding-inline-end: max(var(--trellis-tab-inset), var(--trellis-tab-radius));\n  overflow-x: auto;\n  overflow-y: hidden;\n  scrollbar-width: none;\n}\n:where(.trellis [data-trellis-part=\"tabs\"])::-webkit-scrollbar {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"tab\"]) {\n  position: relative;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 72px;\n  max-width: var(--trellis-tab-max-width);\n  flex: 0 1 auto;\n  padding: 0 6px 0 10px;\n  border-radius: var(--trellis-tab-radius) var(--trellis-tab-radius) 0 0;\n  color: var(--trellis-text-muted);\n  font-weight: 500;\n  white-space: nowrap;\n  cursor: default;\n  outline: none;\n  transition:\n    background-color 120ms,\n    color 120ms;\n}\n/* The right padding assumes the close button's own space; without one, match the left. */\n:where(.trellis [data-trellis-part=\"tab\"]:has(> [data-trellis-part=\"tab-close\"][hidden])) {\n  padding-right: 10px;\n}\n:where(.trellis [data-trellis-part=\"tab\"]:hover) {\n  background: var(--trellis-tab-hover);\n  color: var(--trellis-text);\n}\n/* The selected tab joins the content below it: same fill, flared bottom corners, and it covers\n * the bar's bottom border. */\n:where(.trellis [data-trellis-part=\"tab\"][data-selected]) {\n  z-index: 1;\n  background: var(--trellis-tab-active);\n  color: var(--trellis-text);\n  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--trellis-text) 7%, transparent);\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-selected])::before,\n:where(.trellis [data-trellis-part=\"tab\"][data-selected])::after {\n  content: \"\";\n  position: absolute;\n  bottom: 0;\n  width: var(--trellis-tab-radius);\n  height: var(--trellis-tab-radius);\n  pointer-events: none;\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-selected])::before {\n  right: 100%;\n  background: radial-gradient(\n    circle at 0 0,\n    transparent var(--trellis-tab-radius),\n    var(--trellis-tab-active) calc(var(--trellis-tab-radius) + 0.5px)\n  );\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-selected])::after {\n  left: 100%;\n  background: radial-gradient(\n    circle at 100% 0,\n    transparent var(--trellis-tab-radius),\n    var(--trellis-tab-active) calc(var(--trellis-tab-radius) + 0.5px)\n  );\n}\n/* The focused panel's selected tab carries the accent along its top. */\n:where(.trellis [data-trellis-part=\"panel\"][data-focused] [data-trellis-part=\"tab\"][data-selected]),\n:where(.trellis [data-trellis-part=\"tabbar\"][data-focused] [data-trellis-part=\"tab\"][data-selected]) {\n  background:\n    linear-gradient(var(--trellis-accent), var(--trellis-accent)) center top / 100% 2px no-repeat,\n    var(--trellis-tab-active);\n}\n:where(.trellis [data-trellis-part=\"tab\"]:focus-visible) {\n  box-shadow: inset var(--trellis-focus-ring);\n}\n/* Reordering within the strip: neighbours slide, the dragged tab rides on top. */\n:where(.trellis [data-trellis-part=\"tab\"][data-sorting]) {\n  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-dragging]) {\n  z-index: 2;\n  transition: none;\n  background: var(--trellis-tab-active);\n  color: var(--trellis-text);\n  cursor: grabbing;\n}\n/* Fill: tabs share the tab row's width. */\n:where(.trellis[data-tab-fill] [data-trellis-part=\"tab\"]) {\n  flex: 1 1 0;\n  max-width: none;\n}\n:where(.trellis [data-trellis-part=\"tab-icon\"]) {\n  display: inline-grid;\n  place-items: center;\n  width: 16px;\n  height: 16px;\n  flex: none;\n  color: inherit;\n}\n:where(.trellis [data-trellis-part=\"tab-icon\"]:empty) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"tab-icon\"] svg, .trellis [data-trellis-part=\"tab-icon\"] img) {\n  width: 16px;\n  height: 16px;\n}\n:where(.trellis [data-trellis-part=\"tab-title\"]) {\n  /* The title takes any spare width, so the close button always sits at the tab's right edge. */\n  flex: 1 1 auto;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n:where(.trellis [data-trellis-part=\"tab-badge\"]) {\n  flex: none;\n  min-width: 16px;\n  height: 16px;\n  padding: 0 5px;\n  border-radius: 8px;\n  background: var(--trellis-accent);\n  color: var(--trellis-accent-contrast);\n  font-size: 10px;\n  font-weight: 650;\n  line-height: 16px;\n  text-align: center;\n}\n:where(.trellis [data-trellis-part=\"tab-badge\"][data-dot]) {\n  min-width: 8px;\n  width: 8px;\n  height: 8px;\n  padding: 0;\n  border-radius: 50%;\n  background: var(--trellis-text-muted);\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-selected] [data-trellis-part=\"tab-badge\"][data-dot]) {\n  background: var(--trellis-text);\n}\n/* A dot (e.g. unsaved changes) sits where the close button is, and yields to it on hover. */\n:where(.trellis [data-trellis-part=\"tab\"][data-badge=\"dot\"]:not(:hover) [data-trellis-part=\"tab-close\"]) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-badge=\"dot\"]:hover [data-trellis-part=\"tab-badge\"]) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"tab\"][data-badge=\"dot\"] [data-trellis-part=\"tab-badge\"]) {\n  margin: 0 6px;\n}\n:where(.trellis [data-trellis-part=\"tab-close\"], .trellis [data-trellis-part=\"panel-menu\"]) {\n  flex: none;\n  display: inline-grid;\n  place-items: center;\n  width: 20px;\n  height: 20px;\n  padding: 0;\n  border: 0;\n  border-radius: 5px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  cursor: pointer;\n  opacity: 0.55;\n  transition:\n    opacity 120ms,\n    background-color 120ms;\n}\n:where(.trellis [data-trellis-part=\"tab-close\"]) {\n  opacity: 0;\n}\n:where(\n  .trellis [data-trellis-part=\"tab\"]:hover [data-trellis-part=\"tab-close\"],\n  .trellis [data-trellis-part=\"tab\"][data-selected] [data-trellis-part=\"tab-close\"]\n) {\n  opacity: 0.55;\n}\n:where(\n  .trellis [data-trellis-part=\"tab-close\"]:hover,\n  .trellis [data-trellis-part=\"panel-menu\"]:hover,\n  .trellis [data-trellis-part=\"panel-menu\"][aria-expanded=\"true\"]\n) {\n  opacity: 1;\n  background: var(--trellis-tab-hover);\n}\n:where(.trellis [data-trellis-part=\"tab-close\"] svg, .trellis [data-trellis-part=\"panel-menu\"] svg) {\n  width: 14px;\n  height: 14px;\n}\n:where(.trellis [data-trellis-part=\"panel-menu\"]) {\n  align-self: center;\n  margin-left: 2px;\n}\n:where(.trellis [data-trellis-part=\"accessories\"]) {\n  display: flex;\n  align-items: center;\n  flex: none;\n  gap: 4px;\n}\n:where(.trellis [data-trellis-part=\"accessory\"]) {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n:where(.trellis [data-trellis-part=\"accessory\"]:empty) {\n  display: none;\n}\n:where(.trellis [hidden]) {\n  display: none !important;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-tabbar=\"hidden\"] [data-trellis-part=\"tabbar\"]) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-compact] [data-trellis-part=\"tab-title\"]),\n:where(.trellis [data-trellis-part=\"panel\"][data-compact] [data-trellis-part=\"tab-close\"]),\n:where(.trellis [data-trellis-part=\"panel\"][data-compact] [data-trellis-part=\"accessories\"]),\n:where(.trellis [data-trellis-part=\"panel\"][data-compact] [data-trellis-part=\"tab-badge\"]) {\n  display: none;\n}\n\n/* ------------------------------------------------------------------ frame-only and overlay bars */\n/* Too small to use: the panel shows only its icon and the whole frame drags. */\n:where(.trellis [data-trellis-part=\"frame-icon\"]) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-frame-only]) {\n  cursor: grab;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-frame-only] [data-trellis-part=\"tabbar\"]) {\n  display: none;\n}\n:where(.trellis [data-trellis-part=\"panel\"][data-frame-only] [data-trellis-part=\"frame-icon\"]) {\n  position: absolute;\n  inset: 0;\n  display: grid;\n  place-items: center;\n  color: var(--trellis-text-muted);\n}\n:where(.trellis [data-trellis-part=\"frame-icon\"] > *) {\n  width: var(--trellis-frame-icon-size, 24px);\n  height: var(--trellis-frame-icon-size, 24px);\n  font-size: calc(var(--trellis-frame-icon-size, 24px) * 0.6);\n  display: grid;\n  place-items: center;\n}\n/* A split group too small on screen to show its panels (see the `detail` option): one tile with\n   lines for its first levels of splits. Double-click zooms to it. */\n:where(.trellis [data-trellis-part=\"group\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  overflow: hidden;\n  pointer-events: auto;\n  background: var(--trellis-panel);\n  border-radius: var(--trellis-radius);\n  box-shadow: 0 0 0 1px var(--trellis-border);\n  cursor: zoom-in;\n  will-change: transform;\n}\n:where(.trellis [data-trellis-part=\"group\"] > i) {\n  position: absolute;\n  background: var(--trellis-border);\n}\n:where(.trellis [data-trellis-part=\"group\"] > i[data-axis=\"x\"]) {\n  width: 1px;\n  margin-left: -0.5px;\n}\n:where(.trellis [data-trellis-part=\"group\"] > i[data-axis=\"y\"]) {\n  height: 1px;\n  margin-top: -0.5px;\n}\n/* An overlaid bar floats over content that draws its own title bar underneath. */\n:where(.trellis [data-trellis-part=\"tabbar\"][data-overlay]) {\n  inset: auto;\n  left: 0;\n  top: 0;\n  pointer-events: auto;\n  background: transparent;\n  box-shadow: none;\n}\n:where(.trellis [data-trellis-part=\"tabbar\"][data-overlay] [data-trellis-part=\"tab\"]) {\n  opacity: 0;\n}\n\n/* ------------------------------------------------------------------ surfaces */\n:where(.trellis [data-trellis-part=\"surface\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  overflow: hidden;\n  pointer-events: auto;\n  border-radius: 0 0 var(--trellis-radius) var(--trellis-radius);\n  background: var(--trellis-panel);\n  will-change: transform;\n}\n:where(.trellis [data-trellis-part=\"content\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  transform-origin: 0 0;\n  overflow: auto;\n  color: var(--trellis-text);\n}\n:where(.trellis [data-trellis-part=\"surface\"][data-scaled=\"inert\"] [data-trellis-part=\"content\"]),\n:where(.trellis[data-busy] [data-trellis-part=\"content\"]) {\n  pointer-events: none;\n  user-select: none;\n}\n:where(.trellis [data-trellis-iframe]) {\n  display: block;\n  width: 100%;\n  height: 100%;\n  border: 0;\n  background: transparent;\n}\n:where(.trellis .trellis-placeholder) {\n  display: grid;\n  place-content: center;\n  gap: 4px;\n  height: 100%;\n  padding: 24px;\n  text-align: center;\n  color: var(--trellis-text-muted);\n}\n:where(.trellis .trellis-placeholder strong) {\n  color: var(--trellis-text);\n  font-weight: 600;\n}\n\n/* Without a bar above it, a surface rounds all four corners. (After the base surface rule:\n * both have zero specificity, so order decides.) */\n:where(.trellis [data-trellis-part=\"surface\"][data-tabbar=\"overlay\"]) {\n  border-radius: var(--trellis-radius);\n}\n:where(.trellis [data-trellis-part=\"surface\"][data-tabbar=\"hidden\"]) {\n  border-radius: var(--trellis-radius);\n}\n\n/* ------------------------------------------------------------------ dividers */\n:where(.trellis [data-trellis-part=\"divider\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  z-index: 20;\n  pointer-events: auto;\n  touch-action: none;\n  outline: none;\n}\n:where(.trellis [data-trellis-part=\"divider\"][data-axis=\"x\"]) {\n  cursor: col-resize;\n}\n:where(.trellis [data-trellis-part=\"divider\"][data-axis=\"y\"]) {\n  cursor: row-resize;\n}\n:where(.trellis [data-trellis-part=\"divider\"])::after {\n  content: \"\";\n  position: absolute;\n  border-radius: 2px;\n  background: var(--trellis-accent);\n  opacity: 0;\n  transition: opacity 120ms;\n}\n:where(.trellis [data-trellis-part=\"divider\"][data-axis=\"x\"])::after {\n  top: 0;\n  bottom: 0;\n  left: calc(50% - 1.5px);\n  width: 3px;\n}\n:where(.trellis [data-trellis-part=\"divider\"][data-axis=\"y\"])::after {\n  left: 0;\n  right: 0;\n  top: calc(50% - 1.5px);\n  height: 3px;\n}\n:where(.trellis [data-trellis-part=\"divider\"]:hover)::after {\n  opacity: 0.8;\n  transition-delay: 150ms;\n}\n:where(.trellis [data-trellis-part=\"divider\"][data-active])::after,\n:where(.trellis [data-trellis-part=\"divider\"]:focus-visible)::after {\n  opacity: 1;\n  transition-delay: 0ms;\n}\n:where(.trellis .trellis-dividers) {\n  z-index: 20;\n}\n\n/* ------------------------------------------------------------------ floating resize */\n:where(.trellis .trellis-handles) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  pointer-events: none;\n}\n:where(.trellis [data-trellis-part=\"resize\"]) {\n  position: absolute;\n  pointer-events: auto;\n  touch-action: none;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"n\"]) {\n  top: -4px;\n  left: 8px;\n  right: 8px;\n  height: 8px;\n  cursor: ns-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"s\"]) {\n  bottom: -4px;\n  left: 8px;\n  right: 8px;\n  height: 8px;\n  cursor: ns-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"e\"]) {\n  right: -4px;\n  top: 8px;\n  bottom: 8px;\n  width: 8px;\n  cursor: ew-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"w\"]) {\n  left: -4px;\n  top: 8px;\n  bottom: 8px;\n  width: 8px;\n  cursor: ew-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"ne\"]) {\n  right: -5px;\n  top: -5px;\n  width: 14px;\n  height: 14px;\n  cursor: nesw-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"nw\"]) {\n  left: -5px;\n  top: -5px;\n  width: 14px;\n  height: 14px;\n  cursor: nwse-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"se\"]) {\n  right: -5px;\n  bottom: -5px;\n  width: 14px;\n  height: 14px;\n  cursor: nwse-resize;\n}\n:where(.trellis [data-trellis-part=\"resize\"][data-dir=\"sw\"]) {\n  left: -5px;\n  bottom: -5px;\n  width: 14px;\n  height: 14px;\n  cursor: nesw-resize;\n}\n\n/* ------------------------------------------------------------------ drag slots */\n/* While dragging, the layout itself reflows to open a slot where the view will land. */\n:where(.trellis [data-trellis-part=\"drop-slot\"], .trellis [data-trellis-part=\"source-slot\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  display: none;\n  pointer-events: none;\n  border-radius: var(--trellis-radius);\n}\n:where(.trellis [data-trellis-part=\"source-slot\"][data-visible]) {\n  display: block;\n  z-index: 5;\n  background: transparent;\n}\n:where(.trellis [data-trellis-part=\"drop-slot\"]) {\n  display: grid;\n  place-items: center;\n  z-index: 3000;\n  background: var(--trellis-slot);\n  opacity: 0;\n  transition: opacity 140ms ease-out;\n}\n:where(.trellis [data-trellis-part=\"drop-slot\"][data-visible]) {\n  opacity: 1;\n}\n:where(.trellis [data-trellis-part=\"drop-slot\"][data-kind=\"tab\"]) {\n  background: color-mix(in srgb, var(--trellis-slot) 70%, transparent);\n  box-shadow: inset 0 0 0 2px var(--trellis-accent);\n}\n:where(.trellis [data-trellis-part=\"drop-label\"]) {\n  color: var(--trellis-text-muted);\n  font-weight: 550;\n}\n:where(.trellis[data-dragging] [data-trellis-part=\"content\"]) {\n  pointer-events: none;\n}\n\n/* ------------------------------------------------------------------ navigation feedback */\n:where(.trellis [data-trellis-part=\"snap-preview\"], .trellis [data-trellis-part=\"marquee-target\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  z-index: 3500;\n  display: none;\n  pointer-events: none;\n  border: 2px solid rgba(255, 255, 255, 0.6);\n  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.13);\n  border-radius: calc(var(--trellis-radius) + 3px);\n}\n:where(\n  .trellis [data-trellis-part=\"snap-preview\"][data-visible],\n  .trellis [data-trellis-part=\"marquee-target\"][data-visible]\n) {\n  display: block;\n}\n:where(.trellis [data-trellis-part=\"snap-preview\"] span, .trellis [data-trellis-part=\"marquee-target\"] span) {\n  position: absolute;\n  left: 50%;\n  top: 12px;\n  transform: translateX(-50%);\n  padding: 7px 11px;\n  border-radius: 20px;\n  background: rgba(40, 44, 40, 0.75);\n  backdrop-filter: blur(16px);\n  color: #fff;\n  font-size: 10px;\n  letter-spacing: 0.2px;\n  white-space: nowrap;\n}\n:where(.trellis [data-trellis-part=\"marquee\"]) {\n  position: absolute;\n  left: 0;\n  top: 0;\n  z-index: 3400;\n  display: none;\n  pointer-events: none;\n  border: 1px solid var(--trellis-accent);\n  background: color-mix(in srgb, var(--trellis-accent) 12%, transparent);\n  border-radius: 4px;\n}\n:where(.trellis[data-gesture=\"rect\"] [data-trellis-part=\"marquee\"]) {\n  display: block;\n}\n/* Gesture keys held: the whole workspace is a handle. Content (iframes included) ignores the\n   pointer, so a drag anywhere reaches the workspace, and the cursor says what a drag will do. */\n:where(\n  .trellis[data-gesture-key] [data-trellis-part=\"content\"],\n  .trellis[data-gesture] [data-trellis-part=\"content\"]\n) {\n  pointer-events: none;\n}\n:where(.trellis[data-gesture-key], .trellis[data-gesture]) {\n  user-select: none;\n}\n.trellis[data-gesture-key=\"pan\"],\n.trellis[data-gesture-key=\"pan\"] * {\n  cursor: grab !important;\n}\n.trellis[data-gesture=\"pan\"],\n.trellis[data-gesture=\"pan\"] * {\n  cursor: grabbing !important;\n}\n.trellis[data-gesture-key=\"rect\"],\n.trellis[data-gesture-key=\"rect\"] *,\n.trellis[data-gesture=\"rect\"],\n.trellis[data-gesture=\"rect\"] * {\n  cursor: crosshair !important;\n}\n.trellis[data-gesture-key=\"scale\"],\n.trellis[data-gesture-key=\"scale\"] *,\n.trellis[data-gesture=\"scale\"],\n.trellis[data-gesture=\"scale\"] * {\n  cursor: zoom-in !important;\n}\n\n/* ------------------------------------------------------------------ menu */\n:where(.trellis .trellis-menu) {\n  position: absolute;\n  z-index: 5000;\n  min-width: 190px;\n  max-width: 320px;\n  padding: 5px;\n  border-radius: 10px;\n  background: var(--trellis-menu);\n  color: var(--trellis-text);\n  box-shadow:\n    0 0 0 1px var(--trellis-border),\n    0 12px 32px -6px rgba(0, 0, 0, 0.3);\n  pointer-events: auto;\n  outline: none;\n  animation: trellis-menu 120ms var(--trellis-ease);\n}\n@keyframes trellis-menu {\n  from {\n    opacity: 0;\n    translate: 0 -3px;\n  }\n}\n:where(.trellis .trellis-menu-item) {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  height: 28px;\n  padding: 0 8px 0 4px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: default;\n  outline: none;\n}\n:where(\n  .trellis .trellis-menu-item:hover,\n  .trellis .trellis-menu-item:focus-visible,\n  .trellis .trellis-menu-item:focus\n) {\n  background: var(--trellis-menu-hover);\n}\n:where(.trellis .trellis-menu-item[aria-disabled=\"true\"]) {\n  opacity: 0.4;\n}\n:where(.trellis .trellis-menu-item.trellis-danger) {\n  color: #e5484d;\n}\n:where(.trellis .trellis-menu-check, .trellis .trellis-menu-chevron) {\n  display: inline-grid;\n  place-items: center;\n  width: 16px;\n  height: 16px;\n  flex: none;\n}\n:where(.trellis .trellis-menu-check svg, .trellis .trellis-menu-chevron svg) {\n  width: 14px;\n  height: 14px;\n}\n:where(.trellis .trellis-menu-label) {\n  flex: 1;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n:where(.trellis .trellis-menu-shortcut) {\n  color: var(--trellis-text-muted);\n  font-size: 11.5px;\n  letter-spacing: 0.02em;\n}\n:where(.trellis .trellis-menu-separator) {\n  height: 1px;\n  margin: 4px 6px;\n  background: var(--trellis-border);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  :where(.trellis [data-appearing], .trellis .trellis-menu) {\n    animation: none;\n  }\n  :where(.trellis [data-trellis-part=\"drop-slot\"]) {\n    transition: none;\n  }\n}\n\n/* Windows high contrast and other forced-color modes: box-shadows vanish, so draw real borders. */\n@media (forced-colors: active) {\n  :where(.trellis [data-trellis-part=\"panel\"]) {\n    border: 1px solid CanvasText;\n  }\n  :where(.trellis [data-trellis-part=\"tab\"][data-selected]) {\n    outline: 2px solid Highlight;\n    outline-offset: -2px;\n  }\n  :where(.trellis [data-trellis-part=\"drop-slot\"][data-visible]) {\n    border: 2px solid Highlight;\n  }\n  :where(.trellis [data-trellis-part=\"divider\"])::after {\n    background: Highlight;\n  }\n  :where(.trellis .trellis-menu) {\n    border: 1px solid CanvasText;\n  }\n}\n";
		const pluginId$1 = "@dsh-external/dsh-newtype-multititle";
		const tagId$1 = "@dsh-external/dsh-newtype-multititle/32ac7737";
		document.querySelectorAll("style[data-plugin=" + JSON.stringify(pluginId$1) + "][data-plugin-css=" + JSON.stringify(tagId$1) + "]").forEach((t) => t.remove());
		const tag$1 = document.createElement("style");
		tag$1.dataset.plugin = pluginId$1;
		tag$1.dataset.pluginCss = tagId$1;
		tag$1.textContent = css$1;
		document.head.appendChild(tag$1);
		//#endregion
		//#region \0dsh-css:D:\000_AI_Workspace\01_Projects\Project-DSH-NewType\plugin\dsh-newtype\src\client\newtype.module.css.mjs
		const css = ".ci3c5a_minitabs{flex:none;gap:2px;padding:6px 8px 0;display:flex}.ci3c5a_minitab{height:24px;color:var(--dsh-text-secondary,#86827e);cursor:pointer;background:0 0;border:0;border-radius:5px;padding:0 8px;font-size:11px}.ci3c5a_minitab:hover{color:var(--dsh-text,#f4f2f0);background:var(--dsh-surface,#1e1c1a)}.ci3c5a_minitabOn{color:var(--dsh-text,#f4f2f0);background:var(--dsh-surface,#232120);box-shadow:inset 0 2px 0 var(--dsh-primary,#69a1e8)}.ci3c5a_minitabRight{align-items:center;margin-left:auto;display:flex}.ci3c5a_gowork{border:1px solid var(--dsh-line,#262422);height:22px;color:var(--dsh-text-secondary,#86827e);cursor:pointer;background:0 0;border-radius:5px;padding:0 8px;font-size:11px}.ci3c5a_gowork:hover{color:var(--dsh-text,#f4f2f0);border-color:var(--dsh-primary,#69a1e8)}.ci3c5a_pif{background:#fff;border:0;flex:1;width:100%;height:100%}.ci3c5a_ic{stroke:currentColor;fill:none;stroke-width:1.5px;stroke-linecap:round;stroke-linejoin:round;width:15px;height:15px;display:block}.ci3c5a_spin{transform-box:fill-box;transform-origin:50%;animation:1.1s linear infinite ci3c5a_nt-spin}@keyframes ci3c5a_nt-spin{to{transform:rotate(360deg)}}.ci3c5a_wbWrap{flex-direction:row;flex:1 1 0;width:100%;height:100%;min-height:0;display:flex;overflow:hidden}.ci3c5a_wbMain{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.ci3c5a_wbRight{opacity:0;visibility:hidden;border-left:1px solid #0000;flex-direction:column;flex:none;width:0;min-height:0;transition:width .24s cubic-bezier(.2,.7,.3,1),opacity .18s,visibility 0s linear .24s;display:flex;overflow:hidden}.ci3c5a_wbRightOn{opacity:1;visibility:visible;border-left:1px solid var(--dsh-line,#262422);background:var(--dsh-bg,#131110);width:264px;transition:width .24s cubic-bezier(.2,.7,.3,1),opacity .18s}.ci3c5a_wbRight .ci3c5a_panel{flex:1;min-height:0}.ci3c5a_wbRight .ci3c5a_hd{flex:none}.ci3c5a_ptabIco{color:var(--dsh-primary,#69a1e8);flex:none;place-items:center;display:grid}.ci3c5a_ptabIco .ci3c5a_ic{width:11px;height:11px}.ci3c5a_stbar{background:var(--dsh-overlay,#1b1917);border-top:1px solid var(--dsh-line,#262422);height:22px;color:var(--dsh-text-secondary,#86827e);z-index:9999;pointer-events:auto;align-items:center;gap:14px;padding:0 10px;font:11px/22px Geist Variable,Inter,system-ui,Microsoft YaHei,sans-serif;display:flex;position:fixed;bottom:0;left:0;right:0}.ci3c5a_stbBrand{color:var(--dsh-text,#f4f2f0);letter-spacing:.04em}.ci3c5a_stbR{gap:14px;margin-left:auto;display:flex}.ci3c5a_pane{background:var(--dsh-bg,#131110);flex-direction:column;flex:1;min-width:0;min-height:0;display:flex;position:relative;overflow:hidden}.ci3c5a_paneFocused .ci3c5a_ptabs{box-shadow:inset 0 -1px 0 var(--dsh-primary,#69a1e8)}.ci3c5a_ptabs{background:var(--dsh-overlay,#1b1917);border-bottom:1px solid var(--dsh-line,#262422);scrollbar-width:none;flex:none;align-items:center;gap:2px;height:34px;padding:0 6px;display:flex;overflow-x:auto}.ci3c5a_ptab{height:25px;color:var(--dsh-text-secondary,#86827e);cursor:pointer;user-select:none;border-radius:5px;flex:none;align-items:center;gap:5px;max-width:200px;padding:0 5px 0 10px;font-size:12px;display:flex}.ci3c5a_ptab:hover{color:var(--dsh-text,#f4f2f0);background:var(--dsh-surface,#1e1c1a)}.ci3c5a_ptabOn{color:var(--dsh-text,#f4f2f0);background:var(--dsh-surface,#232120);box-shadow:inset 0 2px 0 var(--dsh-primary,#69a1e8)}.ci3c5a_ptabT{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.ci3c5a_ptabX{width:16px;height:16px;color:inherit;cursor:pointer;opacity:0;background:0 0;border:0;border-radius:4px;place-items:center;padding:0;display:grid}.ci3c5a_ptabX:hover{background:var(--dsh-line,#262422);color:var(--dsh-text,#f4f2f0)}.ci3c5a_ptab:hover .ci3c5a_ptabX,.ci3c5a_ptabOn .ci3c5a_ptabX{opacity:1}.ci3c5a_ptabX .ci3c5a_ic{width:11px;height:11px}.ci3c5a_paneActions{flex:none;align-items:center;margin-left:auto;display:flex}.ci3c5a_icbtn{width:22px;height:22px;color:var(--dsh-text-secondary,#86827e);cursor:pointer;background:0 0;border:0;border-radius:5px;place-items:center;padding:0;display:grid}.ci3c5a_icbtn:hover{background:var(--dsh-surface,#1e1c1a);color:var(--dsh-text,#f4f2f0)}.ci3c5a_icbtn .ci3c5a_ic{width:13px;height:13px}.ci3c5a_pbody{flex-direction:column;flex:1;min-height:0;display:flex}.ci3c5a_pempty{color:var(--dsh-faint,#5b5854);text-align:center;max-width:220px;margin:auto;padding:16px;font-size:12px}.ci3c5a_perr{color:#c97b7b;text-align:center;margin:auto;padding:16px;font-size:12px}.ci3c5a_hconvRoot{flex-direction:column;flex:1 1 0;height:100%;min-height:0;display:flex;overflow:hidden}.ci3c5a_pgPanel{background:var(--dsh-bg,#131110);flex-direction:column;flex:1 1 0;width:100%;height:100%;min-height:0;display:flex}.ci3c5a_pgHead{border-bottom:1px solid var(--dsh-line,#262422);background:var(--dsh-overlay,#1b1917);flex:none;align-items:center;gap:8px;height:34px;padding:0 12px;display:flex}.ci3c5a_pgTitle{color:var(--dsh-text,#f4f2f0);font-size:12px}.ci3c5a_pgBadge{color:var(--dsh-primary,#69a1e8);font-size:11px}.ci3c5a_pgClear{border:1px solid var(--dsh-line,#262422);height:20px;color:var(--dsh-text-secondary,#86827e);cursor:pointer;background:0 0;border-radius:5px;margin-left:auto;padding:0 8px;font-size:11px}.ci3c5a_pgClear:hover{color:var(--dsh-text,#f4f2f0);border-color:var(--dsh-primary,#69a1e8)}.ci3c5a_pgList{flex:1;min-height:0;padding:6px 0;overflow-y:auto}.ci3c5a_pgRow{height:26px;color:var(--dsh-text,#f4f2f0);cursor:pointer;align-items:center;gap:7px;padding:0 12px;font-size:12.5px;display:flex}.ci3c5a_pgRow:hover{background:var(--dsh-surface,#1e1c1a)}.ci3c5a_pgRow .ci3c5a_ic{width:13px;height:13px;color:var(--dsh-text-secondary,#86827e);flex:none}.ci3c5a_pgName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.ci3c5a_pgDot{background:var(--dsh-primary,#69a1e8);border-radius:50%;flex:none;width:5px;height:5px;margin-left:auto}.ci3c5a_pgEmpty{color:var(--dsh-faint,#5b5854);text-align:center;margin:auto;padding:16px;font-size:12px}.ci3c5a_mlist{min-height:0;color:var(--dsh-text,#f4f2f0);flex-direction:column;flex:1;gap:10px;padding:12px 14px 20px;font:13px/1.65 Geist Variable,Inter,system-ui,Microsoft YaHei,sans-serif;display:flex;overflow-y:auto}.ci3c5a_muser{background:var(--dsh-surface,#232120);white-space:pre-wrap;word-break:break-word;border-radius:9px 9px 3px;align-self:flex-end;max-width:92%;padding:7px 11px;font-size:12.5px}.ci3c5a_massistant{white-space:pre-wrap;word-break:break-word;align-self:flex-start;max-width:100%}.ci3c5a_mtool{color:var(--dsh-faint,#5b5854);align-items:center;gap:6px;padding-left:2px;font-size:11px;display:flex}.ci3c5a_mtool .ci3c5a_ic{flex:none;width:11px;height:11px}.ci3c5a_mflag{color:var(--dsh-text-secondary,#86827e);margin-left:6px;font-size:10.5px}.ci3c5a_mmore{color:var(--dsh-faint,#5b5854);text-align:center;padding:4px 0;font-size:11px}.ci3c5a_caret{vertical-align:-2px;background:var(--dsh-primary,#69a1e8);width:7px;height:13px;margin-left:3px;animation:1s steps(2,end) infinite ci3c5a_nt-blink;display:inline-block}@keyframes ci3c5a_nt-blink{50%{opacity:0}}.nt-workspace{flex:1;min-width:0;min-height:0;display:flex}.nt-split.row{flex-direction:row;flex:1;min-width:0;min-height:0;display:flex}.nt-split.col{flex-direction:column;flex:1;min-width:0;min-height:0;display:flex}.nt-child{flex-basis:0;min-width:0;min-height:0;display:flex}.nt-pane-wrap{flex:1;min-width:0;min-height:0;display:flex;position:relative}.nt-divider{z-index:3;background:0 0;flex:none;position:relative}.nt-divider.row{cursor:col-resize;width:9px;margin:0 -4px}.nt-divider.col{cursor:row-resize;height:9px;margin:-4px 0}.nt-divider:after{content:\"\";background:var(--dsh-line,#262422);position:absolute;inset:0}.nt-divider.row:after{inset:0 4px}.nt-divider.col:after{inset:4px 0}.nt-divider:hover:after,.nt-divider.act:after{background:var(--dsh-primary,#69a1e8)}.nt-zhl{pointer-events:none;z-index:6;opacity:0;transition:opacity .1s;position:absolute;inset:0}.nt-zhl.on{opacity:1}.nt-zhl.on.lft{box-shadow:inset 3px 0 0 var(--dsh-primary,#69a1e8)}.nt-zhl.on.rgt{box-shadow:inset -3px 0 0 var(--dsh-primary,#69a1e8)}.nt-zhl.on.top{box-shadow:inset 0 3px 0 var(--dsh-primary,#69a1e8)}.nt-zhl.on.btm{box-shadow:inset 0 -3px 0 var(--dsh-primary,#69a1e8)}.nt-zhl.on.cnt{box-shadow:inset 0 0 0 1px var(--dsh-primary,#69a1e8);background:color-mix(in srgb,var(--dsh-primary,#69a1e8) 8%,transparent)}.ntws{width:100%;height:100%}.trellis [data-trellis-part=content]{flex-direction:column;width:100%;height:100%;font-size:16px;display:flex;inset:0}.trellis [data-trellis-part=content]>*{flex:1;min-width:0;min-height:0}.trellis [data-trellis-part=tab]{font-weight:650}.trellis [data-conversation-content] pre{font-size:16px;line-height:1.6}.trellis [data-conversation-content] pre code{font-size:16px}.trellis[data-theme=dark] [data-conversation-content] pre{background:#0d1015;border:1px solid #ffffff17;border-radius:8px}.ci3c5a_dropHot{position:relative}.ci3c5a_dropHot:after{content:\"\";pointer-events:none;z-index:50;background:#4d8bff0f;border:2px dashed #4d8bff;border-radius:12px;position:absolute;inset:3px}.nt-accrow{align-items:center;gap:2px;display:inline-flex}.nt-accwrap{align-items:center;display:inline-flex;position:relative}.nt-abtn{width:22px;height:22px;color:var(--dsh-text-secondary,#9699a3);cursor:pointer;background:0 0;border:none;border-radius:5px;place-items:center;padding:0;display:grid}.nt-abtn:hover,.nt-abtn.on{color:var(--dsh-text,#e7e8eb);background:var(--dsh-surface,#232120)}.nt-abtn.on{color:var(--dsh-primary,#4d8bff)}.nt-menu{z-index:9999;background:var(--dsh-overlay,#202126);border:1px solid var(--dsh-line,#ffffff1a);min-width:190px;color:var(--dsh-text,#e7e8eb);border-radius:8px;flex-direction:column;padding:4px;font-size:12px;display:flex;box-shadow:0 12px 32px #00000080}.nt-mi{height:30px;color:var(--dsh-text,#e7e8eb);text-align:left;cursor:pointer;font:inherit;white-space:nowrap;background:0 0;border:none;border-radius:6px;align-items:center;gap:8px;padding:0 10px;display:flex}button.nt-mi:hover{background:var(--dsh-surface,#232120)}.nt-mi.static{color:var(--dsh-text-secondary,#9699a3);cursor:default}.nt-mi.sel{background:color-mix(in srgb,var(--dsh-primary,#4d8bff) 12%,transparent)}.nt-mk{color:var(--dsh-primary,#4d8bff);margin-left:auto;font-size:10px}.nt-cat{flex-direction:column;display:flex}.nt-catname{color:var(--dsh-faint,#6a6e78);padding:5px 10px 2px;font-size:10px}.ci3c5a_webPane{flex-direction:column;width:100%;height:100%;min-height:0;display:flex;position:relative;overflow:hidden}.ci3c5a_webBar{border-bottom:1px solid var(--dsh-line,#262422);background:var(--trellis-tabbar,#141518);flex:none;align-items:center;gap:6px;padding:6px 8px;display:flex}.ci3c5a_webUrl{border:1px solid var(--dsh-line,#262422);background:var(--trellis-stage,#111215);min-width:0;height:26px;color:var(--dsh-text,#d8d5d0);border-radius:6px;outline:none;flex:1;padding:0 10px;font-size:12px}.ci3c5a_webUrl:focus{border-color:var(--trellis-accent,#4d8bff)}.ci3c5a_webGo{border:1px solid var(--dsh-line,#262422);background:var(--trellis-stage,#111215);min-width:30px;height:26px;color:var(--dsh-text,#d8d5d0);cursor:pointer;border-radius:6px;flex:none;padding:0 8px;font-size:12px}.ci3c5a_webGo:hover{border-color:var(--trellis-accent,#4d8bff)}.ci3c5a_webFrame{background:#fff;border:none;flex:1;width:100%;min-height:0}[data-nt=hconv] [class*=viewArea] [class*=composerSeat]{display:none!important}.ci3c5a_hconvBlank{position:relative}[data-nt=hconv].hconvBlank [class*=scrollBody]{flex-direction:column;display:flex;overflow:hidden}[data-nt=hconv].hconvBlank [class*=viewArea]{display:none}[data-nt=hconv].hconvBlank [class*=composerSeat]{margin-top:auto}";
		const pluginId = "@dsh-external/dsh-newtype-multititle";
		const tagId = "@dsh-external/dsh-newtype-multititle/c707511e";
		document.querySelectorAll("style[data-plugin=" + JSON.stringify(pluginId) + "][data-plugin-css=" + JSON.stringify(tagId) + "]").forEach((t) => t.remove());
		const tag = document.createElement("style");
		tag.dataset.plugin = pluginId;
		tag.dataset.pluginCss = tagId;
		tag.textContent = css;
		document.head.appendChild(tag);
		var newtype_module_css_default = {
			"pif": "ci3c5a_pif",
			"stbBrand": "ci3c5a_stbBrand",
			"wbRightOn": "ci3c5a_wbRightOn",
			"massistant": "ci3c5a_massistant",
			"mmore": "ci3c5a_mmore",
			"hconvRoot": "ci3c5a_hconvRoot",
			"pane": "ci3c5a_pane",
			"webUrl": "ci3c5a_webUrl",
			"ptab": "ci3c5a_ptab",
			"caret": "ci3c5a_caret",
			"pgRow": "ci3c5a_pgRow",
			"webPane": "ci3c5a_webPane",
			"ptabOn": "ci3c5a_ptabOn",
			"hd": "ci3c5a_hd",
			"ptabT": "ci3c5a_ptabT",
			"paneActions": "ci3c5a_paneActions",
			"pempty": "ci3c5a_pempty",
			"minitabRight": "ci3c5a_minitabRight",
			"perr": "ci3c5a_perr",
			"wbRight": "ci3c5a_wbRight",
			"nt-blink": "ci3c5a_nt-blink",
			"webGo": "ci3c5a_webGo",
			"icbtn": "ci3c5a_icbtn",
			"pgDot": "ci3c5a_pgDot",
			"minitab": "ci3c5a_minitab",
			"hconvBlank": "ci3c5a_hconvBlank",
			"ptabs": "ci3c5a_ptabs",
			"minitabOn": "ci3c5a_minitabOn",
			"nt-spin": "ci3c5a_nt-spin",
			"webBar": "ci3c5a_webBar",
			"ptabX": "ci3c5a_ptabX",
			"pgPanel": "ci3c5a_pgPanel",
			"pgEmpty": "ci3c5a_pgEmpty",
			"pbody": "ci3c5a_pbody",
			"pgClear": "ci3c5a_pgClear",
			"mtool": "ci3c5a_mtool",
			"panel": "ci3c5a_panel",
			"spin": "ci3c5a_spin",
			"mlist": "ci3c5a_mlist",
			"stbR": "ci3c5a_stbR",
			"paneFocused": "ci3c5a_paneFocused",
			"stbar": "ci3c5a_stbar",
			"webFrame": "ci3c5a_webFrame",
			"gowork": "ci3c5a_gowork",
			"pgTitle": "ci3c5a_pgTitle",
			"pgBadge": "ci3c5a_pgBadge",
			"ic": "ci3c5a_ic",
			"pgName": "ci3c5a_pgName",
			"minitabs": "ci3c5a_minitabs",
			"wbWrap": "ci3c5a_wbWrap",
			"ptabIco": "ci3c5a_ptabIco",
			"muser": "ci3c5a_muser",
			"wbMain": "ci3c5a_wbMain",
			"pgList": "ci3c5a_pgList",
			"pgHead": "ci3c5a_pgHead",
			"dropHot": "ci3c5a_dropHot",
			"mflag": "ci3c5a_mflag"
		};
		//#endregion
		//#region src/client/bus.ts
		const subs$1 = /* @__PURE__ */ new Set();
		let pending = null;
		const openTabBus = {
			emit(tabId) {
				if (subs$1.size === 0) {
					pending = tabId;
					return;
				}
				for (const f of subs$1) f(tabId);
			},
			sub(f) {
				subs$1.add(f);
				if (pending !== null) {
					const t = pending;
					pending = null;
					f(t);
				}
				return () => {
					subs$1.delete(f);
				};
			}
		};
		let pendingSessionId = null;
		function setPendingSession(id) {
			pendingSessionId = id;
		}
		function takePendingSession() {
			const v = pendingSessionId;
			pendingSessionId = null;
			return v;
		}
		/** 右栏产出物栏开合状态（工作台内侧栏，trellis Preview 式）：useSyncExternalStore 直连。 */
		let artOpen = false;
		const artSubs = /* @__PURE__ */ new Set();
		const artRail = {
			get() {
				return artOpen;
			},
			set(v) {
				if (artOpen === v) return;
				artOpen = v;
				for (const f of artSubs) f();
			},
			toggle() {
				artOpen = !artOpen;
				for (const f of artSubs) f();
			},
			sub(f) {
				artSubs.add(f);
				return () => {
					artSubs.delete(f);
				};
			}
		};
		/** 「打开产出物」请求（侧栏小按钮 → index.tsx：切到工作台 + 展开右栏）。 */
		const panelSubs = /* @__PURE__ */ new Set();
		const artifactPanelBus = {
			emit() {
				for (const f of panelSubs) f();
			},
			sub(f) {
				panelSubs.add(f);
				return () => {
					panelSubs.delete(f);
				};
			}
		};
		//#endregion
		//#region src/client/pages.ts
		/**
		* 图页共享索引（client 半，P3.1）：轮询 host 半的只读页面服务 + 水位归属。
		* 归属口径（HB 教训，FR-4.1/AC-4）：页面到达时刻「当前聚焦的会话」收下它；
		* 没有聚焦会话 → 归收件箱（'' 哨兵）；首次使用（无存储）只记水位不归属，防旧池倾灌。
		* 存储键带 version（HB 坑：改结构必须 bump）。
		*/
		const STORE_KEY = "dsh-newtype.pagepol.nt-v1";
		/** 已发现的页面服务基址（未发现返回 ''，组件拿到空串先渲染空态）。 */
		function pagesBase() {
			return "";
		}
		function loadPolicy() {
			try {
				const raw = localStorage.getItem(STORE_KEY);
				if (raw) return JSON.parse(raw);
			} catch {}
			return {
				seen: {},
				attrib: {}
			};
		}
		let snap = {
			list: [],
			attrib: {},
			fv: 0
		};
		let policy = loadPolicy();
		Object.keys(policy.seen).length;
		/** 新到未过目（内存态：重启清零，避免旧账唠叨）。AC-3 徽标的数据源。 */
		const fresh = /* @__PURE__ */ new Set();
		const subs = /* @__PURE__ */ new Set();
		function emit(next) {
			snap = next;
			for (const f of subs) f();
		}
		/**
		* 「主视图当前会话」判定：会话列表里 retainedBy 含 mainView 的那一行。
		* root scope 拿不到 sessionId（NOTES 1.1b），只能走这个口径。
		* D14 后由 WorkbenchView 与 PagesPanel 共同调用，保证切面板时归属也跟着更新。
		*/
		function retainedByMainView(ids, byId) {
			for (const id of ids ?? []) {
				const r = byId?.[id]?.retainedBy;
				if (Array.isArray(r) ? r.includes("mainView") : r ? Object.prototype.hasOwnProperty.call(r, "mainView") : false) return id;
			}
			return null;
		}
		/** 页面 → 会话（'' = 收件箱）。 */
		function attributedTo(pageId) {
			return policy.attrib[pageId] ?? "";
		}
		/** 该页是否新到未过目（AC-3 徽标）。 */
		function isFresh(pageId) {
			return fresh.has(pageId);
		}
		/** 过目清零：单页或一组。 */
		function markSeen(pageIds) {
			let changed = false;
			for (const id of pageIds) if (fresh.delete(id)) changed = true;
			if (changed) emit({
				list: snap.list,
				attrib: snap.attrib,
				fv: snap.fv + 1
			});
		}
		function titleOf(pageId) {
			return snap.list.find((p) => p.id === pageId)?.name ?? pageId;
		}
		function usePages() {
			return (0, react.useSyncExternalStore)((cb) => {
				subs.add(cb);
				return () => {
					subs.delete(cb);
				};
			}, () => snap, () => snap);
		}
		//#endregion
		//#region src/client/workbench/SessionPane.tsx
		/**
		* 只读会话窗格（(c) 路线核心，05 §E11 X1）：
		* ctx.sessions.retain(id, {source:'dsh-newtype'}) → binding.eventSource
		* → useSyncExternalStore 直连 ObservableSnapshot，整窗派生渲染，无增量状态。
		* 流式尾巴 = 窗内 transient 块按 attemptId 折叠（text-delta 累加）。
		* 发送不在本窗格：聚焦走「原生打开」（openSession），FR-1.2 不自绘输入。
		*/
		const subNoop$1 = () => () => {};
		const getNoop = () => null;
		function blocksText(blocks) {
			if (!blocks?.length) return "";
			return blocks.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("");
		}
		/** 整窗派生：durable 事件 → 行；transient live-chunk 按 attemptId 折叠成流式尾巴。 */
		function projectWindow(win) {
			const rows = [];
			const live = /* @__PURE__ */ new Map();
			const entries = win?.entries ?? [];
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i];
				const ev = entry?.event;
				if (!ev) continue;
				if (entry.type === "transient") {
					if (ev.data?.chunk?.type === "text-delta" && typeof ev.data.chunk.text === "string") {
						const k = ev.data.attemptId ?? `live-${i}`;
						const cur = live.get(k) ?? {
							text: "",
							seq: ev.seq ?? i
						};
						cur.text += ev.data.chunk.text;
						live.set(k, cur);
					}
					continue;
				}
				switch (ev.type) {
					case "user/message":
						rows.push({
							kind: "user",
							text: blocksText(ev.data?.content),
							key: `e${ev.seq ?? i}`
						});
						break;
					case "assistant/message":
						rows.push({
							kind: "assistant",
							text: blocksText(ev.data?.message?.content),
							interrupted: ev.data?.interrupted === true,
							key: `e${ev.seq ?? i}`
						});
						break;
					case "tool/call": rows.push({
						kind: "tool",
						text: ev.data?.name ?? "tool",
						key: `e${ev.seq ?? i}`
					});
				}
			}
			for (const [k, v] of live) if (v.text) rows.push({
				kind: "assistant",
				text: v.text,
				live: true,
				key: `live-${k}`
			});
			return rows.filter((r) => r.text);
		}
		function SessionPane(props) {
			const { sessionId, retainSession } = props;
			const [src, setSrc] = (0, react.useState)(null);
			const [err, setErr] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let ref = null;
				let alive = true;
				setSrc(null);
				setErr(null);
				try {
					ref = retainSession(sessionId);
					if (!ref) {
						setErr("会话服务不可用");
						return;
					}
					ref.ready.then((binding) => {
						if (alive) setSrc(binding?.eventSource ?? null);
					}, (e) => {
						if (alive) setErr(String(e?.message ?? e ?? "打开失败"));
					});
				} catch (e) {
					setErr(String(e));
				}
				return () => {
					alive = false;
					try {
						ref?.release();
					} catch {}
				};
			}, [sessionId, retainSession]);
			const subscribe = (0, react.useCallback)((cb) => src ? src.subscribe(cb) : subNoop$1(), [src]);
			const getSnapshot = (0, react.useCallback)(() => src ? src.getSnapshot() : getNoop(), [src]);
			const win = (0, react.useSyncExternalStore)(subscribe, getSnapshot);
			const rows = projectWindow(win);
			const bodyRef = (0, react.useRef)(null);
			const rev = win?.revision ?? 0;
			(0, react.useEffect)(() => {
				const el = bodyRef.current;
				if (el) el.scrollTop = el.scrollHeight;
			}, [rev, rows.length]);
			if (err) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.perr,
				children: err
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: bodyRef,
				"data-nt": "mlist",
				className: newtype_module_css_default.mlist,
				children: [
					rows.map((r) => r.kind === "user" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-nt": "muser",
						className: newtype_module_css_default.muser,
						children: r.text
					}, r.key) : r.kind === "tool" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-nt": "mtool",
						className: newtype_module_css_default.mtool,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							viewBox: "0 0 24 24",
							className: newtype_module_css_default.ic,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L15 12l-3-3 2.7-2.7z" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: r.text })]
					}, r.key) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-nt": "massistant",
						className: newtype_module_css_default.massistant,
						children: [
							r.text,
							r.live && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: newtype_module_css_default.caret }),
							r.interrupted && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: newtype_module_css_default.mflag,
								children: "（已中断）"
							})
						]
					}, r.key)),
					!rows.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: newtype_module_css_default.pempty,
						children: "（还没有可显示的事件）"
					}),
					win?.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: newtype_module_css_default.mmore,
						children: "更早的历史未加载"
					})
				]
			});
		}
		//#endregion
		//#region src/client/workbench/HostConversationPane.tsx
		/**
		* 窗格内的「DSH 原版对话框」（D14-R2）。
		*
		* 为什么这么写：
		*  宿主把对话区的可复用部分做成了 Component Factory `conversation.content`
		*  （scope: session-maybe），自带 scrollBody + composer 链 + widthControls；
		*  外部要拿一份完整原生对话框，正确姿势是 renderFactorySlot 而不是重画。
		*  宿主自己的先例：ui-subagent 的右栏子智能体对话面板
		*  （dsh-client-ui-subagent/lib/client.js:770-799）——同样的三段式：
		*  ① 外层 SessionProvider 显式绑 SessionReference
		*  ② renderFactorySlot('conversation.content', {variant:'embedded'}, {slots:{views}})
		*  ③ views 位置转发 renderSlot('conversation.session', {view:'chat'})
		*
		* 两个框架硬约束（都不是风格问题，踩了直接抛）：
		*  - SessionProvider 只在声明了非 root 作用域子槽的组件 props 上
		*    （ui-renderer client.js:732-740）→ WorkbenchView 的 children 声明是前提。
		*  - factory local slot `views` 是 strict session 作用域，未绑到会话时抛
		*    SlotAssemblyError（ui-renderer client.js:888）→ 每窗格必须显式绑 ref。
		*
		* phase 口径照宿主 ConversationSlotPanel：phase 只影响 hero/settling 外观，
		* 这里恒定 active + hero:false（窗格里不做空会话引导页）。
		*/
		const loadingFor = (id) => ({
			phase: "loading",
			for: id
		});
		const HostConversationPane = (0, react.memo)(function HostConversationPane(props) {
			const { sessionId, retainSession, SessionProvider, renderFactorySlot, viewName, blank } = props;
			/** E35：捕获层拦对话内链接点击。Ctrl/Cmd 点按放行（尊重「外部打开」习惯）；
			*  非 http(s)（mailto:、锚点、相对路径）不拦。
			*  E41：同层拦文件类点击（交付物卡 / md 文件提及 / @file 引用 chip），
			*  路径从 DOM title 直读，preventDefault 绕开官方 openFile 的死 fiber。
			*  特征依据 05 §E41（0.2.0-rc.2 源码只读查证）：
			*   - 交付物卡 div[data-presented-file]，热区 button[title] title=绝对路径
			*   - md 提及 button.fileMention（css module hash，后缀 _fileMention 稳定），title=path
			*   - @file chip button[data-ref-chip="file"]，title=@path（去 @ 去引号，相对 cwd） */
			const onCaptureClick = (e) => {
				if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
				const t = e.target;
				const openFile = props.onOpenFile;
				if (openFile && t) {
					const card = t.closest?.("[data-presented-file]");
					if (card) {
						const raw = Array.from(card.querySelectorAll("button[title]")).map((b) => b.getAttribute("title") ?? "").find((s) => /[\\/]/.test(s)) ?? "";
						if (raw) {
							e.preventDefault();
							e.stopPropagation();
							openFile(raw);
							return;
						}
					}
					const chip = t.closest?.("button[data-ref-chip=\"file\"], button[class*=\"fileMention\"]");
					if (chip) {
						const raw = (chip.getAttribute("title") ?? "").replace(/^@/, "").replace(/^"|"$/g, "");
						if (raw) {
							e.preventDefault();
							e.stopPropagation();
							openFile(raw);
							return;
						}
					}
				}
				const open = props.onOpenLink;
				if (!open || !t) return;
				const a = t.closest?.("a");
				if (!a) return;
				const href = a.getAttribute("href") ?? "";
				if (!/^https?:\/\//i.test(href)) return;
				e.preventDefault();
				e.stopPropagation();
				open(href);
			};
			const [state, setState] = (0, react.useState)(() => loadingFor(sessionId));
			/** E34：空会话 hero 比窗格高时，factory 初始滚动停在底部（hero 顶被裁、观感「输入框贴顶」）。
			*  会话就绪后把滚动归零几帧，呈现原生同款「hero 顶部 + composer 固定底」。 */
			const rootRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (state.phase !== "ready") return;
				if (!blank) return;
				let frames = 0;
				const id = requestAnimationFrame(function tick() {
					const root = rootRef.current;
					if (!root) return;
					const va = root.querySelector("[class*=\"viewArea\"]");
					if (va) va.style.display = "none";
					const sc = root.querySelector("[class*=\"scrollBody\"]");
					if (sc) {
						sc.style.overflow = "hidden";
						sc.style.display = "flex";
						sc.style.flexDirection = "column";
					}
					const seat = root.querySelector("[class*=\"composerSeat\"]");
					if (seat) {
						seat.style.marginTop = "auto";
						seat.style.position = "static";
					}
					if (++frames < 10) requestAnimationFrame(tick);
				});
				return () => cancelAnimationFrame(id);
			}, [
				state.phase,
				blank,
				sessionId
			]);
			(0, react.useEffect)(() => {
				let ref = null;
				let alive = true;
				let timer = null;
				const MAX_TRIES = 12;
				const RETRY_MS = 500;
				let tries = 0;
				setState(loadingFor(sessionId));
				const attempt = () => {
					if (!alive) return;
					try {
						ref = retainSession(sessionId);
						if (!ref) {
							if (++tries <= MAX_TRIES) {
								timer = setTimeout(attempt, RETRY_MS);
								return;
							}
							if (alive) setState({
								phase: "absent",
								for: sessionId
							});
							return;
						}
						const held = ref;
						held.ready.then(() => {
							if (alive) setState({
								phase: "ready",
								for: sessionId,
								ref: held
							});
						}, (e) => {
							const msg = String(e?.message ?? e ?? "打开失败");
							if (!alive || msg.includes("is released")) return;
							try {
								held.release();
							} catch {}
							ref = null;
							if (++tries <= MAX_TRIES) {
								timer = setTimeout(attempt, RETRY_MS);
								return;
							}
							if (alive) setState({
								phase: "error",
								for: sessionId,
								message: msg
							});
						});
					} catch (e) {
						if (++tries <= MAX_TRIES) {
							timer = setTimeout(attempt, RETRY_MS);
							return;
						}
						setState({
							phase: "error",
							for: sessionId,
							message: String(e)
						});
					}
				};
				attempt();
				return () => {
					alive = false;
					if (timer !== null) clearTimeout(timer);
					try {
						ref?.release();
					} catch {}
				};
			}, [sessionId, retainSession]);
			if (!SessionProvider || !renderFactorySlot) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { fallback: props.fallback });
			const settled = state.for === sessionId ? state : loadingFor(sessionId);
			if (settled.phase === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.pempty,
				children: "加载会话…"
			});
			if (settled.phase === "absent") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { fallback: props.fallback });
			if (settled.phase === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.perr,
				children: settled.message
			});
			if (!SessionProvider || !renderFactorySlot) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { fallback: props.fallback });
			if (state.phase === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.pempty,
				children: "加载会话…"
			});
			if (state.phase === "absent") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fallback, { fallback: props.fallback });
			if (state.phase === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.perr,
				children: state.message
			});
			/**
			* 关键布局细节（D14 冒烟实测 + 宿主 CSS 实读）：
			* factory 产出的顶层就是 `.body`（`data-conversation-content`），
			* `.root`（height:100%; flex column）那层是宿主的 ConversationMainPanel 给的。
			* 我们没有 MainPanel，所以必须自己补一个 root 层当 flex 父容器 ——
			* 否则 `.body` 的 `flex:1` 落空、高度塌成内容高，
			* `composerSeat` 的 `position:sticky; bottom:0` 会把输入框贴在窗格顶部
			* （症状：smoke-d14b/c 截图里输入框浮在视口最上方）。
			* 宿主同款做法 = SidebarChatTab 的 `.root` 包装（ui-subagent client.js:792-798）。
			*/
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionProvider, {
				session: settled.ref,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.hconvRoot + (props.blank ? " " + newtype_module_css_default.hconvBlank : ""),
					"data-nt": "hconv",
					ref: rootRef,
					onClickCapture: onCaptureClick,
					children: renderFactorySlot("conversation.content", {
						variant: "embedded",
						phase: "active",
						hero: false
					}, { slots: { views: (p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionHostView, {
						renderSlot: p.renderSlot,
						viewName
					}) } })
				})
			}, settled.for);
		}, panePropsEqual);
		function panePropsEqual(a, b) {
			return a.sessionId === b.sessionId && a.blank === b.blank && a.retainSession === b.retainSession && a.SessionProvider === b.SessionProvider && a.renderFactorySlot === b.renderFactorySlot && a.viewName === b.viewName && a.onOpenLink === b.onOpenLink && a.onOpenFile === b.onOpenFile;
		}
		/**
		* factory 的 views 位置：转发到宿主 conversation.session 的指定视图。
		* viewName='chat'（默认）= 原版对话框；'trajectory' = 轨迹（D15 查证项）。
		* framework 会把 renderSlot 等道具注进来，这里只用到 renderSlot 一个。
		*/
		function SessionHostView(props) {
			const renderSlot = props.renderSlot;
			if (!renderSlot) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: renderSlot("conversation.session", { view: props.viewName ?? "chat" }) });
		}
		function Fallback(props) {
			const node = props.fallback;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: node ?? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.pempty,
				children: "该窗格无法渲染原生对话框"
			}) });
		}
		//#endregion
		//#region src/client/workbench/PagePane.tsx
		/**
		* 图页窗格：host 半只读服务里 iframe 页面本体（FR-4.1 点开才渲染）。
		* 本地 127.0.0.1 互 iframe 无同源栅栏（05 §E6 判据存档）。
		*/
		function PagePane({ pageId }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
				className: newtype_module_css_default.pif,
				src: `${pagesBase()}/newtype/page/${pageId}`,
				title: titleOf(pageId)
			});
		}
		//#endregion
		//#region node_modules/marked/lib/marked.esm.js
		/**
		* marked v18.1.0 - a markdown parser
		* Copyright (c) 2018-2026, MarkedJS. (MIT License)
		* Copyright (c) 2011-2018, Christopher Jeffrey. (MIT License)
		* https://github.com/markedjs/marked
		*/
		/**
		* DO NOT EDIT THIS FILE
		* The code in this file is generated from files in ./src/
		*/
		function I() {
			return {
				async: !1,
				breaks: !1,
				extensions: null,
				gfm: !0,
				hooks: null,
				pedantic: !1,
				renderer: null,
				silent: !1,
				tokenizer: null,
				walkTokens: null
			};
		}
		var P = I();
		function W(l) {
			P = l;
		}
		var A = { exec: () => null };
		function C(l) {
			let e = [];
			return (t) => {
				let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
				return s || (s = l(n), e[n] = s), s;
			};
		}
		function h(l, e = "") {
			let t = typeof l == "string" ? l : l.source, n = {
				replace: (s, r) => {
					let o = typeof r == "string" ? r : r.source;
					return o = o.replace(x.caret, "$1"), t = t.replace(s, o), n;
				},
				getRegex: () => new RegExp(t, e)
			};
			return n;
		}
		var _e = ((l = "") => {
			try {
				return !!new RegExp("(?<=1)(?<!1)" + l);
			} catch {
				return !1;
			}
		})();
		var x = {
			codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
			outputLinkReplace: /\\([\[\]])/g,
			indentCodeCompensation: /^(\s+)(?:```)/,
			beginningSpace: /^\s+/,
			endingHash: /#$/,
			startingSpaceChar: /^ /,
			endingSpaceChar: / $/,
			endingSpaceTabChar: /[ \t]$/,
			nonSpaceChar: /[^ ]/,
			newLineCharGlobal: /\n/g,
			tabCharGlobal: /\t/g,
			leadingSpaceTab: /^[ \t]+/,
			multipleSpaceGlobal: /\s+/g,
			blankLine: /^[ \t]*$/,
			doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
			blockquoteStart: /^ {0,3}>/,
			blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
			blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
			listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
			listIsTask: /^\[[ xX]\] +\S/,
			listReplaceTask: /^\[[ xX]\] +/,
			listTaskCheckbox: /\[[ xX]\]/,
			anyLine: /\n.*\n/,
			hrefBrackets: /^<(.*)>$/,
			tableDelimiter: /[:|]/,
			tableAlignChars: /^\||\| *$/g,
			tableRowBlankLine: /\n[ \t]*$/,
			tableAlignRight: /^ *-+: *$/,
			tableAlignCenter: /^ *:-+: *$/,
			tableAlignLeft: /^ *:-+ *$/,
			startATag: /^<a /i,
			endATag: /^<\/a>/i,
			startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
			endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
			startAngleBracket: /^</,
			endAngleBracket: />$/,
			pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
			unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
			numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/g,
			escapeTest: /[&<>"']/,
			escapeReplace: /[&<>"']/g,
			escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
			escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
			caret: /(^|[^\[])\^/g,
			percentDecode: /%25/g,
			findPipe: /\|/g,
			splitPipe: / \|/,
			slashPipe: /\\\|/g,
			carriageReturn: /\r\n|\r/g,
			spaceLine: /^ +$/gm,
			notSpaceStart: /^\S*/,
			endingNewline: /\n$/,
			listItemRegex: (l) => new RegExp(`^( {0,3}${l})((?:[	 ][^\\n]*)?(?:\\n|$))`),
			nextBulletRegex: C((l) => new RegExp(`^ {0,${l}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)),
			hrRegex: C((l) => new RegExp(`^ {0,${l}}((?:-[ 	]*){3,}|(?:_[ 	]*){3,}|(?:\\*[ 	]*){3,})(?:\\n+|$)`)),
			fencesBeginRegex: C((l) => new RegExp(`^ {0,${l}}(?:\`\`\`|~~~)`)),
			headingBeginRegex: C((l) => new RegExp(`^ {0,${l}}#`)),
			htmlBeginRegex: C((l) => new RegExp(`^ {0,${l}}(?:</?(?:${N})(?: +|$|/?>)|<(?:script|pre|style|textarea|!--))`, "i")),
			blockquoteBeginRegex: C((l) => new RegExp(`^ {0,${l}}>`))
		};
		var $e = /^(?:[ \t]*(?:\n|$))+/;
		var Le = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
		var ze = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
		var G = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
		var Ae = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
		var J = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
		var he = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
		var de = h(he).replace(/bull/g, J).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
		var Ee = h(he).replace(/bull/g, J).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/).replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
		var V = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
		var Me = /^[^\n]+/;
		var Y = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
		var Ie = h(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", Y).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
		var Ce = h(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, J).getRegex();
		var N = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
		var ee = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
		var Be = h("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", ee).replace("tag", N).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
		var ke = (l) => h(V).replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", l).replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex();
		var De = ke(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
		var qe = ke(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);
		var te = {
			blockquote: h(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", qe).getRegex(),
			code: Le,
			def: Ie,
			fences: ze,
			heading: Ae,
			hr: G,
			html: Be,
			lheading: de,
			list: Ce,
			newline: $e,
			paragraph: De,
			table: A,
			text: Me
		};
		var ue = h("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex();
		var Ze = {
			...te,
			lheading: Ee,
			table: ue,
			paragraph: h(V).replace("hr", G).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", ue).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", N).getRegex()
		};
		var He = {
			...te,
			html: h(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", ee).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
			def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
			heading: /^(#{1,6})(.*)(?:\n+|$)/,
			fences: A,
			lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
			paragraph: h(V).replace("hr", G).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", de).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
		};
		var Ge = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
		var Ne = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
		var ge = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
		var Qe = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
		var $ = /[\p{P}\p{S}]/u;
		var B = /[\s\p{P}\p{S}]/u;
		var Q = /[^\s\p{P}\p{S}]/u;
		var je = h(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, B).getRegex();
		var Fe = /[\p{Pi}\p{Ps}"']/u;
		var fe = /(?!~)[\p{P}\p{S}]/u;
		var Ue = /(?!~)[\s\p{P}\p{S}]/u;
		var Ke = /(?:[^\s\p{P}\p{S}]|~)/u;
		var We = h(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", _e ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
		var me = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
		var Xe = h(me, "u").replace(/punct/g, $).getRegex();
		var Je = h(me, "u").replace(/punct/g, fe).getRegex();
		var Ye = h(/^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/, "u").replace(/openQuote/g, Fe).replace(/punct/g, $).getRegex();
		var xe = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
		var et = h(xe, "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
		var tt = h(xe, "gu").replace(/notPunctSpace/g, Ke).replace(/punctSpace/g, Ue).replace(/punct/g, fe).getRegex();
		var rt = h("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)[\\s](\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
		var st = h("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
		var ot = h("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)[\\s](_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
		var at = h(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, $).getRegex();
		var ut = h("^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)", "gu").replace(/notPunctSpace/g, Q).replace(/punctSpace/g, B).replace(/punct/g, $).getRegex();
		var pt = h(/\\(punct)/, "gu").replace(/punct/g, $).getRegex();
		var ct = h(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
		var ht = h(ee).replace("(?:-->|$)", "-->").getRegex();
		var dt = h("^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", ht).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
		var be = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
		var U = h(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace("brackets", be).getRegex();
		var kt = h(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/).replace("label", U).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
		var gt = h(/^!?\[(label)\]\[(ref)\]/).replace("label", U).replace("ref", Y).getRegex();
		var ft = h(/^!?\[(ref)\](?:\[\])?/).replace("ref", Y).getRegex();
		var pe = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
		var mt = h(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace("brackets", be).getRegex();
		var xt = h("reflink|nolink(?!\\()", "g").replace("reflink", h(/^!?\[(label)\]\[(ref)\]/).replace("label", mt).replace("ref", pe).getRegex()).replace("nolink", h(/^!?\[(ref)\](?:\[\])?/).replace("ref", pe).getRegex()).getRegex();
		var ce = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
		var Rt = h(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex();
		var ne = {
			_backpedal: A,
			anyPunctuation: pt,
			autolink: ct,
			blockSkip: We,
			br: ge,
			code: Ne,
			del: A,
			delLDelim: A,
			delRDelim: A,
			emStrongLDelim: Xe,
			emStrongRDelimAst: et,
			emStrongRDelimUnd: st,
			escape: Ge,
			link: kt,
			nolink: ft,
			punctuation: je,
			reflink: gt,
			reflinkSearch: xt,
			tag: dt,
			text: Qe,
			url: A
		};
		var Tt = {
			...ne,
			emStrongLDelim: Ye,
			emStrongRDelimAst: rt,
			emStrongRDelimUnd: ot,
			link: h(/^!?\[(label)\]\((.*?)\)/).replace("label", U).getRegex(),
			reflink: h(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", U).getRegex()
		};
		var X = {
			...ne,
			emStrongRDelimAst: tt,
			emStrongLDelim: Je,
			delLDelim: at,
			delRDelim: ut,
			url: h(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("emailProtocol", Rt).replace("protocol", ce).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex(),
			_backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
			del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
			text: h(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/).replace("protocol", ce).replace(/emailProtocol/g, /(?:mailto|xmpp):/).getRegex()
		};
		var Ot = {
			...X,
			br: h(ge).replace("{2,}", "*").getRegex(),
			text: h(X.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
		};
		var j = {
			normal: te,
			gfm: Ze,
			pedantic: He
		};
		var D = {
			normal: ne,
			gfm: X,
			breaks: Ot,
			pedantic: Tt
		};
		var wt = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		};
		var Re = (l) => wt[l];
		function O(l, e) {
			if (e) {
				if (x.escapeTest.test(l)) return l.replace(x.escapeReplace, Re);
			} else if (x.escapeTestNoEncode.test(l)) return l.replace(x.escapeReplaceNoEncode, Re);
			return l;
		}
		function Te(l) {
			return l.replace(x.numericCharacterReference, (e, t, n) => {
				let s = t === void 0 ? Number.parseInt(n, 16) : Number.parseInt(t, 10);
				return s === 0 || s > 1114111 || s >= 55296 && s <= 57343 ? "�" : String.fromCodePoint(s);
			});
		}
		function re(l) {
			try {
				l = encodeURI(l).replace(x.percentDecode, "%");
			} catch {
				return null;
			}
			return l;
		}
		function se(l, e) {
			let n = l.replace(x.findPipe, (r, o, i) => {
				let u = !1, a = o;
				for (; --a >= 0 && i[a] === "\\";) u = !u;
				return u ? "|" : " |";
			}).split(x.splitPipe), s = 0;
			if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
			else for (; n.length < e;) n.push("");
			for (; s < n.length; s++) n[s] = n[s].trim().replace(x.slashPipe, "|");
			return n;
		}
		function L(l, e, t) {
			let n = l.length;
			if (n === 0) return "";
			let s = 0;
			for (; s < n;) {
				let r = l.charAt(n - s - 1);
				if (r === e && !t) s++;
				else if (r !== e && t) s++;
				else break;
			}
			return l.slice(0, n - s);
		}
		function ie(l) {
			let e = l.split(`
`), t = e.length - 1;
			for (; t >= 0 && x.blankLine.test(e[t]);) t--;
			return e.length - t <= 2 ? l : e.slice(0, t + 1).join(`
`);
		}
		function q(l) {
			return l.trim().toLowerCase().toUpperCase().toLowerCase();
		}
		function oe(l, e) {
			if (l.indexOf(e[0]) === -1 && l.indexOf(e[1]) === -1) return -1;
			let t = 0;
			for (let n = 0; n < l.length; n++) if (l[n] === "\\") n++;
			else if (l[n] === e[0]) t++;
			else if (l[n] === e[1] && (t--, t < 0)) return n;
			return t > 0 ? -2 : -1;
		}
		function ae(l, e = 0) {
			let t = e, n = "";
			for (let s of l) if (s === "	") {
				let r = 4 - t % 4;
				n += " ".repeat(r), t += r;
			} else n += s, t++;
			return n;
		}
		function Oe(l, e, t, n, s) {
			let r = e.href, o = e.title || null, i = l[1].replace(s.other.outputLinkReplace, "$1"), u = l[0].charAt(0) === "!";
			n.state.inLink = !0;
			let a = n.state.linkEmitted, p = n.state.inRawBlock;
			n.state.linkEmitted = !1;
			let c = n.inlineTokens(i), d = n.state.linkEmitted;
			if (n.state.linkEmitted = a, n.state.inLink = !1, !u) {
				if (d) {
					n.state.inRawBlock = p;
					return;
				}
				n.state.linkEmitted = !0;
			}
			return {
				type: u ? "image" : "link",
				raw: t,
				href: r,
				title: o,
				text: i,
				tokens: c
			};
		}
		function Pt(l, e, t) {
			let n = l.match(t.other.indentCodeCompensation);
			if (n === null) return e;
			let s = n[1];
			return e.split(`
`).map((r) => {
				let o = r.match(t.other.beginningSpace);
				if (o === null) return r;
				let [i] = o;
				return r.slice(Math.min(i.length, s.length));
			}).join(`
`);
		}
		function we(l, e, t, n) {
			if (!e.includes("<")) return !1;
			for (let s = 0; s < e.length; s++) {
				if (e[s] === "\\") {
					s++;
					continue;
				}
				if (e[s] === "`") {
					let i = n.inline.code.exec(e.slice(s));
					if (i) {
						s += i[0].length - 1;
						continue;
					}
				}
				if (e[s] !== "<") continue;
				let r = l.slice(t + s), o = n.inline.tag.exec(r) || n.inline.autolink.exec(r);
				if (o) {
					if (o[0].length > e.length - s) return !0;
					s += o[0].length - 1;
				}
			}
			return !1;
		}
		var y = class {
			options;
			rules;
			lexer;
			constructor(e) {
				this.options = e || P;
			}
			space(e) {
				let t = this.rules.block.newline.exec(e);
				if (t && t[0].length > 0) return {
					type: "space",
					raw: t[0]
				};
			}
			code(e) {
				let t = this.rules.block.code.exec(e);
				if (t) {
					let n = this.options.pedantic ? t[0] : ie(t[0]);
					return {
						type: "code",
						raw: n,
						codeBlockStyle: "indented",
						text: n.replace(this.rules.other.codeRemoveIndent, "")
					};
				}
			}
			fences(e) {
				let t = this.rules.block.fences.exec(e);
				if (t) {
					let n = t[0], s = Pt(n, t[3] || "", this.rules);
					return {
						type: "code",
						raw: n,
						lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2],
						text: s
					};
				}
			}
			heading(e) {
				let t = this.rules.block.heading.exec(e);
				if (t) {
					let n = t[2].trim();
					if (this.rules.other.endingHash.test(n)) {
						let s = L(n, "#");
						(this.options.pedantic || !s || this.rules.other.endingSpaceTabChar.test(s)) && (n = s.trim());
					}
					return {
						type: "heading",
						raw: L(t[0], `
`),
						depth: t[1].length,
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			hr(e) {
				let t = this.rules.block.hr.exec(e);
				if (t) return {
					type: "hr",
					raw: L(t[0], `
`)
				};
			}
			blockquote(e) {
				let t = this.rules.block.blockquote.exec(e);
				if (t) {
					let n = L(t[0], `
`).split(`
`), s = "", r = "", o = [];
					for (; n.length > 0;) {
						let i = !1, u = [], a = 0;
						for (; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) u.push(n[a]), i = !0;
						else if (!i) u.push(n[a]);
						else break;
						n = n.slice(a);
						let p = u.join(`
`), c = p.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
						s = s ? `${s}
${p}` : p, r = r ? `${r}
${c}` : c;
						let d = this.lexer.state.top;
						if (this.lexer.state.top = !0, this.lexer.blockTokens(c, o, !0), this.lexer.state.top = d, n.length === 0) break;
						let m = o.at(-1);
						if (m?.type === "code") break;
						if (m?.type === "blockquote") {
							let b = m, g = n.join(`
`), w = b.raw + `
` + g.replace(this.rules.other.blockquoteSetextReplace2, ""), f = this.blockquote(w);
							o[o.length - 1] = f;
							let M = w.substring(f.raw.length).replace(/^\n/, ""), v = M ? M.split(`
`).length : 0, Z = v ? n.slice(0, -v) : n;
							Z.length > 0 && (s = `${s}
${Z.join(`
`)}`), r = r.substring(0, r.length - b.text.length) + f.text;
							break;
						} else if (m?.type === "list") {
							let b = m, g = b.raw + `
` + n.join(`
`), w = this.list(g);
							o[o.length - 1] = w, s = s.substring(0, s.length - m.raw.length) + w.raw, r = r.substring(0, r.length - b.raw.length) + w.raw, n = g.substring(o.at(-1).raw.length).split(`
`);
							continue;
						}
					}
					return {
						type: "blockquote",
						raw: s,
						tokens: o,
						text: r
					};
				}
			}
			list(e) {
				let t = this.rules.block.list.exec(e);
				if (t) {
					let n = t[1].trim(), s = n.length > 1, r = {
						type: "list",
						raw: "",
						ordered: s,
						start: s ? +n.slice(0, -1) : "",
						loose: !1,
						items: []
					};
					n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
					let o = this.rules.other.listItemRegex(n), i = !1;
					for (; e;) {
						let a = !1, p = "", c = "";
						if (!(t = o.exec(e)) || this.rules.block.hr.test(e)) break;
						p = t[0], e = e.substring(p.length);
						let d = t[2].split(`
`, 1)[0], m = t[1].length, b = this.options.pedantic ? ae(d, m) : d.replace(this.rules.other.leadingSpaceTab, (M) => ae(M, m)), g = e.split(`
`, 1)[0], w = !b.trim(), f = 0;
						if (this.options.pedantic ? (f = 2, c = b.trimStart()) : w ? f = m + 1 : (f = b.search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, c = b.slice(f), f += m), w && this.rules.other.blankLine.test(g) && (p += g + `
`, e = e.substring(g.length + 1), a = !0), !a) {
							let M = this.rules.other.nextBulletRegex(f), v = this.rules.other.hrRegex(f), Z = this.rules.other.fencesBeginRegex(f), le = this.rules.other.headingBeginRegex(f), Pe = this.rules.other.htmlBeginRegex(f), ye = this.rules.other.blockquoteBeginRegex(f);
							for (; e;) {
								let K = e.split(`
`, 1)[0], H;
								if (g = K, this.options.pedantic ? (g = g.replace(this.rules.other.listReplaceNesting, "  "), H = g) : H = g.replace(this.rules.other.leadingSpaceTab, (Se) => Se.replace(this.rules.other.tabCharGlobal, "    ")), Z.test(g) || le.test(g) || Pe.test(g) || ye.test(g) || M.test(g) || v.test(g)) break;
								if (H.search(this.rules.other.nonSpaceChar) >= f || !g.trim()) c += `
` + H.slice(f);
								else {
									if (w || b.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || Z.test(b) || le.test(b) || v.test(b)) break;
									c += `
` + g;
								}
								w = !g.trim(), p += K + `
`, e = e.substring(K.length + 1), b = H.slice(f);
							}
						}
						r.loose || (i ? r.loose = !0 : this.rules.other.doubleBlankLine.test(p) && (i = !0)), r.items.push({
							type: "list_item",
							raw: p,
							task: !!this.options.gfm && this.rules.other.listIsTask.test(c),
							loose: !1,
							text: c,
							tokens: []
						}), r.raw += p;
					}
					let u = r.items.at(-1);
					if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
					else return;
					r.raw = r.raw.trimEnd();
					for (let a of r.items) if (this.lexer.state.top = !1, a.tokens = this.lexer.blockTokens(a.text, []), !r.loose) {
						let p = a.tokens.filter((d) => d.type === "space");
						r.loose = p.length > 0 && p.some((d) => this.rules.other.anyLine.test(d.raw));
					}
					for (let a of r.items) {
						let p = a.tokens[0];
						if (a.task && (p?.type === "text" || p?.type === "paragraph")) {
							a.text = a.text.replace(this.rules.other.listReplaceTask, ""), p.raw = p.raw.replace(this.rules.other.listReplaceTask, ""), p.text = p.text.replace(this.rules.other.listReplaceTask, "");
							for (let d = this.lexer.inlineQueue.length - 1; d >= 0; d--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[d].src)) {
								this.lexer.inlineQueue[d].src = this.lexer.inlineQueue[d].src.replace(this.rules.other.listReplaceTask, "");
								break;
							}
							let c = this.rules.other.listTaskCheckbox.exec(a.raw);
							if (c) {
								let d = {
									type: "checkbox",
									raw: c[0] + " ",
									checked: c[0] !== "[ ]"
								};
								a.checked = d.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = d.raw + a.tokens[0].raw, a.tokens[0].text = d.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(d)) : a.tokens.unshift({
									type: "paragraph",
									raw: d.raw,
									text: d.raw,
									tokens: [d]
								}) : a.tokens.unshift(d);
							}
						} else a.task && (a.task = !1);
					}
					if (r.loose) for (let a of r.items) {
						a.loose = !0;
						for (let p of a.tokens) p.type === "text" && (p.type = "paragraph");
					}
					return r;
				}
			}
			html(e) {
				let t = this.rules.block.html.exec(e);
				if (t) {
					let n = ie(t[0]);
					return {
						type: "html",
						block: !0,
						raw: n,
						pre: t[1] === "pre" || t[1] === "script" || t[1] === "style",
						text: n
					};
				}
			}
			def(e) {
				let t = this.rules.block.def.exec(e);
				if (t) {
					if (!this.rules.other.startAngleBracket.test(t[2]) && oe(t[2], "()") !== -1) return;
					let n = q(t[1]).replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
					return {
						type: "def",
						tag: n,
						raw: L(t[0], `
`),
						href: s,
						title: r
					};
				}
			}
			table(e) {
				let t = this.rules.block.table.exec(e);
				if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
				let n = se(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], o = {
					type: "table",
					raw: L(t[0], `
`),
					header: [],
					align: [],
					rows: []
				};
				if (n.length === s.length) {
					for (let i of s) this.rules.other.tableAlignRight.test(i) ? o.align.push("right") : this.rules.other.tableAlignCenter.test(i) ? o.align.push("center") : this.rules.other.tableAlignLeft.test(i) ? o.align.push("left") : o.align.push(null);
					for (let i = 0; i < n.length; i++) o.header.push({
						text: n[i],
						tokens: this.lexer.inline(n[i]),
						header: !0,
						align: o.align[i]
					});
					for (let i of r) o.rows.push(se(i, o.header.length).map((u, a) => ({
						text: u,
						tokens: this.lexer.inline(u),
						header: !1,
						align: o.align[a]
					})));
					return o;
				}
			}
			lheading(e) {
				let t = this.rules.block.lheading.exec(e);
				if (t) {
					let n = t[1].trim();
					return {
						type: "heading",
						raw: L(t[0], `
`),
						depth: t[2].charAt(0) === "=" ? 1 : 2,
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			paragraph(e) {
				let t = this.rules.block.paragraph.exec(e);
				if (t) {
					let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
					return {
						type: "paragraph",
						raw: t[0],
						text: n,
						tokens: this.lexer.inline(n)
					};
				}
			}
			text(e) {
				let t = this.rules.block.text.exec(e);
				if (t) return {
					type: "text",
					raw: t[0],
					text: t[0],
					tokens: this.lexer.inline(t[0])
				};
			}
			escape(e) {
				let t = this.rules.inline.escape.exec(e);
				if (t) return {
					type: "escape",
					raw: t[0],
					text: t[1]
				};
			}
			tag(e) {
				let t = this.rules.inline.tag.exec(e);
				if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = !0 : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = !1), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = !0 : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = !1), {
					type: "html",
					raw: t[0],
					inLink: this.lexer.state.inLink,
					inRawBlock: this.lexer.state.inRawBlock,
					block: !1,
					text: t[0]
				};
			}
			link(e) {
				if (this.lexer.state.linkParenPossible === !1) return;
				let t = this.rules.inline.link.exec(e);
				if (t) {
					let n = t[0].charAt(0) === "!" ? 2 : 1;
					if (!this.options.pedantic && we(e, t[1], n, this.rules)) return;
					let s = t[2].trim();
					if (!this.options.pedantic && this.rules.other.startAngleBracket.test(s)) {
						if (!this.rules.other.endAngleBracket.test(s)) return;
						let i = L(s.slice(0, -1), "\\");
						if ((s.length - i.length) % 2 === 0) return;
					} else {
						let i = oe(t[2], "()");
						if (i === -2) return;
						if (i > -1) {
							let a = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
							t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, a).trim(), t[3] = "";
						}
					}
					let r = t[2], o = "";
					if (this.options.pedantic) {
						let i = this.rules.other.pedanticHrefTitle.exec(r);
						i && (r = i[1], o = i[3]);
					} else o = t[3] ? t[3].slice(1, -1) : "";
					return r = r.trim(), this.rules.other.startAngleBracket.test(r) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(s) ? r = r.slice(1) : r = r.slice(1, -1)), Oe(t, {
						href: r && r.replace(this.rules.inline.anyPunctuation, "$1"),
						title: o && o.replace(this.rules.inline.anyPunctuation, "$1")
					}, t[0], this.lexer, this.rules);
				}
			}
			reflink(e, t) {
				let n;
				if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
					let s = n[0].charAt(0) === "!" ? 2 : 1;
					if (!this.options.pedantic && we(e, n[1], s, this.rules)) return;
					let o = t[q((n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "))];
					if (!o) {
						let i = n[0].charAt(0);
						return {
							type: "text",
							raw: i,
							text: i
						};
					}
					return Oe(n, o, n[0], this.lexer, this.rules);
				}
			}
			emStrong(e, t, n = "") {
				let s = this.rules.inline.emStrongLDelim.exec(e);
				if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
				if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
					let o = [...s[0]].length - 1, i, u, a = o, p = 0, c = s[0][0], d = n === c, m = c === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
					for (m.lastIndex = 0, t = t.slice(-1 * e.length + o); (s = m.exec(t)) !== null;) {
						if (i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !i) continue;
						if (u = [...i].length, s[3] || s[4]) {
							a += u;
							continue;
						} else if (s[5] || s[6]) {
							if (o % 3 && !((o + u) % 3)) {
								p += u;
								continue;
							}
							if (d) break;
						}
						if (a -= u, a > 0) continue;
						u = Math.min(u, u + a + p);
						let b = [...s[0]][0].length, g = e.slice(0, o + s.index + b + u);
						if (Math.min(o, u) % 2) {
							let f = g.slice(1, -1);
							return {
								type: "em",
								raw: g,
								text: f,
								tokens: this.lexer.inlineTokens(f)
							};
						}
						let w = g.slice(2, -2);
						return {
							type: "strong",
							raw: g,
							text: w,
							tokens: this.lexer.inlineTokens(w)
						};
					}
				}
			}
			codespan(e) {
				let t = this.rules.inline.code.exec(e);
				if (t) {
					let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
					return s && r && (n = n.substring(1, n.length - 1)), {
						type: "codespan",
						raw: t[0],
						text: n
					};
				}
			}
			br(e) {
				let t = this.rules.inline.br.exec(e);
				if (t) return {
					type: "br",
					raw: t[0]
				};
			}
			del(e, t, n = "") {
				let s = this.rules.inline.delLDelim.exec(e);
				if (!s) return;
				if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
					let o = [...s[0]].length - 1, i, u, a = o, p = this.rules.inline.delRDelim;
					for (p.lastIndex = 0, t = t.slice(-1 * e.length + o); (s = p.exec(t)) !== null;) {
						if (i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !i || (u = [...i].length, u !== o)) continue;
						if (s[3] || s[4]) {
							a += u;
							continue;
						}
						if (a -= u, a > 0) continue;
						u = Math.min(u, u + a);
						let c = [...s[0]][0].length, d = e.slice(0, o + s.index + c + u), m = d.slice(o, -o);
						return {
							type: "del",
							raw: d,
							text: m,
							tokens: this.lexer.inlineTokens(m)
						};
					}
				}
			}
			autolink(e) {
				let t = this.rules.inline.autolink.exec(e);
				if (t) {
					let n, s;
					return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), {
						type: "link",
						raw: t[0],
						text: n,
						href: s,
						autolink: !0,
						tokens: [{
							type: "text",
							raw: n,
							text: n
						}]
					};
				}
			}
			url(e) {
				let t;
				if (t = this.rules.inline.url.exec(e)) {
					let n, s;
					if (t[2] === "@") n = t[0], s = "mailto:" + n;
					else {
						let r;
						do
							r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
						while (r !== t[0]);
						n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
					}
					return {
						type: "link",
						raw: t[0],
						text: n,
						href: s,
						autolink: !0,
						tokens: [{
							type: "text",
							raw: n,
							text: n
						}]
					};
				}
			}
			inlineText(e) {
				let t = this.rules.inline.text.exec(e);
				if (t) {
					let n = this.lexer.state.inRawBlock;
					return {
						type: "text",
						raw: t[0],
						text: n ? t[0] : Te(t[0]),
						escaped: n
					};
				}
			}
		};
		var R = class l {
			tokens;
			options;
			state;
			inlineQueue;
			tokenizer;
			constructor(e) {
				this.tokens = [], this.tokens.links = Object.create(null), this.options = e || P, this.options.tokenizer = this.options.tokenizer || new y(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = {
					inLink: !1,
					inRawBlock: !1,
					linkEmitted: !1,
					linkParenPossible: !0,
					top: !0
				};
				let t = {
					other: x,
					block: j.normal,
					inline: D.normal
				};
				this.options.pedantic ? (t.block = j.pedantic, t.inline = D.pedantic) : this.options.gfm && (t.block = j.gfm, this.options.breaks ? t.inline = D.breaks : t.inline = D.gfm), this.tokenizer.rules = t;
			}
			static get rules() {
				return {
					block: j,
					inline: D
				};
			}
			static lex(e, t) {
				return new l(t).lex(e);
			}
			static lexInline(e, t) {
				return new l(t).inlineTokens(e);
			}
			lex(e) {
				e = e.replace(x.carriageReturn, `
`), this.blockTokens(e, this.tokens);
				for (let t = 0; t < this.inlineQueue.length; t++) {
					let n = this.inlineQueue[t];
					this.inlineTokens(n.src, n.tokens);
				}
				return this.inlineQueue = [], this.tokens;
			}
			blockTokens(e, t = [], n = !1) {
				this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(x.tabCharGlobal, "    ").replace(x.spaceLine, ""));
				let s = 1 / 0;
				for (; e;) {
					if (e.length < s) s = e.length;
					else {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
					let r;
					if (this.options.extensions?.block?.some((i) => (r = i.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), !0) : !1)) continue;
					if (r = this.tokenizer.space(e)) {
						e = e.substring(r.raw.length);
						let i = t.at(-1);
						r.raw.length === 1 && i !== void 0 ? i.raw += `
` : t.push(r);
						continue;
					}
					if (r = this.tokenizer.code(e)) {
						e = e.substring(r.raw.length);
						let i = t.at(-1);
						i?.type === "paragraph" || i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.at(-1).src = i.text) : t.push(r);
						continue;
					}
					if (r = this.tokenizer.fences(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.heading(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.hr(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.blockquote(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.list(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.html(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.def(e)) {
						e = e.substring(r.raw.length);
						let i = t.at(-1);
						i?.type === "paragraph" || i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.raw, this.inlineQueue.at(-1).src = i.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = {
							href: r.href,
							title: r.title
						}, t.push(r));
						continue;
					}
					if (r = this.tokenizer.table(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					if (r = this.tokenizer.lheading(e)) {
						e = e.substring(r.raw.length), t.push(r);
						continue;
					}
					let o = e;
					if (this.options.extensions?.startBlock) {
						let i = 1 / 0, u = e.slice(1), a;
						this.options.extensions.startBlock.forEach((p) => {
							a = p.call({ lexer: this }, u), typeof a == "number" && a >= 0 && (i = Math.min(i, a));
						}), i < 1 / 0 && i >= 0 && (o = e.substring(0, i + 1));
					}
					if (this.state.top && (r = this.tokenizer.paragraph(o))) {
						let i = t.at(-1);
						n && i?.type === "paragraph" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = i.text) : t.push(r), n = o.length !== e.length, e = e.substring(r.raw.length);
						continue;
					}
					if (r = this.tokenizer.text(e)) {
						e = e.substring(r.raw.length);
						let i = t.at(-1);
						i?.type === "text" ? (i.raw += (i.raw.endsWith(`
`) ? "" : `
`) + r.raw, i.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = i.text) : t.push(r);
						continue;
					}
					if (e) {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
				}
				return this.state.top = !0, t;
			}
			inline(e, t = []) {
				return this.inlineQueue.push({
					src: e,
					tokens: t
				}), t;
			}
			linkInText(e) {
				if (!e.includes("[")) return !1;
				let t = this.tokenizer.rules.inline.link;
				for (let n of e.matchAll(this.tokenizer.rules.inline.blockSkip)) if (t.test(n[0]) && e.charAt(n.index - 1) !== "!") return !0;
				for (let n of e.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
					let s = n[0], r = s.lastIndexOf("[");
					if (!(s.charAt(0) === "!" || !Object.hasOwn(this.tokens.links, q(s.slice(r + 1, -1)))) && !(r > 1 && this.linkInText(s.slice(1, r - 1)))) return !0;
				}
				return !1;
			}
			inlineTokens(e, t = []) {
				this.tokenizer.lexer = this;
				let n = this.state.linkParenPossible;
				this.state.linkParenPossible = n && e.includes(")");
				try {
					return this.#e(e, t);
				} finally {
					this.state.linkParenPossible = n;
				}
			}
			#e(e, t) {
				let n = e;
				if (this.tokens.links && e.includes("[")) {
					let i = this.tokenizer.rules.inline.reflinkSearch, u = (a) => {
						let p = a.lastIndexOf("[");
						if (!Object.hasOwn(this.tokens.links, q(a.slice(p + 1, -1)))) return a;
						if (p > 1 && a.charAt(0) !== "!") {
							let c = a.slice(1, p - 1);
							if (this.linkInText(c)) return "[" + c.replace(i, u) + "][" + "a".repeat(a.length - p - 2) + "]";
						}
						return "[" + "a".repeat(a.length - 2) + "]";
					};
					n = n.replace(i, u);
				}
				n = n.replace(this.tokenizer.rules.inline.anyPunctuation, (i) => "+".repeat(i.length)), n = n.replace(this.tokenizer.rules.inline.blockSkip, (i, u, a) => {
					let p = a ? a.length : 0;
					return i.slice(0, p) + "[" + "a".repeat(i.length - p - 2) + "]";
				}), n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
				let s = !1, r = "", o = 1 / 0;
				for (; e;) {
					if (e.length < o) o = e.length;
					else {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
					s || (r = ""), s = !1;
					let i;
					if (this.options.extensions?.inline?.some((a) => (i = a.call({ lexer: this }, e, t)) ? (e = e.substring(i.raw.length), t.push(i), !0) : !1)) continue;
					if (i = this.tokenizer.escape(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.tag(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.link(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.reflink(e, this.tokens.links)) {
						e = e.substring(i.raw.length);
						let a = t.at(-1);
						i.type === "text" && a?.type === "text" ? (a.raw += i.raw, a.text += i.text) : t.push(i);
						continue;
					}
					if (i = this.tokenizer.emStrong(e, n, r)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.codespan(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.br(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.del(e, n, r)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (i = this.tokenizer.autolink(e)) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					if (!this.state.inLink && (i = this.tokenizer.url(e))) {
						e = e.substring(i.raw.length), t.push(i);
						continue;
					}
					let u = e;
					if (this.options.extensions?.startInline) {
						let a = 1 / 0, p = e.slice(1), c;
						this.options.extensions.startInline.forEach((d) => {
							c = d.call({ lexer: this }, p), typeof c == "number" && c >= 0 && (a = Math.min(a, c));
						}), a < 1 / 0 && a >= 0 && (u = e.substring(0, a + 1));
					}
					if (i = this.tokenizer.inlineText(u)) {
						e = e.substring(i.raw.length), i.raw.slice(-1) !== "_" && (r = i.raw.slice(-1)), s = !0;
						let a = t.at(-1);
						a?.type === "text" ? (a.raw += i.raw, a.text += i.text) : t.push(i);
						continue;
					}
					if (e) {
						this.infiniteLoopError(e.charCodeAt(0));
						break;
					}
				}
				return t;
			}
			infiniteLoopError(e) {
				let t = "Infinite loop on byte: " + e;
				if (this.options.silent) console.error(t);
				else throw new Error(t);
			}
		};
		var S = class {
			options;
			parser;
			constructor(e) {
				this.options = e || P;
			}
			space(e) {
				return "";
			}
			code({ text: e, lang: t, escaped: n }) {
				let s = (t || "").match(x.notSpaceStart)?.[0], r = e ? e.replace(x.endingNewline, "") + `
` : "";
				return s ? "<pre><code class=\"language-" + O(s) + "\">" + (n ? r : O(r, !0)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, !0)) + `</code></pre>
`;
			}
			blockquote({ tokens: e }) {
				return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
			}
			html({ text: e }) {
				return e;
			}
			def(e) {
				return "";
			}
			heading({ tokens: e, depth: t }) {
				return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
			}
			hr(e) {
				return `<hr>
`;
			}
			list(e) {
				let t = e.ordered, n = e.start, s = "";
				for (let i = 0; i < e.items.length; i++) {
					let u = e.items[i];
					s += this.listitem(u);
				}
				let r = t ? "ol" : "ul", o = t && n !== 1 ? " start=\"" + n + "\"" : "";
				return "<" + r + o + `>
` + s + "</" + r + `>
`;
			}
			listitem(e) {
				return `<li>${this.parser.parse(e.tokens)}</li>
`;
			}
			checkbox({ checked: e }) {
				return "<input " + (e ? "checked=\"\" " : "") + "disabled=\"\" type=\"checkbox\"> ";
			}
			paragraph({ tokens: e }) {
				return `<p>${this.parser.parseInline(e)}</p>
`;
			}
			table(e) {
				let t = "", n = "";
				for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
				t += this.tablerow({ text: n });
				let s = "";
				for (let r = 0; r < e.rows.length; r++) {
					let o = e.rows[r];
					n = "";
					for (let i = 0; i < o.length; i++) n += this.tablecell(o[i]);
					s += this.tablerow({ text: n });
				}
				return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
			}
			tablerow({ text: e }) {
				return `<tr>
${e}</tr>
`;
			}
			tablecell(e) {
				let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
				return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
			}
			strong({ tokens: e }) {
				return `<strong>${this.parser.parseInline(e)}</strong>`;
			}
			em({ tokens: e }) {
				return `<em>${this.parser.parseInline(e)}</em>`;
			}
			codespan({ text: e }) {
				return `<code>${O(e, !0)}</code>`;
			}
			br(e) {
				return "<br>";
			}
			del({ tokens: e }) {
				return `<del>${this.parser.parseInline(e)}</del>`;
			}
			link({ href: e, title: t, text: n, tokens: s, autolink: r }) {
				let o = r ? O(n, !0) : this.parser.parseInline(s), i = re(e);
				if (i === null) return o;
				e = O(i, r);
				let u = "<a href=\"" + e + "\"";
				return t && (u += " title=\"" + O(t) + "\""), u += ">" + o + "</a>", u;
			}
			image({ href: e, title: t, text: n, tokens: s }) {
				s && (n = this.parser.parseInline(s, this.parser.textRenderer));
				let r = re(e);
				if (r === null) return O(n);
				e = r;
				let o = `<img src="${O(e)}" alt="${O(n)}"`;
				return t && (o += ` title="${O(t)}"`), o += ">", o;
			}
			text(e) {
				return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
			}
		};
		var z = class {
			strong({ text: e }) {
				return e;
			}
			em({ text: e }) {
				return e;
			}
			codespan({ text: e }) {
				return e;
			}
			del({ text: e }) {
				return e;
			}
			html({ text: e }) {
				return e;
			}
			text({ text: e }) {
				return e;
			}
			link({ text: e }) {
				return "" + e;
			}
			image({ text: e }) {
				return "" + e;
			}
			br() {
				return "";
			}
			checkbox({ raw: e }) {
				return e;
			}
		};
		var T = class l {
			options;
			renderer;
			textRenderer;
			constructor(e) {
				this.options = e || P, this.options.renderer = this.options.renderer || new S(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new z();
			}
			static parse(e, t) {
				return new l(t).parse(e);
			}
			static parseInline(e, t) {
				return new l(t).parseInline(e);
			}
			parse(e) {
				this.renderer.parser = this;
				let t = "";
				for (let n = 0; n < e.length; n++) {
					let s = e[n];
					if (this.options.extensions?.renderers?.[s.type]) {
						let o = s, i = this.options.extensions.renderers[o.type].call({ parser: this }, o);
						if (i !== !1 || ![
							"space",
							"hr",
							"heading",
							"code",
							"table",
							"blockquote",
							"list",
							"checkbox",
							"html",
							"def",
							"paragraph",
							"text"
						].includes(o.type)) {
							t += i || "";
							continue;
						}
					}
					let r = s;
					switch (r.type) {
						case "space":
							t += this.renderer.space(r);
							break;
						case "hr":
							t += this.renderer.hr(r);
							break;
						case "heading":
							t += this.renderer.heading(r);
							break;
						case "code":
							t += this.renderer.code(r);
							break;
						case "table":
							t += this.renderer.table(r);
							break;
						case "blockquote":
							t += this.renderer.blockquote(r);
							break;
						case "list":
							t += this.renderer.list(r);
							break;
						case "checkbox":
							t += this.renderer.checkbox(r);
							break;
						case "html":
							t += this.renderer.html(r);
							break;
						case "def":
							t += this.renderer.def(r);
							break;
						case "paragraph":
							t += this.renderer.paragraph(r);
							break;
						case "text":
							t += this.renderer.text(r);
							break;
						default: {
							let o = "Token with \"" + r.type + "\" type was not found.";
							if (this.options.silent) return console.error(o), "";
							throw new Error(o);
						}
					}
				}
				return t;
			}
			parseInline(e, t = this.renderer) {
				this.renderer.parser = this;
				let n = "";
				for (let s = 0; s < e.length; s++) {
					let r = e[s];
					if (this.options.extensions?.renderers?.[r.type]) {
						let i = this.options.extensions.renderers[r.type].call({ parser: this }, r);
						if (i !== !1 || ![
							"escape",
							"html",
							"link",
							"image",
							"checkbox",
							"strong",
							"em",
							"codespan",
							"br",
							"del",
							"text"
						].includes(r.type)) {
							n += i || "";
							continue;
						}
					}
					let o = r;
					switch (o.type) {
						case "escape":
							n += t.text(o);
							break;
						case "html":
							n += t.html(o);
							break;
						case "link":
							n += t.link(o);
							break;
						case "image":
							n += t.image(o);
							break;
						case "checkbox":
							n += t.checkbox(o);
							break;
						case "strong":
							n += t.strong(o);
							break;
						case "em":
							n += t.em(o);
							break;
						case "codespan":
							n += t.codespan(o);
							break;
						case "br":
							n += t.br(o);
							break;
						case "del":
							n += t.del(o);
							break;
						case "text":
							n += t.text(o);
							break;
						default: {
							let i = "Token with \"" + o.type + "\" type was not found.";
							if (this.options.silent) return console.error(i), "";
							throw new Error(i);
						}
					}
				}
				return n;
			}
		};
		var _ = class {
			options;
			block;
			constructor(e) {
				this.options = e || P;
			}
			static passThroughHooks = /* @__PURE__ */ new Set([
				"preprocess",
				"postprocess",
				"processAllTokens",
				"emStrongMask"
			]);
			static passThroughHooksRespectAsync = /* @__PURE__ */ new Set([
				"preprocess",
				"postprocess",
				"processAllTokens"
			]);
			preprocess(e) {
				return e;
			}
			postprocess(e) {
				return e;
			}
			processAllTokens(e) {
				return e;
			}
			emStrongMask(e) {
				return e;
			}
			provideLexer(e = this.block) {
				return e ? R.lex : R.lexInline;
			}
			provideParser(e = this.block) {
				return e ? T.parse : T.parseInline;
			}
		};
		var F = class {
			defaults = I();
			options = this.setOptions;
			parse = this.parseMarkdown(!0);
			parseInline = this.parseMarkdown(!1);
			Parser = T;
			Renderer = S;
			TextRenderer = z;
			Lexer = R;
			Tokenizer = y;
			Hooks = _;
			constructor(...e) {
				this.use(...e);
			}
			walkTokens(e, t) {
				let n = [];
				for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
					case "table": {
						let r = s;
						for (let o of r.header) n = n.concat(this.walkTokens(o.tokens, t));
						for (let o of r.rows) for (let i of o) n = n.concat(this.walkTokens(i.tokens, t));
						break;
					}
					case "list": {
						let r = s;
						n = n.concat(this.walkTokens(r.items, t));
						break;
					}
					default: {
						let r = s;
						this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((o) => {
							let i = r[o].flat(1 / 0);
							n = n.concat(this.walkTokens(i, t));
						}) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
					}
				}
				return n;
			}
			use(...e) {
				let t = this.defaults.extensions || {
					renderers: {},
					childTokens: {}
				};
				return e.forEach((n) => {
					let s = { ...n };
					if (s.async = this.defaults.async || s.async || !1, n.extensions && (n.extensions.forEach((r) => {
						if (!r.name) throw new Error("extension name required");
						if ("renderer" in r) {
							let o = t.renderers[r.name];
							o ? t.renderers[r.name] = function(...i) {
								let u = r.renderer.apply(this, i);
								return u === !1 && (u = o.apply(this, i)), u;
							} : t.renderers[r.name] = r.renderer;
						}
						if ("tokenizer" in r) {
							if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
							let o = t[r.level];
							o ? o.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
						}
						"childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
					}), s.extensions = t), n.renderer) {
						let r = this.defaults.renderer || new S(this.defaults);
						for (let o in n.renderer) {
							if (!(o in r)) throw new Error(`renderer '${o}' does not exist`);
							if (["options", "parser"].includes(o)) continue;
							let i = o, u = n.renderer[i], a = r[i];
							r[i] = (...p) => {
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c || "";
							};
						}
						s.renderer = r;
					}
					if (n.tokenizer) {
						let r = this.defaults.tokenizer || new y(this.defaults);
						for (let o in n.tokenizer) {
							if (!(o in r)) throw new Error(`tokenizer '${o}' does not exist`);
							if ([
								"options",
								"rules",
								"lexer"
							].includes(o)) continue;
							let i = o, u = n.tokenizer[i], a = r[i];
							r[i] = (...p) => {
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c;
							};
						}
						s.tokenizer = r;
					}
					if (n.hooks) {
						let r = this.defaults.hooks || new _();
						for (let o in n.hooks) {
							if (!(o in r)) throw new Error(`hook '${o}' does not exist`);
							if (["options", "block"].includes(o)) continue;
							let i = o, u = n.hooks[i], a = r[i];
							_.passThroughHooks.has(o) ? r[i] = (p) => {
								if (this.defaults.async && _.passThroughHooksRespectAsync.has(o)) return (async () => {
									let d = await u.call(r, p);
									return a.call(r, d);
								})();
								let c = u.call(r, p);
								return a.call(r, c);
							} : r[i] = (...p) => {
								if (this.defaults.async) return (async () => {
									let d = await u.apply(r, p);
									return d === !1 && (d = await a.apply(r, p)), d;
								})();
								let c = u.apply(r, p);
								return c === !1 && (c = a.apply(r, p)), c;
							};
						}
						s.hooks = r;
					}
					if (n.walkTokens) {
						let r = this.defaults.walkTokens, o = n.walkTokens;
						s.walkTokens = function(i) {
							let u = [];
							return u.push(o.call(this, i)), r && (u = u.concat(r.call(this, i))), u;
						};
					}
					this.defaults = {
						...this.defaults,
						...s
					};
				}), this;
			}
			setOptions(e) {
				return this.defaults = {
					...this.defaults,
					...e
				}, this;
			}
			lexer(e, t) {
				return R.lex(e, t ?? this.defaults);
			}
			parser(e, t) {
				return T.parse(e, t ?? this.defaults);
			}
			parseMarkdown(e) {
				return (n, s) => {
					let r = { ...s }, o = {
						...this.defaults,
						...r
					}, i = this.onError(!!o.silent, !!o.async);
					if (this.defaults.async === !0 && r.async === !1) return i(/* @__PURE__ */ new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
					if (typeof n > "u" || n === null) return i(/* @__PURE__ */ new Error("marked(): input parameter is undefined or null"));
					if (typeof n != "string") return i(/* @__PURE__ */ new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
					if (o.hooks && (o.hooks.options = o, o.hooks.block = e), o.async) return (async () => {
						let u = o.hooks ? await o.hooks.preprocess(n) : n, p = await (o.hooks ? await o.hooks.provideLexer(e) : e ? R.lex : R.lexInline)(u, o), c = o.hooks ? await o.hooks.processAllTokens(p) : p;
						o.walkTokens && await Promise.all(this.walkTokens(c, o.walkTokens));
						let m = await (o.hooks ? await o.hooks.provideParser(e) : e ? T.parse : T.parseInline)(c, o);
						return o.hooks ? await o.hooks.postprocess(m) : m;
					})().catch(i);
					try {
						o.hooks && (n = o.hooks.preprocess(n));
						let a = (o.hooks ? o.hooks.provideLexer(e) : e ? R.lex : R.lexInline)(n, o);
						o.hooks && (a = o.hooks.processAllTokens(a)), o.walkTokens && this.walkTokens(a, o.walkTokens);
						let c = (o.hooks ? o.hooks.provideParser(e) : e ? T.parse : T.parseInline)(a, o);
						return o.hooks && (c = o.hooks.postprocess(c)), c;
					} catch (u) {
						return i(u);
					}
				};
			}
			onError(e, t) {
				return (n) => {
					if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
						let s = "<p>An error occurred:</p><pre>" + O(n.message + "", !0) + "</pre>";
						return t ? Promise.resolve(s) : s;
					}
					if (t) return Promise.reject(n);
					throw n;
				};
			}
		};
		var E = new F();
		function k(l, e) {
			return E.parse(l, e);
		}
		k.options = k.setOptions = function(l) {
			return E.setOptions(l), k.defaults = E.defaults, W(k.defaults), k;
		};
		k.getDefaults = I;
		k.defaults = P;
		function yt(...l) {
			return E.use(...l), k.defaults = E.defaults, W(k.defaults), k;
		}
		k.use = yt;
		k.walkTokens = function(l, e) {
			return E.walkTokens(l, e);
		};
		k.parseInline = E.parseInline;
		k.Parser = T;
		k.parser = T.parse;
		k.Renderer = S;
		k.TextRenderer = z;
		k.Lexer = R;
		k.lexer = R.lex;
		k.Tokenizer = y;
		k.Hooks = _;
		k.parse = k;
		k.options;
		k.setOptions;
		k.walkTokens;
		k.parseInline;
		T.parse;
		R.lex;
		//#endregion
		//#region src/client/workbench/FilePane.tsx
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
		const PORTS = [
			7917,
			7918,
			7919
		];
		let cached;
		async function resolveFileBase() {
			if (cached !== void 0) return cached;
			for (const port of PORTS) try {
				const ctl = new AbortController();
				const t = setTimeout(() => ctl.abort(), 1200);
				const res = await fetch(`http://127.0.0.1:${port}/newtype/file`, { signal: ctl.signal });
				clearTimeout(t);
				if (res.status === 400) {
					cached = `http://127.0.0.1:${port}`;
					return cached;
				}
			} catch {}
			cached = null;
			return cached;
		}
		/** 走自绘文本的扩展名（其余：图片/html 交 iframe 原生渲染） */
		const TEXT_EXT = /\.(md|markdown|yml|yaml|json|txt|log|csv|tsv)$/i;
		const IS_MD = /\.(md|markdown)$/i;
		/**
		* E41e：md → srcDoc HTML（marked 打包内置 + mermaid CDN 懒加载）。
		* mermaid 走 jsdelivr ESM：加载失败（断网/被墙）自动保留代码原样，不影响正文。
		* 主题：读宿主根元素 color-scheme（E36 口径），dark→mermaid dark 主题。
		*/
		function buildMdDoc(md) {
			let body = k.parse(md, {
				async: false,
				gfm: true,
				breaks: true
			});
			const dark = typeof document !== "undefined" && getComputedStyle(document.documentElement).colorScheme !== "light";
			body = body.replace(/<\/script/gi, "<\\/script");
			const theme = dark ? "dark" : "default";
			const fg = dark ? "#d8d5d0" : "#16181d";
			const bg = dark ? "#16181d" : "#ffffff";
			const codeBg = dark ? "#0f1113" : "#f3f4f6";
			const line = dark ? "#2b2e33" : "#e5e7eb";
			return `<!doctype html><html><head><meta charset="utf-8"><style>
html{color-scheme:${dark ? "dark" : "light"}}
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
<\/script>
<script type="module">
try {
  const m = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
  m.default.initialize({ startOnLoad: false, theme: '${theme}', fontFamily: 'inherit' })
  await m.default.run()
} catch (e) { /* mermaid CDN 不可达：代码块原样保留 */ }
<\/script></body></html>`;
		}
		function FilePane({ path }) {
			const [base, setBase] = (0, react.useState)(cached ?? null);
			const [text, setText] = (0, react.useState)(null);
			const [textErr, setTextErr] = (0, react.useState)("");
			const isText = TEXT_EXT.test(path);
			const isMd = IS_MD.test(path);
			(0, react.useEffect)(() => {
				let alive = true;
				resolveFileBase().then((b) => {
					if (alive) setBase(b);
				});
				return () => {
					alive = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (!base || !path || !isText) {
					setText(null);
					setTextErr("");
					return;
				}
				let alive = true;
				setTextErr("");
				fetch(`${base}/newtype/file?path=${encodeURIComponent(path)}`).then(async (r) => {
					const body = await r.text();
					if (!alive) return;
					if (!r.ok) {
						setTextErr(`${r.status} ${body.slice(0, 120)}`);
						setText(null);
						return;
					}
					setText(body);
				}).catch((e) => {
					if (alive) {
						setText(null);
						setTextErr(String(e));
					}
				});
				return () => {
					alive = false;
				};
			}, [
				base,
				path,
				isText
			]);
			const src = base && path ? `${base}/newtype/file?path=${encodeURIComponent(path)}` : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: newtype_module_css_default.webPane,
				children: path ? base ? isText ? textErr ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: newtype_module_css_default.pempty,
					children: ["读取失败：", textErr]
				}) : text !== null ? isMd ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
					className: newtype_module_css_default.pif,
					srcDoc: buildMdDoc(text),
					title: path,
					sandbox: "allow-scripts allow-popups allow-popups-to-escape-sandbox"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
					style: {
						flex: 1,
						minHeight: 0,
						margin: 0,
						overflow: "auto",
						padding: "14px 16px",
						font: "12px/1.6 ui-monospace, Consolas, monospace",
						color: "var(--dsh-text, #d8d5d0)",
						background: "var(--trellis-stage, #16181d)",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						userSelect: "text"
					},
					children: text
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.pempty,
					children: "读取中…"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
					className: newtype_module_css_default.pif,
					src,
					title: path
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.pempty,
					children: "文件服务未就绪（host 半未挂载）"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.pempty,
					children: "缺少文件路径"
				})
			});
		}
		//#endregion
		//#region src/client/workbench/WebPane.tsx
		/**
		* 浏览器窗格（E32 → E40 双引擎）：工作台内置内部浏览器。
		*
		* E40（2026-10-10）：Desktop 态接 `globalThis.dshDesktop.browser` 桥 + Electron
		* <webview>——不受 X-Frame-Options 约束，大站不再白屏。协议照抄官方
		* dsh-client-ui-sidebar-browser（只读查证 2026-10-10，05 §E40）：
		*   acquire(workspace) → {lease, partition}
		*   webview 五属性：name=lease / partition / allowpopups / src=about:blank#<lease>
		*   dom-ready → loadURL(真 URL)；onOpenRequested(lease, cb) 收 popup
		*   render-process-gone / destroyed → release + error 态，重试时重新 acquire
		* 无桥（web 版 / 协议不符 / acquire 失败）→ 回落 iframe（XFO 限制同官方）
		* + 「外部打开」按钮兜底。
		*
		* 保活口径：隐藏不卸载（卸载 = release，guest 被主进程销毁）；trellis 若在
		* tab 隐藏时 unmount，重挂会按 params.url 重载——与 iframe 行为一致。
		*/
		const normalize = (raw) => {
			const t = raw.trim();
			if (!t) return "";
			if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
			return `http://${t}`;
		};
		/** 探测 Desktop 桥：protocolVersion===1 才认（同官方 client.js:1597-1598）。 */
		function desktopBridge() {
			const c = globalThis.dshDesktop;
			return c?.protocolVersion === 1 && c.browser ? c.browser : null;
		}
		/** 所有自绘 web tab 共用一个存储账户（同官方 cwd 粒度；key 只要进程内稳定即可）。 */
		const WORKSPACE_KEY = "cwd:dsh-newtype-workbench";
		/**
		* webview 引擎：挂载时 acquire + 建元素 + 引导；卸载时 release。
		* URL 变化走 pending 队列（ready 前只记账，dom-ready 后 loadURL——同官方）。
		*/
		function WebviewEngine(props) {
			const hostRef = (0, react.useRef)(null);
			const st = (0, react.useRef)({ ready: false });
			const onPopupRef = (0, react.useRef)(props.onPopup);
			onPopupRef.current = props.onPopup;
			const onFailedRef = (0, react.useRef)(props.onFailed);
			onFailedRef.current = props.onFailed;
			(0, react.useEffect)(() => {
				const bridge = props.bridge;
				let dead = false;
				let unsubOpen;
				let leaseHeld;
				const drop = async () => {
					const lease = leaseHeld;
					leaseHeld = void 0;
					st.current = { ready: false };
					if (lease) try {
						await bridge.release(lease);
					} catch {}
				};
				(async () => {
					let res;
					try {
						res = await bridge.acquire(WORKSPACE_KEY);
					} catch (e) {
						if (!dead) onFailedRef.current(`租约获取失败：${String(e)}`);
						return;
					}
					if (dead) {
						bridge.release(res.lease);
						return;
					}
					leaseHeld = res.lease;
					st.current.lease = res.lease;
					const el = document.createElement("webview");
					el.setAttribute("name", res.lease);
					el.setAttribute("partition", res.partition);
					el.setAttribute("allowpopups", "");
					el.setAttribute("src", "about:blank#" + res.lease);
					el.style.width = "100%";
					el.style.height = "100%";
					el.style.border = "0";
					st.current.element = el;
					unsubOpen = bridge.onOpenRequested(res.lease, (url) => {
						if (!dead) onPopupRef.current(url);
					});
					el.addEventListener("dom-ready", () => {
						st.current.ready = true;
						const pending = st.current.pending;
						st.current.pending = void 0;
						if (pending) el.loadURL(pending);
					});
					const onGone = () => {
						if (dead) return;
						drop();
						onFailedRef.current("浏览进程已退出");
					};
					el.addEventListener("render-process-gone", onGone);
					el.addEventListener("destroyed", onGone);
					el.addEventListener("did-attach", () => {
						console.info("[dsh-newtype] webview did-attach");
					});
					el.addEventListener("did-fail-load", (ev) => {
						const d = ev.detail;
						if (d?.isMainFrame === false) return;
						console.warn("[dsh-newtype] webview did-fail-load", d?.errorCode, d?.errorDescription);
					});
					el.addEventListener("did-navigate", (ev) => {
						console.info("[dsh-newtype] webview did-navigate →", ev.detail?.url);
					});
					if (dead) return;
					hostRef.current?.append(el);
					st.current.pending = props.url || void 0;
				})();
				return () => {
					dead = true;
					unsubOpen?.();
					st.current.element?.remove();
					drop();
				};
			}, []);
			(0, react.useEffect)(() => {
				const cur = st.current;
				cur.pending = props.url || void 0;
				if (cur.ready && props.url && cur.element) cur.element.loadURL(props.url);
			}, [props.url]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: hostRef,
				className: newtype_module_css_default.webFrame,
				"data-nt": "webview-host"
			});
		}
		function WebPane(props) {
			const bridge = (0, react.useMemo)(desktopBridge, []);
			(0, react.useEffect)(() => {
				console.info("[dsh-newtype] browser bridge =", bridge ? "webview(桌面)" : "iframe(无桥)");
			}, [bridge]);
			const [draft, setDraft] = (0, react.useState)(props.url ?? "");
			(0, react.useEffect)(() => {
				setDraft(props.url ?? "");
			}, [props.url]);
			const [engineFailed, setEngineFailed] = (0, react.useState)(false);
			const [engineKey, setEngineKey] = (0, react.useState)(0);
			const useWebview = bridge !== null && !engineFailed;
			const go = (raw) => {
				const u = normalize(raw);
				if (u) props.setParams({ url: u });
			};
			const openExternal = (u) => {
				window.open(u, "_blank", "noopener");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: newtype_module_css_default.webPane,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.webBar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: newtype_module_css_default.webUrl,
								value: draft,
								placeholder: "输入地址，如 localhost:3080 或 example.com",
								onChange: (e) => setDraft(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter") go(draft);
								},
								spellCheck: false
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: newtype_module_css_default.webGo,
								onClick: () => go(draft),
								title: "转到",
								children: "→"
							}),
							props.url && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: newtype_module_css_default.webGo,
								onClick: () => {
									if (props.url) openExternal(props.url);
								},
								title: "外部浏览器打开",
								children: "↗"
							}),
							props.url && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: newtype_module_css_default.webGo,
								onClick: () => props.setParams({ url: "" }),
								title: "关闭页面",
								children: "✕"
							})
						]
					}),
					props.url ? useWebview && bridge ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WebviewEngine, {
						url: props.url,
						bridge,
						onPopup: (u) => props.openWebTab?.(normalize(u)),
						onFailed: (msg) => {
							setEngineFailed(true);
							console.warn("[dsh-newtype] webview engine fallback to iframe:", msg);
						}
					}, engineKey) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
						className: newtype_module_css_default.webFrame,
						src: props.url,
						title: props.url
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.pempty,
						children: ["输入地址打开页面", !bridge && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								marginTop: 8,
								opacity: .6
							},
							children: "web 版走 iframe，部分站点拒绝嵌入时用 ↗ 外部打开"
						})]
					}),
					engineFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							position: "absolute",
							bottom: 0,
							left: 12,
							right: 12,
							fontSize: 11,
							opacity: .65,
							padding: "4px 0"
						},
						children: ["webview 不可用已回落 iframe。", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: newtype_module_css_default.webGo,
							style: { marginLeft: 6 },
							onClick: () => {
								setEngineFailed(false);
								setEngineKey((k) => k + 1);
							},
							children: "重试 webview"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/workbench/ArtifactsPanel.tsx
		/**
		* 产出物面板（两个形态）：
		*  - mode="session"：右栏 pane.tab body（挂某会话，scope 自带 sessionId）
		*  - mode="global"：工作台右侧栏（trellis Preview 式）：新到（任意会话）+ 收件箱 两节
		* 数据全走 pages.ts 共享索引；点击 = 过目 + 进工作台焦点窗格。
		*/
		function Row({ id, name, fresh }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-nt": "artrow",
				className: newtype_module_css_default.row,
				title: name + "\n点击进工作台窗格",
				onClick: () => {
					markSeen([id]);
					openTabBus.emit("page:" + id);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: newtype_module_css_default.ico + (fresh ? " " + newtype_module_css_default.icoFresh : ""),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						viewBox: "0 0 24 24",
						className: newtype_module_css_default.ic,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M9 13h6M9 17h6" })
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: newtype_module_css_default.t,
					children: name
				})]
			});
		}
		function ArtifactsPanel(props) {
			const pages = usePages();
			const global = props.mode === "global";
			const sid = props.sessionId ?? null;
			const fresh = pages.list.filter((p) => isFresh(p.id));
			const inbox = pages.list.filter((p) => !isFresh(p.id) && attributedTo(p.id) === "");
			const mine = pages.list.filter((p) => attributedTo(p.id) === (sid ?? ""));
			if (!global) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-nt": "artpanel",
				className: newtype_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: newtype_module_css_default.hd,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "产出物" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: newtype_module_css_default.count,
						children: mine.length
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: newtype_module_css_default.list,
					children: [mine.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
						id: p.id,
						name: p.name,
						fresh: isFresh(p.id)
					}, p.id)), !mine.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: newtype_module_css_default.empty,
						children: "暂无产出页"
					})]
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-nt": "artpanel",
				"data-nt-mode": "global",
				className: newtype_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.hd,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "新到" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: newtype_module_css_default.count,
							"data-nt": "artfresh",
							children: fresh.length
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.list,
						style: {
							flex: "none",
							maxHeight: "40%"
						},
						children: [fresh.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
							id: p.id,
							name: p.name,
							fresh: true
						}, p.id)), !fresh.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: newtype_module_css_default.empty,
							children: "无新到页"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.hd,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "收件箱" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: newtype_module_css_default.count,
							children: inbox.length
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.list,
						children: [inbox.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
							id: p.id,
							name: p.name,
							fresh: false
						}, p.id)), !inbox.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: newtype_module_css_default.empty,
							children: "收件箱空"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/workbench/SessionAccessories.tsx
		/**
		* trellis accessory 位的三件套（D15 落地，对应 demo v4 交互）：
		*  ① OpenInMenu   —— 原版 "Open In..." 同款：用外部应用打开当前工作区目录。
		*                    真机数据源 = dsh-host-open-in-app 的 catalog 路由（探测/图标/启动）；
		*                    本轮先上 UI 骨架 + 静态白名单，接路由是独立小步（05 待办）。
		*  ② GearMenu     —— 会话功能：对话/轨迹切换（view.setParams，随布局持久化）、
		*                    当前模式行、下载对话日志（占位，接宿主 transcript 后启用）。
		*  ③ RightbarToggle —— 宿主右栏开关：ctx.layout.openRightbar/closeRightbar。
		*                    右栏全局共用一个，内容跟随聚焦窗格会话（原版架构）。
		*
		* accessory 挂点 = trellis per-surface 的 tab 条右端（每窗格一份）；
		* 菜单必须 portal 到 body —— tabbar overflow:hidden + .trellis contain:strict 双重裁剪（demo 实证）。
		*/
		const ic = {
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 1,
			strokeLinecap: "round",
			strokeLinejoin: "round"
		};
		function Ico(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 24 24",
				width: props.size ?? 16,
				height: props.size ?? 16,
				style: {
					...ic,
					flex: "none",
					display: "block"
				},
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: props.d })
			});
		}
		const D_FOLDER = "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z";
		const D_GEAR = "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";
		const D_DOWN = "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3";
		const D_SWAP = "M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4";
		const D_GLOBE = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18";
		const NT_VARS = {
			dark: {
				"--dsh-bg": "#131110",
				"--dsh-surface": "#1e1c1a",
				"--dsh-overlay": "#1b1917",
				"--dsh-line": "#262422",
				"--dsh-text": "#f4f2f0",
				"--dsh-text-secondary": "#86827e",
				"--dsh-primary": "#69a1e8",
				"--dsh-faint": "#5b5854"
			},
			light: {
				"--dsh-bg": "#ffffff",
				"--dsh-surface": "#eef0f3",
				"--dsh-overlay": "#f9fafb",
				"--dsh-line": "rgba(0, 0, 0, 0.12)",
				"--dsh-text": "#0f1115",
				"--dsh-text-secondary": "#5a6472",
				"--dsh-primary": "#3a6ff7",
				"--dsh-faint": "#9aa1ab"
			}
		};
		/** 弹出菜单通用壳：fixed 定位（防 tabbar/contain 裁剪）+ hover 延迟关闭 */
		function usePop() {
			const [open, setOpen] = (0, react.useState)(false);
			const [pos, setPos] = (0, react.useState)({
				x: 0,
				y: 0
			});
			const btnRef = (0, react.useRef)(null);
			const closeT = (0, react.useRef)(void 0);
			const arm = () => {
				clearTimeout(closeT.current);
				closeT.current = setTimeout(() => setOpen(false), 260);
			};
			const cancel = () => clearTimeout(closeT.current);
			const show = () => {
				const r = btnRef.current?.getBoundingClientRect();
				if (r) setPos({
					x: r.right,
					y: r.bottom + 6
				});
				cancel();
				setOpen(true);
			};
			return {
				open,
				setOpen,
				pos,
				btnRef,
				arm,
				cancel,
				show
			};
		}
		const APP_META = {
			vscode: {
				name: "VS Code",
				cat: "编辑器 · IDE"
			},
			vscodeinsiders: {
				name: "VS Code Insiders",
				cat: "编辑器 · IDE"
			},
			cursor: {
				name: "Cursor",
				cat: "编辑器 · IDE"
			},
			windsurf: {
				name: "Windsurf",
				cat: "编辑器 · IDE"
			},
			zed: {
				name: "Zed",
				cat: "编辑器 · IDE"
			},
			sublimetext: {
				name: "Sublime Text",
				cat: "编辑器 · IDE"
			},
			windowsterminal: {
				name: "Windows Terminal",
				cat: "终端"
			},
			warp: {
				name: "Warp",
				cat: "终端"
			},
			explorer: {
				name: "文件资源管理器",
				cat: "文件管理器"
			},
			filemanager: {
				name: "文件管理器",
				cat: "文件管理器"
			},
			finder: {
				name: "Finder",
				cat: "文件管理器"
			}
		};
		const CAT_ORDER = [
			"编辑器 · IDE",
			"终端",
			"文件管理器"
		];
		const OPENIN_CHOICE_KEY = "dsh-newtype.openin.choice";
		async function fetchAppIds() {
			const res = await fetch("/open-in-app/apps", { headers: { accept: "application/json" } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const payload = await res.json();
			return Array.isArray(payload.apps) ? payload.apps.filter((x) => typeof x === "string") : [];
		}
		function OpenInMenu(props) {
			const pop = usePop();
			const [ids, setIds] = (0, react.useState)(null);
			const [failed, setFailed] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [remembered, setRemembered] = (0, react.useState)(() => {
				try {
					return localStorage.getItem(OPENIN_CHOICE_KEY) ?? "";
				} catch {
					return "";
				}
			});
			const load = () => {
				if (ids || failed) return;
				fetchAppIds().then(setIds).catch(() => setFailed(true));
			};
			const pick = async (id) => {
				try {
					localStorage.setItem(OPENIN_CHOICE_KEY, id);
				} catch {}
				setRemembered(id);
				const path = props.getCwd?.();
				if (!path) {
					pop.setOpen(false);
					return;
				}
				setBusy(true);
				try {
					const res = await fetch("/open-in-app/open", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							app: id,
							path
						})
					});
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					pop.setOpen(false);
				} catch {} finally {
					setBusy(false);
				}
			};
			const groups = CAT_ORDER.map((cat) => ({
				cat,
				apps: (ids ?? []).filter((id) => APP_META[id]?.cat === cat)
			})).filter((g) => g.apps.length > 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "nt-accwrap",
				onMouseLeave: pop.arm,
				onMouseEnter: () => {
					pop.cancel();
					load();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					ref: pop.btnRef,
					className: pop.open ? "nt-abtn on" : "nt-abtn",
					title: remembered && APP_META[remembered] ? `用「${APP_META[remembered].name}」打开会话目录` : "Open In… · 打开会话目录",
					onMouseEnter: () => {
						pop.show();
						load();
					},
					onClick: () => pop.open ? pop.setOpen(false) : pop.show(),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_FOLDER })
				}), pop.open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "nt-menu",
					style: {
						position: "fixed",
						top: pop.pos.y,
						left: Math.max(8, pop.pos.x - 190),
						...props.vars ?? {}
					},
					onMouseEnter: pop.cancel,
					onMouseLeave: pop.arm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "nt-mi static",
							children: "在以下应用中打开会话目录"
						}),
						failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "nt-mi static",
							children: "宿主未提供打开服务"
						}),
						!failed && ids !== null && groups.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "nt-mi static",
							children: "未探测到可用应用"
						}),
						groups.map((g) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "nt-cat",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "nt-catname",
								children: g.cat
							}), g.apps.map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: "nt-mi" + (id === remembered ? " sel" : ""),
								disabled: busy,
								onClick: () => {
									pick(id);
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_FOLDER }),
									APP_META[id]?.name ?? id,
									id === remembered && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "nt-mk",
										children: "记住"
									})
								]
							}, id))]
						}, g.cat))
					]
				}), document.body)]
			});
		}
		function GearMenu(props) {
			const pop = usePop();
			const mode = props.mode;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "nt-accwrap",
				onMouseLeave: pop.arm,
				onMouseEnter: pop.cancel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					ref: pop.btnRef,
					className: pop.open ? "nt-abtn on" : "nt-abtn",
					title: "会话功能",
					onMouseEnter: pop.show,
					onClick: () => pop.open ? pop.setOpen(false) : pop.show(),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_GEAR })
				}), pop.open && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "nt-menu",
					style: {
						position: "fixed",
						top: pop.pos.y,
						left: Math.max(8, pop.pos.x - 190),
						...props.vars ?? {}
					},
					onMouseEnter: pop.cancel,
					onMouseLeave: pop.arm,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: "nt-mi",
							onClick: () => {
								pop.setOpen(false);
								props.setParams({ mode: mode === "chat" ? "trace" : "chat" });
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_SWAP }),
								"切换到",
								mode === "chat" ? "轨迹" : "对话"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "nt-mi static",
							children: ["当前模式：", mode === "chat" ? "对话 · 标准" : "轨迹 · 标准"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: "nt-mi",
							title: "接宿主 transcript 导出后启用",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_DOWN }), "下载对话日志"]
						})
					]
				}), document.body)]
			});
		}
		function BrowserButton(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				className: "nt-abtn",
				title: "打开浏览器",
				"aria-label": "打开浏览器",
				onClick: props.onOpen,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ico, { d: D_GLOBE })
			});
		}
		/** accessory 行的总装：view 句柄 + 右栏服务由 WorkbenchView 注入 */
		function SessionAccessories(props) {
			const mode = props.view.params?.mode === "trace" ? "trace" : "chat";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "nt-accrow",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(OpenInMenu, {
						getCwd: props.getCwd,
						vars: props.vars
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GearMenu, {
						setParams: props.view.setParams,
						mode,
						vars: props.vars
					}),
					props.onOpenBrowser && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrowserButton, { onOpen: props.onOpenBrowser })
				]
			});
		}
		//#endregion
		//#region src/client/workbench/WorkbenchView.tsx
		/**
		* NewType 工作台（main key 'newtype' + conversation.view 双注册体）—— D15 trellis 版：
		* 布局骨架整体交给 @danfessler/trellis 0.3.0（拖拽 dock / 并入 / zoom / 持久化 / 动画原装），
		* D2 自制 split 树（layout/state.ts + layout/Workspace.tsx）退休不删（回滚留底，测试仍覆盖纯逻辑层）。
		*
		* 窗格内容 = 宿主原版对话框（HostConversationPane，D14-R2），经 props 闭包注入 trellis view；
		* 降级链不变（SessionPane 兜底）。
		*
		* 拖拽桥（D15）：宿主左栏行是 HTML5 DnD 源（D14 实证 text/plain 带会话 id），
		* trellis 是 pointer 手势，两套不通 → 根容器补 dragover/drop，drop 翻译成 ws.open。
		*
		* children 声明里的 session 作用域子槽仍是硬前提：框架只在「声明了非 root 作用域
		* 子槽」的组件 props 上装 SessionProvider（ui-renderer client.js:732-740）。
		*/
		const TRELLIS_STORAGE_KEY = "dsh-newtype.trellis.v1";
		/** 字号/字体对齐 DSH 原版（2026-10-09 主人要求）：tab 14px（原 12.5 显小）、字体继承宿主栈；
		*  Y 向加长（同日追加）：tab 条 34→40px、内衬 8→6px，tab 本体 18→28px 高 */
		const TRELLIS_FONT_TOKENS = {
			"--trellis-font": "inherit",
			"--trellis-font-size": "14px",
			"--trellis-tabbar-height": "40px",
			"--trellis-tab-inset": "6px"
		};
		/** dark 主题的 DSH 深黑口径（demo 同款 tokens，2026-10-09 回退保持原值） */
		const TRELLIS_DARK_TOKENS = {
			"--trellis-bg": "#0c0d0f",
			"--trellis-stage": "#111215",
			"--trellis-panel": "#1a1b1f",
			"--trellis-tabbar": "#141518",
			"--trellis-tab-active": "#1a1b1f",
			"--trellis-accent": "#4d8bff"
		};
		/** 宿主主题探测：html 内联 color-scheme（data-ds-theme-source=system 时随 OS 变，MutationObserver 跟随） */
		function readHostTheme() {
			try {
				return /^dark$/i.test(getComputedStyle(document.documentElement).colorScheme.trim()) ? "dark" : "light";
			} catch {
				return "dark";
			}
		}
		const subNoop = () => () => {};
		/** 轨迹降级文案（模块级常量：renderSession 身份稳定的一部分） */
		const TRACE_FALLBACK = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: newtype_module_css_default.pempty,
			children: "轨迹视图不可用（宿主未提供 trajectory 视图）"
		});
		/**
		* 找「当前正在看的 session tab」：按布局 DFS 找第一个面板，其选中视图是 session。
		* 找不到（当前选中的是文件/浏览器 tab）→ 返回 null，调用方回落开新 tab。
		*/
		function focusedSessionViewId(ws) {
			try {
				const doc = ws.getDocument?.();
				const views = doc?.views ?? {};
				let hit = null;
				const walk = (node) => {
					if (hit || !node) return;
					if (node.kind === "panel") {
						const vid = node.selected;
						if (vid && views[vid]?.type === "session") hit = vid;
						return;
					}
					if (node.kind === "stage") return walk(node.child);
					if (node.kind === "split") for (const c of node.children ?? []) {
						walk(c);
						if (hit) return;
					}
				};
				walk(doc?.root);
				return hit;
			} catch {
				return null;
			}
		}
		/**
		* 卡顿治理（2026-10-09）：宿主会话列表在流式期间高频 emit，WorkbenchView 每次都整树重渲，
		* 窗格里的原版对话 factory 大子树跟着重跑。两层治理：
		*  ① 订阅层签名去重——ids + 各会话标题/blank 拼成签名，没变就不通知 React；
		*  ② 窗格层 React.memo——renderSession / fallback 全部稳定化（动态数据走 ref 读最新），
		*     列表 emit 不再波及 HostConversationPane 子树。
		*/
		function sessionSig(snap) {
			if (!snap) return "null";
			const byId = snap.byId ?? {};
			let out = String(snap.ids?.length ?? 0);
			for (const id of snap.ids ?? []) {
				const r = byId[id];
				out += `|${id}:${r?.displayTitle ?? ""}:${r?.title ?? ""}:${r?.blank ? 1 : 0}`;
			}
			return out;
		}
		function WorkbenchView(props) {
			const wsRef = (0, react.useRef)(null);
			const wrapRef = (0, react.useRef)(null);
			const [dropHot, setDropHot] = (0, react.useState)(false);
			const artOpen = (0, react.useSyncExternalStore)(artRail.sub, artRail.get);
			const [hostTheme, setHostTheme] = (0, react.useState)(readHostTheme);
			(0, react.useEffect)(() => {
				const read = () => setHostTheme(readHostTheme());
				read();
				const obs = new MutationObserver(read);
				obs.observe(document.documentElement, {
					attributes: true,
					attributeFilter: [
						"style",
						"class",
						"data-ds-theme-source"
					]
				});
				return () => obs.disconnect();
			}, []);
			const listSrc = props.getSessionsList?.() ?? null;
			const lastSigRef = (0, react.useRef)("");
			const list = (0, react.useSyncExternalStore)((0, react.useMemo)(() => {
				if (!listSrc) return subNoop;
				return (cb) => listSrc.subscribe(() => {
					const sig = sessionSig(listSrc.getSnapshot());
					if (sig === lastSigRef.current) return;
					lastSigRef.current = sig;
					cb();
				});
			}, [listSrc]), listSrc ? () => listSrc.getSnapshot() : () => null, listSrc ? () => listSrc.getSnapshot() : () => null);
			const byId = list?.byId ?? {};
			const titleOf$1 = (0, react.useMemo)(() => (id) => byId[id]?.displayTitle ?? byId[id]?.title ?? id.slice(0, 8), [byId]);
			const mainViewId = retainedByMainView(list?.ids, list?.byId);
			(0, react.useEffect)(() => {
				if (!mainViewId || !wsRef.current) return;
				try {
					const ws = wsRef.current;
					if ((ws.views?.({ type: "session" }) ?? []).length === 0) ws.open("session", {
						params: { sid: mainViewId },
						reuse: "params"
					});
				} catch {}
			}, [mainViewId]);
			(0, react.useEffect)(() => openTabBus.sub((tabId) => {
				const ws = wsRef.current;
				if (!ws) return;
				try {
					if (tabId.startsWith("page:")) ws.open("page", {
						params: { pid: tabId.slice(5) },
						reuse: "params"
					});
					else if (tabId.startsWith("file:")) ws.open("file", {
						params: { path: tabId.slice(5) },
						reuse: "params"
					});
					else {
						const cur = focusedSessionViewId(ws);
						if (cur) {
							ws.setParams(cur, { sid: tabId });
							ws.select(cur);
							ws.focus(cur);
						} else ws.open("session", {
							params: { sid: tabId },
							reuse: "params"
						});
					}
				} catch {}
			}), []);
			(0, react.useEffect)(() => {
				const sid = takePendingSession();
				if (!sid) return;
				const t = setInterval(() => {
					const ws = wsRef.current;
					if (!ws) return;
					clearInterval(t);
					try {
						ws.open("session", {
							params: { sid },
							reuse: "params"
						});
					} catch {}
				}, 200);
				return () => clearInterval(t);
			}, []);
			const onDragOver = (e) => {
				const t = e.dataTransfer?.types;
				if (t && (t.includes("application/x-dsh-session") || t.includes("text/plain"))) {
					e.preventDefault();
					e.dataTransfer.dropEffect = "copy";
					setDropHot(true);
				}
			};
			const onDragLeave = (e) => {
				const to = e.relatedTarget;
				if (!to || !wrapRef.current?.contains(to)) setDropHot(false);
			};
			const onDrop = (e) => {
				e.preventDefault();
				setDropHot(false);
				const sid = e.dataTransfer?.getData("application/x-dsh-session") || e.dataTransfer?.getData("text/plain");
				if (sid) try {
					wsRef.current?.open("session", {
						params: { sid },
						reuse: "params"
					});
				} catch {}
			};
			const byIdRef = (0, react.useRef)(byId);
			byIdRef.current = byId;
			/** E35：对话内链接 → 内置浏览器新 tab（wsRef 是 ref，回调身份恒定，memo 不破） */
			const openInBrowser = (0, react.useCallback)((url) => {
				try {
					wsRef.current?.open("web", {
						params: { url },
						reuse: false
					});
				} catch {}
			}, []);
			/** view 内容：mode 切换（对话/轨迹，齿轮 setParams；params 随 trellis 布局持久化） */
			const renderSession = (0, react.useCallback)((view) => {
				const sid = view.params?.sid ?? "";
				const mode = view.params?.mode === "trace" ? "trace" : "chat";
				const retain = props.retainSession;
				if (!retain) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.pempty,
					children: "会话服务未就绪"
				});
				const openInFilePane = (raw) => {
					let p = raw.replace(/^@/, "").replace(/^"|"$/g, "");
					if (!/^[A-Za-z]:[\\/]/.test(p) && !p.startsWith("/")) {
						const cwd = byIdRef.current[sid]?.cwd;
						if (cwd) p = `${cwd.replace(/[\\/]+$/, "")}/${p.replace(/^\/+/, "")}`;
					}
					try {
						wsRef.current?.open("file", {
							params: { path: p },
							reuse: false
						});
					} catch {}
				};
				if (mode === "trace") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostConversationPane, {
					sessionId: sid,
					viewName: "trajectory",
					retainSession: retain,
					SessionProvider: props.SessionProvider,
					renderFactorySlot: props.renderFactorySlot,
					fallback: TRACE_FALLBACK
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HostConversationPane, {
					sessionId: sid,
					blank: !!byIdRef.current[sid]?.blank,
					retainSession: retain,
					SessionProvider: props.SessionProvider,
					renderFactorySlot: props.renderFactorySlot,
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionPane, {
						sessionId: sid,
						retainSession: retain
					}),
					onOpenLink: openInBrowser,
					onOpenFile: openInFilePane
				});
			}, [
				props.retainSession,
				props.SessionProvider,
				props.renderFactorySlot
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-nt": "wb",
				ref: wrapRef,
				className: newtype_module_css_default.wbWrap + (dropHot ? " " + newtype_module_css_default.dropHot : ""),
				style: NT_VARS[hostTheme],
				onDragOver,
				onDragLeave,
				onDrop,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: newtype_module_css_default.wbMain,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Workspace, {
						ref: wsRef,
						theme: hostTheme,
						navigation: "free",
						storageKey: TRELLIS_STORAGE_KEY,
						version: 1,
						tokens: hostTheme === "dark" ? {
							...TRELLIS_FONT_TOKENS,
							...TRELLIS_DARK_TOKENS
						} : TRELLIS_FONT_TOKENS,
						className: newtype_module_css_default.ntws,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewType, {
								id: "session",
								title: (v) => titleOf$1(v.params?.sid ?? ""),
								render: (v) => renderSession(v),
								accessory: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionAccessories, {
									view: v,
									ws: wsRef.current,
									getCwd: () => {
										const sid = v?.params?.sid ?? "";
										return byIdRef.current[sid]?.cwd ?? null;
									},
									vars: NT_VARS[hostTheme],
									onOpenBrowser: () => {
										try {
											wsRef.current?.open("web", {
												params: { url: "" },
												reuse: false
											});
										} catch {}
									}
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewType, {
								id: "page",
								title: (v) => titleOf(v.params?.pid ?? ""),
								render: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PagePane, { pageId: v?.params?.pid ?? "" })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewType, {
								id: "file",
								title: (v) => {
									const p = v.params?.path ?? "";
									return p.slice(Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")) + 1) || "文件";
								},
								render: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FilePane, { path: v?.params?.path ?? "" })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ViewType, {
								id: "web",
								title: (v) => {
									const u = v.params?.url ?? "";
									return u ? u.replace(/^https?:\/\//, "").split("/")[0] || "浏览器" : "浏览器";
								},
								render: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WebPane, {
									url: v?.params?.url ?? "",
									setParams: (patch) => v?.setParams?.(patch),
									openWebTab: openInBrowser
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Stage, {
								empty: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: newtype_module_css_default.pempty,
									children: ["把左侧会话拖进来 · 拖 tab 到边缘分栏 · 双击 tab 条聚焦", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: { marginTop: 12 },
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: newtype_module_css_default.webGo,
											onClick: () => wsRef.current?.open("web", {
												params: { url: "" },
												reuse: false
											}),
											children: "打开浏览器"
										})
									})]
								}),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Panel, { children: props.sessionId ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(View, {
									type: "session",
									params: { sid: props.sessionId }
								}) : null })
							})
						]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: newtype_module_css_default.wbRight + (artOpen ? " " + newtype_module_css_default.wbRightOn : ""),
					"data-nt": "wrightrail",
					"aria-hidden": !artOpen,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: newtype_module_css_default.hd,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "产出物" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: newtype_module_css_default.hdRight,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: newtype_module_css_default.icbtn,
								"data-nt": "artrclose",
								title: "收起右栏",
								onClick: () => artRail.set(false),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 24 24",
									className: newtype_module_css_default.ic,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18M6 6l12 12" })
								})
							})
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArtifactsPanel, { mode: "global" })]
				})]
			});
		}
		//#endregion
		//#region src/client/shell/Statusbar.tsx
		/**
		* trellis 状态栏（shell.overlay 浮层，P1.7 batch 2）：
		* 仅工作台面板激活时渲染（panelInfo 订阅），不干扰原生对话。
		* 浮层默认点击穿透，本栏 root 自开 pointer-events。
		*/
		//#endregion
		//#region src/client/index.tsx
		/** main 槽的 key，必须与 sidebar.panellist 条目 id 一一对应（PointRow → selectPanel）。 */
		const MAIN_WORKBENCH = "newtype";
		const inject = [
			"slots",
			"uiWorkspace",
			"sessions",
			"sidebarRight",
			"sidebarRightTabs",
			"layout"
		];
		/** 公共 inject 工厂：惰性读 ctx（apply 时序安全） */
		function sharedInject(ctx) {
			return () => ({
				openSession: (id) => {
					ctx.uiWorkspace?.openSession(id);
				},
				retainSession: (id) => ctx.sessions?.retain(id, { source: "dsh-newtype-multititle" }) ?? null,
				getSessionsList: () => ctx.sessions?.list ?? null,
				selectPanel: (id) => {
					ctx.layout?.selectPanel(id);
				},
				openSidePanel: (sid) => {
					try {
						if (ctx.betterSidebar) {
							const scope = sid ? { sessionId: sid } : void 0;
							ctx.betterSidebar.openTab({ type: "editor" }, scope);
							return;
						}
					} catch {}
					artRail.set(true);
				},
				openRightbar: () => {
					try {
						ctx.layout?.openRightbar(true, false);
					} catch {}
				},
				closeRightbar: () => {
					try {
						ctx.layout?.closeRightbar();
					} catch {}
				}
			});
		}
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: MAIN_WORKBENCH,
				inject: sharedInject(ctx),
				children: { "newtype.pane.session": {
					kind: "single",
					scope: "session"
				} }
			}, WorkbenchView)), "dsh-newtype-multititle: 工作台中央面板（main newtype）");
			const panelIcon = (glyph) => (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 24 24",
				width: props.size ?? 16,
				height: props.size ?? 16,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "2.5",
						y: "4",
						width: "8.5",
						height: "7.5",
						rx: "1.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "13",
						y: "4",
						width: "8.5",
						height: "4.5",
						rx: "1.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "13",
						y: "11",
						width: "8.5",
						height: "9",
						rx: "1.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "2.5",
						y: "14",
						width: "8.5",
						height: "6",
						rx: "1.5"
					})
				] })
			});
			ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: MAIN_WORKBENCH,
				order: 20,
				label: "自由栏位"
			}, panelIcon("workbench"))), "dsh-newtype-multititle: 侧栏面板项（工作台）");
			const ARTIFACT_ID = "@dsh-external/dsh-newtype-multititle/artifacts";
			ctx.effect(() => ctx.sidebarRightTabs?.register({
				id: ARTIFACT_ID,
				kind: "newtype-artifacts",
				priority: "extension",
				title: () => "产出物",
				guide: [{
					id: "artifacts",
					order: 100,
					title: () => "产出物",
					description: () => "当前会话的图页与产出"
				}]
			}), "dsh-newtype-multititle: 右栏产出物 tab 类型");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: ARTIFACT_ID
			}, ArtifactsPanel)), "dsh-newtype-multititle: 右栏产出物 body");
			ctx.effect(() => artifactPanelBus.sub(() => {
				try {
					ctx.layout?.selectPanel("newtype");
				} catch {}
				artRail.set(true);
			}), "dsh-newtype-multititle: 产出物栏打开请求");
			let patched = false;
			const patchTimer = setInterval(() => {
				const svc = ctx.sidebarRight;
				if (!svc?.openResource || patched) {
					if (patched) clearInterval(patchTimer);
					return;
				}
				const orig = svc.openResource.bind(svc);
				try {
					svc.openResource = (address, options) => {
						try {
							orig(address, options);
						} catch (e) {
							if (!String(e).includes("no session surface")) throw e;
							const m = /^dsh-resource:\/\/[^/]+\/(.*)$/.exec(String(address));
							if (!m) throw e;
							let rest = m[1];
							try {
								rest = decodeURIComponent(rest);
							} catch {}
							let p = null;
							const sm = /^session\/([^/]+)\/(.*)$/.exec(rest);
							if (sm) {
								const rel = sm[2];
								if (/^[A-Za-z]:[\\/]/.test(rel) || rel.startsWith("/")) p = rel;
								else {
									const cwd = ((ctx.sessions?.list)?.getSnapshot?.())?.byId?.[sm[1]]?.cwd;
									if (cwd) p = `${cwd.replace(/[\\/]+$/, "")}/${rel.replace(/^\/+/, "")}`;
								}
							} else {
								const win = /([A-Za-z]:[\\/].*)$/.exec(rest);
								p = win ? win[1] : rest.startsWith("/") ? rest.split("?")[0] : null;
							}
							if (!p) throw e;
							openTabBus.emit(`file:${p}`);
						}
					};
					patched = true;
					clearInterval(patchTimer);
					ctx.logger?.("dsh-newtype-multititle")?.info?.("sidebarRight.openResource wrapped (E31 spike)");
				} catch {}
			}, 600);
			const wbOpenPatch = () => {
				const ws = ctx.uiWorkspace;
				if (!ws) return false;
				const g = ws;
				if (g.__ntOrig) return true;
				try {
					ws.openSession = (target) => {
						openTabBus.emit(String(target));
						try {
							ctx.layout?.selectPanel("newtype");
						} catch {}
					};
					const origStart = ws.startSession?.bind(ws);
					if (origStart) ws.startSession = (workspaceId, beforeOpen) => {
						const r = origStart(workspaceId, beforeOpen);
						let tries = 0;
						const t = setInterval(() => {
							if (++tries > 30) {
								clearInterval(t);
								return;
							}
							const snap = (ctx.sessions?.list)?.getSnapshot?.();
							const mid = retainedByMainView(snap?.ids, snap?.byId);
							if (mid) {
								clearInterval(t);
								setPendingSession(mid);
								try {
									ctx.layout?.selectPanel("newtype");
								} catch {}
							}
						}, 200);
						return r;
					};
					g.__ntOrig = true;
					return true;
				} catch {
					return false;
				}
			};
			let patchedWs = wbOpenPatch();
			const wsTimer = setInterval(() => {
				if (patchedWs || wbOpenPatch()) {
					patchedWs = true;
					clearInterval(wsTimer);
				}
			}, 600);
			let wbTries = 0;
			const wbTimer = setInterval(() => {
				if (wbTries++ > 25) {
					clearInterval(wbTimer);
					return;
				}
				let active;
				try {
					active = (ctx.layout?.panelInfo)?.getSnapshot?.()?.activePanelId;
				} catch {}
				if (active === "newtype") {
					clearInterval(wbTimer);
					return;
				}
				try {
					ctx.layout?.selectPanel("newtype");
				} catch {}
			}, 400);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
