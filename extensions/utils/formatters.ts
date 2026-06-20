import { HUD_VISIBILITY_KEYS } from "../config/hud-settings.js";
import type { HudSettings } from "../types/hud.js";

export function formatHudSettings(settings: HudSettings): string {
	const visibility = HUD_VISIBILITY_KEYS.map(
		(key) => `${key}:${settings.visibility[key] ? "on" : "off"}`,
	).join(", ");
	return `HUD mode=${settings.mode}, position=${settings.position}, shortcut=${settings.shortcut || "disabled"}, switchShortcut=${settings.switchShortcut || "disabled"}, minimizeShortcut=${settings.minimizeShortcut || "disabled"}, autoCompactWhileStreaming=${settings.autoCompactWhileStreaming}, startupNotification=${settings.startupNotification}, usageDisplay=${settings.usageDisplay}, contextIndicator=${settings.contextIndicator}, expandedWidth=${settings.expandedWidth}, compactWidth=${settings.compactWidth}, minTerminalWidth=${settings.minTerminalWidth}, visibility=${visibility}`;
}

export function formatShortcut(shortcut: string): string {
	const trimmed = shortcut.trim();
	return trimmed.length > 0 ? trimmed : "disabled";
}

export function formatElapsed(startedAt: number | undefined): string {
	const elapsedSeconds = startedAt
		? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
		: 0;
	const minutes = Math.floor(elapsedSeconds / 60);
	const seconds = elapsedSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatNumber(value: number): string {
	if (value < 1000) return value.toLocaleString();
	if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
	return `${(value / 1_000_000).toFixed(1)}m`;
}

/** Format a USD cost with fixed precision (default 5 decimals to match footer). */
export function formatCost(value: number, decimals = 5): string {
	return `$${value.toFixed(decimals)}`;
}

/** Format per-category cost breakdown: `in $0.00100 out $0.00200 cache $0.00010/$0.00020`. */
export function formatCostBreakdown(stats: {
	inputCost: number;
	outputCost: number;
	cacheReadCost: number;
	cacheWriteCost: number;
}): string {
	return `in ${formatCost(stats.inputCost)} out ${formatCost(stats.outputCost)} cache ${formatCost(stats.cacheReadCost)}/${formatCost(stats.cacheWriteCost)}`;
}

/**
 * Format the current model's static per-million-token pricing:
 * `$0.60/mil tok in, $0.05/mil tok cache, $4.00/mil tok out`.
 * Rates come from the model provider and are static for the active model.
 */
export function formatModelPricing(cost: {
	input: number;
	output: number;
	cacheRead: number;
} | undefined): string {
	if (!cost) return "pricing unavailable";
	return `$${cost.input.toFixed(2)}/mil tok in, $${cost.cacheRead.toFixed(2)}/mil tok cache, $${cost.output.toFixed(2)}/mil tok out`;
}
