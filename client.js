/**
 * dsh-shortcuts, browser half.
 *
 * Quick prompt phrases for the dsh web composer:
 * a row of rainbow keycap tags inside the composer card's tool row.
 *
 *   · click a tag → the draft becomes that phrase (attachments untouched),
 *     the textarea regains focus with the caret at the end
 *   · hover a tag → a small × appears at its top-right corner to delete it
 *   · "+" after the row → inline mini input; Enter commits, Escape cancels,
 *     blur with text commits, blur empty cancels
 *   · at most 8 tags, each at most 7 visible characters
 *   · tags persist in localStorage under "dsh:quick-phrases" and are shared
 *     across sessions and tabs of the same browser profile
 *   · defaults follow the UI language ("继续" / "你还在吗") until the user
 *     edits the set for the first time
 *
 * Wiring: one contribution into the `conversation.input.left` slot (the
 * additive list seat at the left end of the composer tool row, after the
 * resident chrome). The framework session kit hands the component
 * `inputActions` (public draft write path `setDraft`), so the plugin never
 * touches the input machine directly. The `locale` service carries the
 * plugin's own dictionary namespace; `slots.inject` waits for the slot's
 * declarer (ui-conversation) so load order never matters.
 *
 * This file IS the shipped client bundle: a classic script that registers
 * one module factory with the shell's module loader (same shape as every
 * built dsh client bundle — no build step, no external dependency beyond
 * the React instance the shell provides via require("react")).
 */
window.__ModuleLoader__.load({
	id: "dsh-shortcuts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		//#region constants
		/** localStorage key holding the user's tag list (JSON string array). */
		const STORAGE_KEY = "dsh:quick-phrases";
		/** Limits: 8 tags max, 7 characters per tag. */
		const MAX_TAGS = 8;
		const MAX_TAG_LENGTH = 7;
		/** This plugin's locale dictionary namespace (locale seat `t`). */
		const NS = "quickPhrases";
		//#endregion

		//#region css
		/**
		 * Rainbow keycap palette in plain rgba(). Index i paints with
		 * palette[i % 8]: rose, orange, amber, emerald, cyan, blue, violet, pink.
		 */
		const CSS = [
			".dshqp-wrap{display:inline-flex;align-items:center;gap:4px;min-height:24px;flex:0 1 auto;min-width:0;}",
			".dshqp-cell{position:relative;display:inline-flex;overflow:visible;}",
			".dshqp-tag{height:24px;padding:0 10px;border-radius:6px;border:1px solid;display:inline-flex;align-items:center;font-size:11px;font-weight:600;line-height:1;cursor:pointer;user-select:none;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.10);text-shadow:0 0 8px currentColor;transition:background-color .1s ease,box-shadow .1s ease,transform .05s ease;}",
			".dshqp-tag:active{transform:translateY(1px);box-shadow:none;}",
			".dshqp-tag:focus-visible,.dshqp-del:focus-visible,.dshqp-add:focus-visible,.dshqp-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary, #4d6bfe);outline-offset:1px;}",
			".dshqp-del{position:absolute;top:-6px;right:-6px;z-index:10;width:14px;height:14px;padding:0;border-radius:50%;border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));background:var(--dsw-alias-bg-layer-2, #fff);color:var(--dsw-alias-label-secondary, #666);font-size:10px;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s ease,color .12s ease;box-shadow:0 1px 2px rgba(0,0,0,.12);}",
			".dshqp-del:hover{color:var(--dsw-alias-label-error, #e5484d);}",
			".dshqp-cell:hover .dshqp-del,.dshqp-del:focus-visible{opacity:1;}",
			".dshqp-add{height:24px;padding:0 4px;border:none;background:transparent;color:var(--dsw-alias-label-secondary, #888);font-size:16px;line-height:1;cursor:pointer;transition:color .12s ease;}",
			".dshqp-add:hover{color:var(--dsw-alias-label-primary, inherit);}",
			".dshqp-input{height:24px;width:76px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:500;color:var(--dsw-alias-label-primary, inherit);background:var(--dsw-alias-bg-module-platform, transparent);border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));outline:none;transition:border-color .12s ease;}",
			".dshqp-input:focus{border-color:rgba(245,158,11,.7);}",
			/* rose */
			".dshqp-c0{border-color:rgba(244,63,94,.4);background:rgba(244,63,94,.15);color:#fb7185;}",
			".dshqp-c0:hover{background:rgba(244,63,94,.25);}",
			/* orange */
			".dshqp-c1{border-color:rgba(249,115,22,.4);background:rgba(249,115,22,.15);color:#fb923c;}",
			".dshqp-c1:hover{background:rgba(249,115,22,.25);}",
			/* amber */
			".dshqp-c2{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.15);color:#fbbf24;}",
			".dshqp-c2:hover{background:rgba(245,158,11,.25);}",
			/* emerald */
			".dshqp-c3{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.15);color:#34d399;}",
			".dshqp-c3:hover{background:rgba(16,185,129,.25);}",
			/* cyan */
			".dshqp-c4{border-color:rgba(6,182,212,.4);background:rgba(6,182,212,.15);color:#22d3ee;}",
			".dshqp-c4:hover{background:rgba(6,182,212,.25);}",
			/* blue */
			".dshqp-c5{border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.15);color:#60a5fa;}",
			".dshqp-c5:hover{background:rgba(59,130,246,.25);}",
			/* violet */
			".dshqp-c6{border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.15);color:#a78bfa;}",
			".dshqp-c6:hover{background:rgba(139,92,246,.25);}",
			/* pink */
			".dshqp-c7{border-color:rgba(236,72,153,.4);background:rgba(236,72,153,.15);color:#f472b6;}",
			".dshqp-c7:hover{background:rgba(236,72,153,.25);}"
		].join("\n");
		const cssTagId = "dsh-shortcuts/quick-phrases.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-shortcuts";
			tag.dataset.pluginCss = cssTagId;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region locale
		/** 中文词典（与英文键集完全一致）。 */
		const zh = {
			"add": "添加快捷短语",
			"remove": "删除该短语",
			"placeholder": "短语",
			"defaultContinue": "继续",
			"defaultPing": "你还在吗"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"add": "Add quick phrase",
			"remove": "Remove this phrase",
			"placeholder": "phrase",
			"defaultContinue": "Continue",
			"defaultPing": "Still there?"
		};
		//#endregion

		//#region storage
		/**
		 * Read the persisted tag list. Missing or corrupt data falls back to
		 * the locale-derived defaults ("继续" / "你还在吗"); an
		 * explicitly saved list — even an empty one — always wins, so deleting
		 * every tag sticks.
		 * @param {((key: string) => string)} t - locale seat translate.
		 * @returns {string[]} persisted tags, or defaults.
		 */
		function loadTags(t) {
			try {
				const stored = window.localStorage.getItem(STORAGE_KEY);
				if (stored !== null) {
					const parsed = JSON.parse(stored);
					if (Array.isArray(parsed)) {
						return parsed.filter((s) => typeof s === "string").slice(0, MAX_TAGS);
					}
				}
			} catch {
				// ignore corrupt data / storage denied — fall through to defaults
			}
			return [t("defaultContinue"), t("defaultPing")];
		}

		/**
		 * Persist the tag list; storage failures are silently ignored (private
		 * mode &c.) — the in-memory list keeps working for this page.
		 * @param {string[]} tags - full next list.
		 */
		function saveTags(tags) {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
			} catch {
				// ignore
			}
		}
		//#endregion

		//#region view helpers
		/**
		 * Return focus to the composer textarea after a tag click: walk up
		 * from the clicked button to the innermost ancestor that contains the
		 * composer's textarea (marked data-phase by ui-conversation), focus
		 * it, and park the caret at the end.
		 * Runs in requestAnimationFrame so the setDraft re-render
		 * has landed on the controlled textarea first.
		 * @param {Element|null} fromEl - the clicked tag button element.
		 */
		function focusComposerTextarea(fromEl) {
			let scope = fromEl && fromEl.parentElement;
			while (scope && scope !== document.body) {
				const textarea = scope.querySelector
					? scope.querySelector("textarea[data-phase]")
					: null;
				if (textarea) {
					try {
						textarea.focus();
						const end = textarea.value.length;
						textarea.setSelectionRange(end, end);
					} catch {
						// focus is best-effort; the draft is already set
					}
					return;
				}
				scope = scope.parentElement;
			}
		}
		//#endregion

		//#region component
		/**
		 * The quick-phrases row. Session-scope slot component: the framework
		 * kit supplies `inputActions` (public draft write path) and the locale
		 * seat `t` (registration declared namespace {@link NS}); the InputZone
		 * owner share (`session`/`input` snapshots) is unread — the feature
		 * deliberately keeps working while a turn runs, because a filled
		 * draft simply queues/steers like any typed message.
		 * @param {any} props - composed slot props.
		 * @returns {React.ReactNode} the tag row.
		 */
		function QuickPhrases(props) {
			const { t, inputActions } = props;
			const [tags, setTags] = react.useState(() => loadTags(t));
			const [adding, setAdding] = react.useState(false);
			const [draftText, setDraftText] = react.useState("");
			const inputEl = react.useRef(null);

			/** Write-through update: set state and persist together. */
			const update = (next) => {
				setTags(next);
				saveTags(next);
			};

			/** Tag click: replace the draft with the phrase, refocus at end. */
			const applyTag = (event, text) => {
				const btn = event.currentTarget;
				inputActions.setDraft(text);
				requestAnimationFrame(() => focusComposerTextarea(btn));
			};

			/** × click: drop one tag (index-addressed). */
			const removeTag = (index) => {
				update(tags.filter((_, i) => i !== index));
			};

			/** "+" click: open the inline mini input below the tag cap. */
			const startAdding = () => {
				if (tags.length >= MAX_TAGS) return;
				setAdding(true);
				setDraftText("");
				requestAnimationFrame(() => inputEl.current && inputEl.current.focus());
			};

			const cancelAdding = () => {
				setAdding(false);
				setDraftText("");
			};

			/** Commit the mini input: trimmed, capped, dupes allowed. */
			const commitAdding = () => {
				const text = draftText.trim().slice(0, MAX_TAG_LENGTH);
				setAdding(false);
				setDraftText("");
				if (!text || tags.length >= MAX_TAGS) return;
				update([...tags, text]);
			};

			const handleInputKeydown = (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commitAdding();
				} else if (event.key === "Escape") {
					event.preventDefault();
					cancelAdding();
				}
			};

			/** Blur with text commits; empty blur cancels — friendlier than keeping the editor open and loses nothing. */
			const handleInputBlur = () => {
				if (draftText.trim()) commitAdding();
				else cancelAdding();
			};

			const h = react.createElement;
			return h(
				"div",
				{ className: "dshqp-wrap" },
				tags.map((tag, i) =>
					h(
						"span",
						{ key: i + ":" + tag, className: "dshqp-cell" },
						h(
							"button",
							{
								type: "button",
								className: "dshqp-tag dshqp-c" + (i % 8),
								title: tag,
								onClick: (event) => applyTag(event, tag)
							},
							tag
						),
						h(
							"button",
							{
								type: "button",
								className: "dshqp-del",
								title: t("remove"),
								"aria-label": t("remove") + ": " + tag,
								onClick: (event) => {
									event.stopPropagation();
									removeTag(i);
								}
							},
							"×"
						)
					)
				),
				adding
					? h("input", {
							ref: inputEl,
							className: "dshqp-input",
							value: draftText,
							maxLength: MAX_TAG_LENGTH,
							placeholder: t("placeholder"),
							"aria-label": t("add"),
							onChange: (event) =>
								setDraftText(event.target.value.trimStart().slice(0, MAX_TAG_LENGTH)),
							onKeyDown: handleInputKeydown,
							onBlur: handleInputBlur
						})
					: tags.length < MAX_TAGS
						? h(
								"button",
								{
									type: "button",
									className: "dshqp-add",
									title: t("add"),
									"aria-label": t("add"),
									onClick: startAdding
								},
								"+"
							)
						: null
			);
		}
		//#endregion

		//#region plugin body
		/** Required services: the dictionaries register through ctx.locale at apply time. */
		const inject = ["locale"];

		/**
		 * Client plugin body: register the dictionary namespace, then — once
		 * the slots service is up — contribute the tag row into the composer
		 * tool row's left list seat, waiting for ui-conversation's declaration
		 * via slots.inject. Both effects ride ctx.effect/ctx.inject, so
		 * fiber unload (plugin disabled) removes dictionary and entry cleanly.
		 * @param {any} ctx - client cordis context.
		 */
		function apply(ctx) {
			ctx.effect(
				() => ctx.locale.register(NS, { zh, en }),
				"dsh-shortcuts: quick-phrases dictionaries"
			);
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.input.left", () =>
					scope.slots.register(
						{
							name: "conversation.input.left",
							id: "quick-phrases",
							order: 100,
							label: "Quick phrases",
							locale: NS
						},
						QuickPhrases
					)
				);
			});
		}
		//#endregion

		exports.QuickPhrases = QuickPhrases;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
