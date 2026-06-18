import type {
	ChatGptLimitDisplayMode,
	ChatGptLimitState,
	ChatGptLimitWindow,
} from "./types.js";
import type { Theme } from "@earendil-works/pi-coding-agent";

export function formatUsedPercent(window: ChatGptLimitWindow | undefined): string {
	if (!window) return "?%";
	return `${Math.round(Math.max(0, Math.min(100, window.usedPercent)))}%`;
}

export function formatRemainingPercent(
	window: ChatGptLimitWindow | undefined,
): string {
	if (!window) return "?%";
	return `${Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)))}%`;
}

export function formatResetShort(resetAt: number | undefined): string {
	if (!resetAt) return "?";

	const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000));
	const days = Math.floor(minutes / (60 * 24));
	const hours = Math.floor((minutes % (60 * 24)) / 60);

	if (days > 0) return `~${days}d`;
	if (hours > 0) return `~${hours}h`;
	return `~${minutes}m`;
}

export function formatResetLong(resetAt: number | undefined): string {
	if (!resetAt) return "unknown";

	const minutes = Math.max(0, Math.round((resetAt * 1000 - Date.now()) / 60000));
	const days = Math.floor(minutes / (60 * 24));
	const hours = Math.floor((minutes % (60 * 24)) / 60);
	const mins = minutes % 60;

	if (days > 0) return `in ${days}d ${hours}h`;
	if (hours > 0) return `in ${hours}h ${mins}m`;
	return `in ${mins}m`;
}

function calculatePacePercentValue(window: ChatGptLimitWindow | undefined): number {
	if (!window?.resetAt || !window.windowSeconds) return Number.NaN;

	const nowSec = Date.now() / 1000;
	const windowStart = window.resetAt - window.windowSeconds;
	if (nowSec < windowStart) return Number.NaN;

	const elapsedSec = Math.min(window.windowSeconds, nowSec - windowStart);
	const elapsedPercent = (elapsedSec / window.windowSeconds) * 100;
	if (elapsedPercent < 0.1) return Number.NaN;

	return window.usedPercent - elapsedPercent;
}

export function formatPacePercent(window: ChatGptLimitWindow | undefined): string {
	const pace = calculatePacePercentValue(window);
	if (Number.isNaN(pace)) {
		if (!window?.resetAt || !window.windowSeconds) return "?%";
		const nowSec = Date.now() / 1000;
		const windowStart = window.resetAt - window.windowSeconds;
		if (nowSec < windowStart) return "?% (not started)";
		return "?% (starting)";
	}

	if (Math.abs(pace) < 0.1) return "0% (on pace)";
	const roundedPace = Math.round(Math.abs(pace));
	return pace > 0 ? `${roundedPace}% (deficit)` : `${roundedPace}% (reserve)`;
}

export function formatPacePercentShort(
	window: ChatGptLimitWindow | undefined,
): string {
	const pace = calculatePacePercentValue(window);
	if (Number.isNaN(pace)) return "?%";
	if (pace > 0) return `+${Math.round(pace)}%`;
	if (pace < 0) return `${Math.round(pace)}%`;
	return "=0%";
}

function getUsageColor(
	window: ChatGptLimitWindow | undefined,
): Parameters<Theme["fg"]>[0] {
	const used = Math.max(0, Math.min(100, window?.usedPercent ?? 0));
	if (used >= 90) return "error";
	if (used >= 80) return "warning";
	return "dim";
}

function formatFooterUsageText(
	mode: ChatGptLimitDisplayMode,
	label: "5h" | "W",
	window: ChatGptLimitWindow | undefined,
): string {
	if (label === "W" && mode.startsWith("pace")) {
		if (mode === "pace") return `WP ${formatPacePercent(window)}`;
		if (mode === "paceCompact") return `WP ${formatPacePercentShort(window)}`;
		if (mode === "paceResetCompact") {
			return `WP ${formatPacePercentShort(window)} · ${formatResetShort(window?.resetAt)}`;
		}
	}

	if (mode === "remaining") return `${label} ${formatRemainingPercent(window)} left`;
	if (mode === "remainingCompact") {
		return `${label} ${formatRemainingPercent(window)} left · ${formatResetShort(window?.resetAt)}`;
	}

	const used = formatUsedPercent(window);
	return mode === "compact"
		? `${label} ${used} · ${formatResetShort(window?.resetAt)}`
		: `${label} ${used}`;
}

function formatFooterUsagePart(
	state: ChatGptLimitState,
	label: "5h" | "W",
	window: ChatGptLimitWindow | undefined,
	theme?: Theme,
): string | undefined {
	if (!window) return undefined;
	const text = formatFooterUsageText(state.footerConfig.displayMode, label, window);
	return theme ? theme.fg(getUsageColor(window), text) : text;
}

export function formatChatGptLimitFooterUsage(
	state: ChatGptLimitState,
	theme?: Theme,
): string | undefined {
	if (state.footerConfig.quotaWindow === "hidden") return undefined;

	const parts: string[] = [];
	if (
		state.footerConfig.quotaWindow === "fiveHour" ||
		state.footerConfig.quotaWindow === "both"
	) {
		const part = formatFooterUsagePart(state, "5h", state.usageSnapshot?.fiveHour, theme);
		if (part) parts.push(part);
	}
	if (
		state.footerConfig.quotaWindow === "weekly" ||
		state.footerConfig.quotaWindow === "both"
	) {
		const part = formatFooterUsagePart(state, "W", state.usageSnapshot?.weekly, theme);
		if (part) parts.push(part);
	}

	const separator = theme ? theme.fg("dim", " / ") : " / ";
	return parts.length > 0 ? parts.join(separator) : undefined;
}
