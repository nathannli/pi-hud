import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionUIContext,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import {
	getCapabilities,
	hyperlink,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import { basename } from "node:path";
import {
	getGitBranch,
	getGitStatus,
	getGitWorktrees,
	type GitStatus,
} from "../git/git.js";
import { getMcpAdapterInfo } from "../mcp/mcp-adapter.js";
import type { SessionStats, SubagentStatus } from "../types/hud.js";
import { formatNumber } from "../utils/formatters.js";

type FooterFactory = NonNullable<
	Parameters<ExtensionUIContext["setFooter"]>[0]
>;
type FooterData = Parameters<FooterFactory>[2];
type FooterTextStyle = {
	text: string;
	color?: Parameters<Theme["fg"]>[0];
	bold?: boolean;
	hyperlinkUrl?: string;
};

const PI_HUD_DOCS_LABEL = "🔗 docs";
const PI_HUD_DOCS_URL = "https://github.com/ludevdot/pi-hud#readme";

export class HudFooter implements Component {
	private unsubscribeBranchChange?: () => void;

	constructor(
		private pi: ExtensionAPI,
		private ctx: ExtensionContext,
		private tui: TUI,
		private theme: Theme,
		private footerData: FooterData,
		private subagentStatus: SubagentStatus,
	) {
		this.unsubscribeBranchChange = this.footerData.onBranchChange(() =>
			this.tui.requestRender(),
		);
	}

	dispose(): void {
		this.unsubscribeBranchChange?.();
		this.unsubscribeBranchChange = undefined;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const safeWidth = Math.max(1, width);
		const projectPath = this.ctx.sessionManager.getCwd() || this.ctx.cwd;
		const projectName = formatProjectTitle(projectPath) ?? "Project";
		const branch = this.footerData.getGitBranch() ?? getGitBranch(projectPath);
		const gitStatus = getGitStatus(projectPath);
		const branchLabel = formatBranchLabel(branch, gitStatus);
		const stats = computeStats(this.ctx);
		const contextUsage = this.ctx.getContextUsage?.();
		const contextWindow =
			contextUsage?.contextWindow ?? this.ctx.model?.contextWindow ?? 0;
		const contextTokens = contextUsage?.tokens ?? stats.totalTokens;
		const contextPercent =
			contextUsage?.percent ??
			(contextWindow > 0 && contextTokens !== null
				? (contextTokens / contextWindow) * 100
				: null);
		const contextPercentSegment = formatContextPercentSegment(contextPercent);
		const modelLabel = this.ctx.model?.name ?? this.ctx.model?.id ?? "No model";
		const mcpAdapter = getMcpAdapterInfo(this.pi, projectPath);
		const mcpLabel = formatMcpCount(mcpAdapter);
		const worktree = getCurrentWorktreePath(projectPath);
		const extensionStatuses = [
			...this.footerData.getExtensionStatuses().values(),
		].filter((status) => shouldShowExtensionStatus(status));
		const subagentSegment = this.subagentStatus.seen
			? ` │ Subagents: ${this.subagentStatus.running} run · ${this.subagentStatus.completed} done · ${this.subagentStatus.failed} err`
			: "";
		const statusSegment =
			extensionStatuses.length > 0
				? ` │ Status: ${extensionStatuses.join(" │ ")}`
				: "";
		const sessionId = getSessionId(this.ctx);
		const docsHintStyle = formatDocsHintStyle();

		return [
			this.renderLine(
				`▏ 📁 Project  ${projectName} ${projectPath}${branchLabel}`,
				safeWidth,
			),
			this.renderLine(
				`▏ 🧠 Context  ${formatContextTokens(contextTokens)} tokens │ ${contextPercentSegment.text} used/${formatNumber(contextWindow)} ctx │ ${modelLabel} │ $${stats.cost.toFixed(5)} spent${subagentSegment}`,
				safeWidth,
				[contextPercentSegment],
			),
			this.renderLine(
				`▏ 🔌 MCP      ${mcpLabel} │ Worktree: ${worktree}`,
				safeWidth,
			),
			this.renderLine(
				`▏ ❔ Help     /hud-mode │ /hud-settings │ ${PI_HUD_DOCS_LABEL}${statusSegment}`,
				safeWidth,
				docsHintStyle ? [docsHintStyle] : [],
			),
			this.renderLine(formatSessionResumeLine(sessionId), safeWidth),
		];
	}

	private renderLine(
		raw: string,
		width: number,
		styles: FooterTextStyle[] = [],
	): string {
		const truncated = truncateToWidth(raw, width, "…", true);
		const padded = padToVisibleWidth(truncated, width);
		return this.theme.bg(
			"customMessageBg",
			applyTextStyles(padded, styles, this.theme),
		);
	}
}

function formatDocsHintStyle(): FooterTextStyle | null {
	return getCapabilities().hyperlinks
		? { text: PI_HUD_DOCS_LABEL, hyperlinkUrl: PI_HUD_DOCS_URL }
		: null;
}

function getSessionId(ctx: ExtensionContext): string {
	return (
		(ctx.sessionManager as { getSessionId?: () => string }).getSessionId?.() ??
		"unknown"
	);
}

function formatSessionResumeLine(sessionId: string): string {
	if (sessionId === "unknown") {
		return "▏ 🔁 Session  resume unavailable";
	}
	return `▏ 🔁 Session  resume: pi --session ${sessionId}`;
}

function computeStats(ctx: ExtensionContext): SessionStats {
	const stats: SessionStats = {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: 0,
		cost: 0,
		assistantMessages: 0,
	};

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "assistant")
			continue;

		const message = entry.message as AssistantMessage;
		stats.inputTokens += message.usage.input || 0;
		stats.outputTokens += message.usage.output || 0;
		stats.cacheReadTokens += message.usage.cacheRead || 0;
		stats.cacheWriteTokens += message.usage.cacheWrite || 0;
		stats.totalTokens += message.usage.totalTokens || 0;
		stats.cost += message.usage.cost.total || 0;
		stats.assistantMessages++;
	}

	return stats;
}

function formatProjectTitle(projectPath: string): string | null {
	const folderName = basename(projectPath.trim());
	if (!folderName) return null;
	return `${folderName[0]?.toLocaleUpperCase() ?? ""}${folderName.slice(1)}`;
}

function formatContextTokens(tokens: number | null): string {
	return tokens === null ? "unknown" : formatNumber(tokens);
}

function formatBranchLabel(branch: string | null, status: GitStatus): string {
	if (!branch) return ` ${formatGitStatusIcon(status)}`;
	const suffix = status === "conflict" ? "!" : status === "dirty" ? "*" : "";
	return ` ${formatGitStatusIcon(status)} (${branch}${suffix})`;
}

function formatGitStatusIcon(status: GitStatus): string {
	if (status === "conflict") return "🔴";
	if (status === "dirty") return "🟡";
	return "🟢";
}

function formatContextPercentSegment(percent: number | null): FooterTextStyle {
	if (percent === null) return { text: "unknown", color: "dim" };
	const icon = getContextUsageIcon(percent);
	return {
		text: `${icon} ${percent.toFixed(1)}%`,
		color: getContextUsageColor(percent),
		bold: percent >= 85,
	};
}

function getContextUsageIcon(percent: number): string {
	if (percent >= 95) return "🔴";
	if (percent >= 50) return "🟡";
	return "🟢";
}

function getContextUsageColor(
	percent: number | null,
): Parameters<Theme["fg"]>[0] {
	if (percent === null) return "dim";
	if (percent >= 95) return "error";
	if (percent >= 50) return "warning";
	return "accent";
}

function applyTextStyles(
	text: string,
	styles: FooterTextStyle[],
	theme: Theme,
): string {
	return styles.reduce((styledText, style) => {
		if (!styledText.includes(style.text)) return styledText;
		const content = style.bold ? theme.bold(style.text) : style.text;
		const colored = style.color ? theme.fg(style.color, content) : content;
		const linked = style.hyperlinkUrl
			? hyperlink(colored, style.hyperlinkUrl)
			: colored;
		return styledText.replace(style.text, linked);
	}, text);
}

function getCurrentWorktreePath(projectPath: string): string {
	const worktrees = getGitWorktrees(projectPath);
	if (worktrees.length <= 1) return "No worktrees";
	return worktrees.find((worktree) => worktree.current)?.path ?? "No worktrees";
}

function formatMcpCount(adapter: {
	available: boolean;
	servers: string[];
}): string {
	if (!adapter.available) return "0/0 servers";
	const configuredServers = adapter.servers.length;
	return `${configuredServers}/${configuredServers} servers`;
}

function shouldShowExtensionStatus(status: string): boolean {
	const trimmed = status.trim();
	return trimmed.length > 0 && !trimmed.startsWith("MCP:");
}

function padToVisibleWidth(text: string, width: number): string {
	return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}
