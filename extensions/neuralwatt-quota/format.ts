import type {
	NeuralwattQuotaState,
	NeuralwattQuotaSnapshot,
} from "./types.js";
import type { Theme } from "@earendil-works/pi-coding-agent";

export function formatUsd(value: number | undefined): string {
	if (value === undefined) return "?";
	if (value < 0.01 && value > 0) return "<$0.01";
	return `$${value.toFixed(2)}`;
}

export function formatKwh(value: number | undefined): string {
	if (value === undefined) return "?";
	if (value < 1) return `${(value * 1_000).toFixed(1)} Wh`;
	return `${value.toFixed(2)} kWh`;
}

export function formatCreditsUsedPercent(
	snapshot: NeuralwattQuotaSnapshot | undefined,
): string {
	if (
		!snapshot?.totalCreditsUsd ||
		snapshot.totalCreditsUsd === 0 ||
		snapshot.creditsRemainingUsd === undefined
	)
		return "?%";
	const usedPercent =
		((snapshot.totalCreditsUsd - snapshot.creditsRemainingUsd) /
			snapshot.totalCreditsUsd) *
		100;
	return `${Math.round(Math.max(0, Math.min(100, usedPercent)))}%`;
}

export function formatEnergyUsedPercent(
	snapshot: NeuralwattQuotaSnapshot | undefined,
): string {
	if (
		!snapshot?.kwhIncluded ||
		snapshot.kwhIncluded === 0 ||
		snapshot.kwhUsed === undefined
	)
		return "?%";
	const usedPercent = (snapshot.kwhUsed / snapshot.kwhIncluded) * 100;
	return `${Math.round(Math.max(0, Math.min(100, usedPercent)))}%`;
}

export function formatPeriodEnd(periodEnd: string | undefined): string {
	if (!periodEnd) return "unknown";
	try {
		return new Date(periodEnd).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	} catch {
		return "unknown";
	}
}

type ThemeColor = Parameters<Theme["fg"]>[0];

function getCreditsColor(
	snapshot: NeuralwattQuotaSnapshot | undefined,
): ThemeColor {
	if (
		!snapshot?.totalCreditsUsd ||
		snapshot.totalCreditsUsd === 0 ||
		snapshot.creditsRemainingUsd === undefined
	)
		return "dim";
	const remainingPercent =
		(snapshot.creditsRemainingUsd / snapshot.totalCreditsUsd) * 100;
	if (remainingPercent <= 20) return "error";
	if (remainingPercent <= 50) return "warning";
	return "dim";
}

function getEnergyColor(
	snapshot: NeuralwattQuotaSnapshot | undefined,
): ThemeColor {
	if (
		!snapshot?.kwhIncluded ||
		snapshot.kwhIncluded === 0 ||
		snapshot.kwhRemaining === undefined
	)
		return "dim";
	const remainingPercent =
		(snapshot.kwhRemaining / snapshot.kwhIncluded) * 100;
	if (remainingPercent <= 20) return "error";
	if (remainingPercent <= 50) return "warning";
	return "dim";
}

function formatCreditsPart(
	snapshot: NeuralwattQuotaSnapshot | undefined,
	theme?: Theme,
): string | undefined {
	if (snapshot?.creditsRemainingUsd === undefined) return undefined;
	const text = `${formatUsd(snapshot.creditsRemainingUsd)} left`;
	return theme ? theme.fg(getCreditsColor(snapshot), text) : text;
}

function formatEnergyPart(
	snapshot: NeuralwattQuotaSnapshot | undefined,
	theme?: Theme,
): string | undefined {
	if (snapshot?.kwhRemaining === undefined) return undefined;
	const text = `⚡ ${formatKwh(snapshot.kwhRemaining)} left`;
	return theme ? theme.fg(getEnergyColor(snapshot), text) : text;
}

export function formatNeuralwattQuotaFooterUsage(
	state: NeuralwattQuotaState,
	theme?: Theme,
): string | undefined {
	if (state.footerConfig.displayMode === "hidden") return undefined;

	const snapshot = state.quotaSnapshot;
	if (!snapshot) return undefined;

	const parts: string[] = [];
	if (
		state.footerConfig.displayMode === "credits" ||
		state.footerConfig.displayMode === "both"
	) {
		const part = formatCreditsPart(snapshot, theme);
		if (part) parts.push(part);
	}
	if (
		state.footerConfig.displayMode === "energy" ||
		state.footerConfig.displayMode === "both"
	) {
		const part = formatEnergyPart(snapshot, theme);
		if (part) parts.push(part);
	}

	const separator = theme ? theme.fg("dim", " / ") : " / ";
	return parts.length > 0 ? parts.join(separator) : undefined;
}
