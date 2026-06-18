import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	CHATGPT_BASE_URL,
	FIVE_HOUR_SECONDS,
	WEEK_SECONDS,
} from "./constants.js";
import { getTokenMetadata, isOpenAICodexProvider } from "./auth.js";
import {
	formatPacePercent,
	formatRemainingPercent,
	formatResetLong,
	formatUsedPercent,
} from "./format.js";
import type {
	ChatGptLimitSnapshot,
	ChatGptLimitState,
	ChatGptLimitWindow,
} from "./types.js";
import { isRecord } from "../utils/records.js";

function normalizeWindow(value: unknown): ChatGptLimitWindow | undefined {
	const record = isRecord(value) ? value : undefined;
	if (!record) return undefined;

	const usedPercent =
		typeof record.used_percent === "number" ? record.used_percent : undefined;
	const windowSeconds =
		typeof record.limit_window_seconds === "number"
			? record.limit_window_seconds
			: undefined;
	const resetAt = typeof record.reset_at === "number" ? record.reset_at : undefined;

	if (usedPercent === undefined || windowSeconds === undefined) return undefined;
	return { usedPercent, windowSeconds, resetAt };
}

function parseUsageSnapshot(data: unknown): ChatGptLimitSnapshot {
	const raw = isRecord(data) ? data : undefined;
	const rateLimit = isRecord(raw?.rate_limit) ? raw.rate_limit : undefined;
	const windows = [
		normalizeWindow(rateLimit?.primary_window),
		normalizeWindow(rateLimit?.secondary_window),
	].filter((window): window is ChatGptLimitWindow => window !== undefined);

	return {
		planType: typeof raw?.plan_type === "string" ? raw.plan_type : undefined,
		email: typeof raw?.email === "string" ? raw.email : undefined,
		fiveHour: windows.find(
			(window) => Math.abs(window.windowSeconds - FIVE_HOUR_SECONDS) <= 120,
		),
		weekly: windows.find(
			(window) => Math.abs(window.windowSeconds - WEEK_SECONDS) <= 120,
		),
		fetchedAt: Date.now(),
	};
}

export async function updateChatGptUsage(
	ctx: ExtensionContext,
	state: ChatGptLimitState,
): Promise<ChatGptLimitSnapshot | undefined> {
	const model = ctx.model;
	if (!model || !isOpenAICodexProvider(model.provider)) {
		state.usageSnapshot = undefined;
		return undefined;
	}

	const auth = await ctx.modelRegistry?.getApiKeyAndHeaders(model);
	if (!auth?.ok || !auth.apiKey) {
		state.usageSnapshot = undefined;
		return undefined;
	}

	const tokenMetadata = getTokenMetadata(auth.apiKey);
	const headers = {
		Authorization: `Bearer ${auth.apiKey}`,
		Accept: "application/json",
		"User-Agent": "pi-hud-chatgpt-limit",
		...(tokenMetadata.accountId
			? { "chatgpt-account-id": tokenMetadata.accountId }
			: {}),
	};

	try {
		const response = await fetch(`${CHATGPT_BASE_URL}/wham/usage`, {
			headers,
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			state.usageSnapshot = undefined;
			return undefined;
		}

		const snapshot = parseUsageSnapshot(await response.json());
		if (!snapshot.email && tokenMetadata.email) snapshot.email = tokenMetadata.email;
		if (!snapshot.planType && tokenMetadata.planType) {
			snapshot.planType = tokenMetadata.planType;
		}
		state.usageSnapshot = snapshot;
		return snapshot;
	} catch {
		state.usageSnapshot = undefined;
		return undefined;
	}
}

export function buildChatGptUsageDetails(
	snapshot: ChatGptLimitSnapshot | undefined,
	provider: string | undefined,
	footerDescription: string,
): string[] {
	const lines: string[] = [];
	lines.push(`provider: ${provider ?? "unknown"}`);
	lines.push(`plan: ${snapshot?.planType || "unknown"}`);
	if (snapshot?.email) lines.push(`email: ${snapshot.email}`);
	const fiveHourUsed = formatUsedPercent(snapshot?.fiveHour);
	const fiveHourRemaining = formatRemainingPercent(snapshot?.fiveHour);
	const fiveHourReset = formatResetLong(snapshot?.fiveHour?.resetAt);
	lines.push(
		`5-hour: ${fiveHourUsed} used, ${fiveHourRemaining} left, resets ${fiveHourReset}`,
	);
	const weeklyUsed = formatUsedPercent(snapshot?.weekly);
	const weeklyRemaining = formatRemainingPercent(snapshot?.weekly);
	const weeklyReset = formatResetLong(snapshot?.weekly?.resetAt);
	lines.push(
		`weekly: ${weeklyUsed} used, ${weeklyRemaining} left, resets ${weeklyReset}`,
	);
	lines.push(`pace: ${formatPacePercent(snapshot?.weekly)}`);
	if (snapshot?.fetchedAt) {
		lines.push(`fetched: ${new Date(snapshot.fetchedAt).toLocaleString()}`);
	}
	lines.push(`footer: ${footerDescription}`);
	lines.push(`endpoint: ${CHATGPT_BASE_URL}/wham/usage`);
	return lines;
}
