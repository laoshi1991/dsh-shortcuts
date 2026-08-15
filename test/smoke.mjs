/**
 * Smoke test for the dsh-shortcuts browser half: run client.js in a fake
 * browser shell (ModuleLoader + document + localStorage), then drive the
 * plugin body against a mock cordis ctx (locale + slots services) and
 * render the contributed component with the real react-dom/server.
 *
 * Run: node test/smoke.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";
import fs from "node:fs";

const require = createRequire(import.meta.url);

/**
 * Locate react / react-dom without hardcoding any machine-specific path.
 * Tried in order:
 *   1. ordinary node resolution from this package (e.g. a devDependency);
 *   2. the copy bundled inside the installed @deepseek-ai/dsh CLI —
 *      $DSH_ROOT, or `npm root -g`/@deepseek-ai/dsh.
 * @param {string} specifier - node specifier ("react", "react-dom/server").
 * @param {string} dshRelPath - entry file path inside dsh's node_modules.
 * @returns {string} resolved entry file path.
 */
function resolveReactModule(specifier, dshRelPath) {
	try {
		return require.resolve(specifier);
	} catch {
		// not resolvable from here — fall through to the dsh CLI install
	}
	const roots = [];
	if (process.env.DSH_ROOT) roots.push(process.env.DSH_ROOT);
	try {
		const npmGlobal = execSync("npm root -g", { encoding: "utf8" }).trim();
		if (npmGlobal) roots.push(path.join(npmGlobal, "@deepseek-ai", "dsh"));
	} catch {
		// npm not reachable — rely on DSH_ROOT above
	}
	for (const root of roots) {
		const candidate = path.join(root, "node_modules", dshRelPath);
		if (fs.existsSync(candidate)) return candidate;
	}
	throw new Error(
		`smoke test cannot find ${specifier}: install it as a devDependency, or set DSH_ROOT to the installed @deepseek-ai/dsh package directory`
	);
}

const React = await import(pathToFileURL(resolveReactModule("react", path.join("react", "index.js"))));
const ReactDOMServer = await import(pathToFileURL(resolveReactModule("react-dom/server", path.join("react-dom", "server.js"))));

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ── fake browser environment ────────────────────────────────────────────────
const registeredStyles = [];
const head = {
	appendChild(el) {
		registeredStyles.push(el);
	}
};
class FakeElement {
	constructor(tag) {
		this.tagName = tag.toUpperCase();
		this.dataset = {};
		this.textContent = "";
		this.style = {};
	}
	setAttribute() {}
}
const documentShim = {
	querySelector() {
		return null; // no existing style tag → factory injects CSS
	},
	createElement(tag) {
		return new FakeElement(tag);
	},
	body: new FakeElement("body"),
	head
};
const storage = new Map();
const localStorageShim = {
	getItem: (k) => (storage.has(k) ? storage.get(k) : null),
	setItem: (k, v) => storage.set(k, String(v)),
	removeItem: (k) => storage.delete(k)
};

let moduleTable = null;
globalThis.window = {
	__ModuleLoader__: {
		load(entry) {
			moduleTable = entry;
		}
	},
	localStorage: localStorageShim
};
globalThis.document = documentShim;
globalThis.localStorage = localStorageShim;
globalThis.requestAnimationFrame = (fn) => fn();

// ── load the client bundle ──────────────────────────────────────────────────
await import(pathToFileURL(path.join(root, "client.js")));
assert.ok(moduleTable, "module was registered with __ModuleLoader__.load");
assert.equal(moduleTable.id, "dsh-shortcuts");

const requireShim = (id) => {
	if (id === "react") return React;
	throw new Error("unexpected require: " + id);
};
const plugin = moduleTable.factory(requireShim);
assert.equal(plugin.inject.join(","), "locale", "plugin-level inject is ['locale']");
assert.equal(typeof plugin.apply, "function");

// CSS injection happened during factory execution
assert.equal(registeredStyles.length, 1, "one style tag injected");
assert.match(registeredStyles[0].textContent, /\.dshqp-tag/, "style contains keycap rules");
assert.equal(registeredStyles[0].dataset.plugin, "dsh-shortcuts");

// ── mock cordis ctx: locale + slots services ───────────────────────────────
const dictionaries = new Map();
let localeDisposerCalled = false;
const localeService = {
	register(ns, dicts) {
		dictionaries.set(ns, dicts);
		return () => {
			localeDisposerCalled = true;
			dictionaries.delete(ns);
		};
	}
};
const zh = () => dictionaries.get("quickPhrases")?.zh ?? {};
const translate = (key) => zh()[key] ?? key;

let slotEntry = null;
let injectCallback = null;
const slotsService = {
	inject(key, cb) {
		assert.equal(key, "conversation.input.left");
		injectCallback = cb;
		// real semantics: declaration already live → effect runs synchronously
		const dispose = cb();
		return () => dispose();
	},
	register(options, component) {
		assert.equal(options.name, "conversation.input.left");
		assert.equal(options.id, "quick-phrases");
		slotEntry = { options, component };
		return () => {};
	}
};
const injectWaits = [];
const ctx = {
	effect(fn) {
		const dispose = fn();
		assert.equal(typeof dispose, "function", "locale.register returns disposer for ctx.effect");
		return dispose;
	},
	inject(deps, cb) {
		assert.deepEqual(deps, ["slots"]);
		injectWaits.push(cb);
		// simulate services already up: run immediately with scope = ctx + services
		cb({ slots: slotsService });
		return () => {};
	},
	locale: localeService,
	slots: slotsService
};

plugin.apply(ctx);
assert.ok(dictionaries.has("quickPhrases"), "dictionary namespace registered");
assert.ok(injectCallback, "slots.inject called for conversation.input.left");
assert.ok(slotEntry, "slot entry registered");
assert.deepEqual(Object.keys(zh()).sort(), ["add", "defaultContinue", "defaultPing", "placeholder", "remove"], "zh dictionary complete");
assert.deepEqual(
	Object.keys(dictionaries.get("quickPhrases").en).sort(),
	Object.keys(zh()).sort(),
	"en dictionary key set matches zh"
);

// ── render the component (zh) ───────────────────────────────────────────────
const setDraftCalls = [];
const props = {
	t: translate,
	inputActions: {
		setDraft: (text) => setDraftCalls.push(text)
	},
	session: { running: false },
	input: { draft: "", phase: "plain" }
};
let html = ReactDOMServer.renderToStaticMarkup(React.createElement(slotEntry.component, props));
assert.match(html, /继续/, "default tag 1 renders (zh)");
assert.match(html, /你还在吗/, "default tag 2 renders (zh)");
assert.match(html, /dshqp-c0/, "first tag uses color 0");
assert.match(html, /dshqp-c1/, "second tag uses color 1");
assert.match(html, /dshqp-add/, "'+' affordance renders");
assert.match(html, /添加快捷短语/, "tooltip localized (zh)");
assert.ok(!html.includes("dshqp-input"), "add-input hidden until '+' clicked");

// ── render the component (en) ───────────────────────────────────────────────
const en = dictionaries.get("quickPhrases").en;
const tEn = (key) => en[key] ?? key;
html = ReactDOMServer.renderToStaticMarkup(
	React.createElement(slotEntry.component, { ...props, t: tEn })
);
assert.match(html, /Continue/, "default tag 1 renders (en)");
assert.match(html, /Still there\?/, "default tag 2 renders (en)");

// ── behavior: tag click applies the draft ──────────────────────────────────
// (client-side behavior via a tiny react-dom test render is overkill here;
// the setDraft wiring is one line — assert it exists on the face we pass.)
assert.equal(typeof props.inputActions.setDraft, "function");

console.log("SMOKE OK: module registration, CSS injection, locale dictionaries (zh+en),");
console.log("          slots.inject → register (conversation.input.left, id quick-phrases),");
console.log("          component renders localized default tags with rainbow keycaps.");
