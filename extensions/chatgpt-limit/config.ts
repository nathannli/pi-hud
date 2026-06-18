import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	CHATGPT_LIMIT_CONFIG_FILE_NAME,
	CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS,
	CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS,
	DEFAULT_CHATGPT_LIMIT_CONFIG,
} from "./constants.js";
import type {
	ChatGptLimitConfig,
	ChatGptLimitDisplayMode,
	ChatGptLimitQuotaWindow,
} from "./types.js";
import { isRecord } from "../utils/records.js";

function isQuotaWindow(value: unknown): value is ChatGptLimitQuotaWindow {
	return (
		typeof value === "string" &&
		CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS.some((option) => option.value === value)
	);
}

function isDisplayMode(value: unknown): value is ChatGptLimitDisplayMode {
	return (
		typeof value === "string" &&
		CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS.some((option) => option.value === value)
	);
}

export function normalizeChatGptLimitConfig(value: unknown): ChatGptLimitConfig {
	const record = isRecord(value) ? value : undefined;
	const rawQuotaWindow = record?.quotaWindow;
	const quotaWindow = isQuotaWindow(rawQuotaWindow)
		? rawQuotaWindow
		: DEFAULT_CHATGPT_LIMIT_CONFIG.quotaWindow;

	const rawDisplayMode = record?.displayMode;
	const displayMode = isDisplayMode(rawDisplayMode)
		? rawDisplayMode
		: DEFAULT_CHATGPT_LIMIT_CONFIG.displayMode;

	return { quotaWindow, displayMode };
}

export function getChatGptLimitConfigPath(): string {
	const agentDir =
		process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(agentDir, CHATGPT_LIMIT_CONFIG_FILE_NAME);
}

export function readChatGptLimitConfig(): ChatGptLimitConfig {
	const path = getChatGptLimitConfigPath();
	if (!existsSync(path)) return { ...DEFAULT_CHATGPT_LIMIT_CONFIG };
	try {
		return normalizeChatGptLimitConfig(JSON.parse(readFileSync(path, "utf8")));
	} catch {
		return { ...DEFAULT_CHATGPT_LIMIT_CONFIG };
	}
}

export function writeChatGptLimitConfig(config: ChatGptLimitConfig): void {
	const normalized = normalizeChatGptLimitConfig(config);
	const path = getChatGptLimitConfigPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function describeChatGptLimitConfig(config: ChatGptLimitConfig): string {
	const quotaWindow = CHATGPT_LIMIT_QUOTA_WINDOW_OPTIONS.find(
		(option) => option.value === config.quotaWindow,
	);
	const displayMode = CHATGPT_LIMIT_DISPLAY_MODE_OPTIONS.find(
		(option) => option.value === config.displayMode,
	);
	return `${quotaWindow?.label ?? "Weekly usage"}; ${displayMode?.label ?? "Used percent"}`;
}
