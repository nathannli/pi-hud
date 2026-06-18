import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS,
	CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS,
	DEFAULT_CHATGPT_LIMIT_CONFIG,
} from "./constants.js";
import {
	describeChatGptLimitConfig,
	normalizeChatGptLimitConfig,
	writeChatGptLimitConfig,
} from "./config.js";
import { isOpenAICodexProvider } from "./auth.js";
import { buildChatGptUsageDetails } from "./usage.js";
import type {
	ChatGptLimitSnapshot,
	ChatGptLimitState,
} from "./types.js";

async function configureQuotaWindow(
	ctx: ExtensionCommandContext,
	state: ChatGptLimitState,
	onChange: () => void,
): Promise<void> {
	const selected = await ctx.ui.select(
		"Display which ChatGPT limit in the HUD footer?",
		CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS.map((option) => option.label),
	);
	const option = CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS.find(
		(candidate) => candidate.label === selected,
	);
	if (!option) return;

	state.footerConfig = normalizeChatGptLimitConfig({
		...state.footerConfig,
		quotaWindow: option.value,
	});
	writeChatGptLimitConfig(state.footerConfig);
	onChange();
	ctx.ui.notify(
		option.value === "hidden"
			? "ChatGPT limit HUD display hidden."
			: `ChatGPT limit HUD display: ${option.label}`,
		"info",
	);
}

async function configureDisplayMode(
	ctx: ExtensionCommandContext,
	state: ChatGptLimitState,
	onChange: () => void,
): Promise<void> {
	const selected = await ctx.ui.select(
		"How should ChatGPT limits be shown?",
		CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS.map((option) => option.label),
	);
	const option = CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS.find(
		(candidate) => candidate.label === selected,
	);
	if (!option) return;

	state.footerConfig = normalizeChatGptLimitConfig({
		...state.footerConfig,
		displayMode: option.value,
	});
	writeChatGptLimitConfig(state.footerConfig);
	onChange();
	ctx.ui.notify(`ChatGPT limit display mode: ${option.label}`, "info");
}

async function resetFooterConfig(
	ctx: ExtensionCommandContext,
	state: ChatGptLimitState,
	onChange: () => void,
): Promise<void> {
	state.footerConfig = { ...DEFAULT_CHATGPT_LIMIT_CONFIG };
	writeChatGptLimitConfig(state.footerConfig);
	onChange();
	ctx.ui.notify("ChatGPT limit HUD settings reset to defaults.", "info");
}

export function registerChatGptLimitCommand(
	pi: ExtensionAPI,
	state: ChatGptLimitState,
	queueUpdate: (
		ctx: ExtensionCommandContext,
	) => Promise<ChatGptLimitSnapshot | undefined>,
	onChange: () => void,
): void {
	pi.registerCommand("chatgpt-limit", {
		description: "Show ChatGPT Codex 5-hour and weekly usage limits",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			const action = await ctx.ui.select("ChatGPT Codex usage limits", [
				"Show current usage details",
				`Configure HUD footer limit (${describeChatGptLimitConfig(state.footerConfig)})`,
				"Configure HUD footer display mode",
				"Reset HUD footer settings to defaults",
			]);

			if (action === "Configure HUD footer display mode") {
				await configureDisplayMode(ctx, state, onChange);
				return;
			}

			if (action === "Reset HUD footer settings to defaults") {
				await resetFooterConfig(ctx, state, onChange);
				return;
			}

			if (action?.startsWith("Configure HUD footer limit")) {
				await configureQuotaWindow(ctx, state, onChange);
				return;
			}

			if (!action) return;

			if (!isOpenAICodexProvider(ctx.model?.provider)) {
				ctx.ui.notify(
					"ChatGPT limits are only available for openai-codex models.",
					"info",
				);
				return;
			}

			const snapshot = await queueUpdate(ctx);
			if (!snapshot) {
				ctx.ui.notify("Could not load ChatGPT usage limits.", "warning");
				return;
			}

			await ctx.ui.select(
				"ChatGPT Codex usage limits",
				buildChatGptUsageDetails(
					snapshot,
					ctx.model?.provider,
					describeChatGptLimitConfig(state.footerConfig),
				),
			);
		},
	});
}
