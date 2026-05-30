import type { SubagentActiveItem, SubagentRunCounts } from "../types/hud.js";
import { isRecord } from "../utils/records.js";

export function parseSubagentMessage(
	message: unknown,
): { requestId: string; counts: SubagentRunCounts } | undefined {
	if (!isRecord(message)) return undefined;
	if (
		message.role !== "custom" ||
		message.customType !== "subagent-slash-result"
	)
		return undefined;
	const details = message.details;
	if (!isRecord(details) || typeof details.requestId !== "string")
		return undefined;
	const result = details.result;
	if (!isRecord(result)) return undefined;
	const resultDetails = result.details;
	if (!isRecord(resultDetails)) return undefined;

	const statusSources = collectSubagentStatusSources(resultDetails);
	if (statusSources.length === 0) return undefined;

	const counts: SubagentRunCounts = {
		running: 0,
		completed: 0,
		failed: 0,
		tokens: 0,
		activeItems: [],
	};
	statusSources.forEach((source, index) => {
		if (typeof source.tokens === "number") counts.tokens += source.tokens;
		if (source.status === "running") {
			const label = getSubagentProgressLabel(source);
			const startedAt = Date.now() - getDurationMs(source);
			const activeItem: SubagentActiveItem = {
				id: `${details.requestId}:${index}`,
				label,
				startedAt,
				source: "message",
			};
			if (typeof source.tokens === "number") activeItem.tokens = source.tokens;
			counts.running++;
			counts.activeItems.push(activeItem);
			if (!counts.activeLabel) counts.activeLabel = label;
			if (!counts.activeStartedAt) counts.activeStartedAt = startedAt;
		} else if (source.status === "completed" || source.status === "complete")
			counts.completed++;
		else if (source.status === "failed") counts.failed++;
	});
	return { requestId: details.requestId, counts };
}

export function parseSubagentResultCounts(
	result: unknown,
): Pick<SubagentRunCounts, "completed" | "failed"> | undefined {
	if (!isRecord(result)) return undefined;
	const details = result.details;
	if (!isRecord(details)) return undefined;
	const statusSources = collectSubagentStatusSources(details);
	if (statusSources.length === 0) return undefined;
	const counts = { completed: 0, failed: 0 };
	for (const source of statusSources) {
		if (source.status === "failed") counts.failed++;
		else if (source.status === "completed" || source.status === "complete")
			counts.completed++;
	}
	return counts.completed > 0 || counts.failed > 0 ? counts : undefined;
}

export function getSubagentToolLabel(args: unknown): string {
	if (!isRecord(args)) return "subagent";
	const agent = typeof args.agent === "string" ? args.agent : undefined;
	const task = typeof args.task === "string" ? args.task : undefined;
	if (task) return task;
	if (agent) return agent;
	if (Array.isArray(args.tasks) && args.tasks.length > 0)
		return `${args.tasks.length} subagents`;
	if (Array.isArray(args.chain) && args.chain.length > 0)
		return `${args.chain.length} step chain`;
	return "subagent";
}

export function getSubagentToolActiveItems(
	args: unknown,
	toolCallId: string,
	startedAt: number,
): SubagentActiveItem[] {
	if (!isRecord(args)) {
		return [{ id: toolCallId, label: "subagent", startedAt, source: "tool" }];
	}
	if (Array.isArray(args.tasks) && args.tasks.length > 0) {
		return args.tasks.map((task, index) => ({
			id: `${toolCallId}:${index}`,
			label: getSubagentToolTaskLabel(task),
			startedAt,
			source: "tool",
		}));
	}
	return [
		{
			id: toolCallId,
			label: getSubagentToolLabel(args),
			startedAt,
			source: "tool",
		},
	];
}

function collectSubagentStatusSources(
	resultDetails: Record<string, unknown>,
): Array<Record<string, unknown>> {
	if (Array.isArray(resultDetails.progress)) {
		return resultDetails.progress.filter(isRecord);
	}
	if (!Array.isArray(resultDetails.results)) return [];
	return resultDetails.results.filter(isRecord).flatMap((result) => {
		if (isRecord(result.progress)) return [result.progress];
		if (typeof result.exitCode === "number") {
			return [{ status: result.exitCode === 0 ? "completed" : "failed" }];
		}
		return [];
	});
}

function getSubagentProgressLabel(progress: Record<string, unknown>): string {
	const task = typeof progress.task === "string" ? progress.task : undefined;
	const agent = typeof progress.agent === "string" ? progress.agent : undefined;
	return task || agent || "subagent";
}

function getSubagentToolTaskLabel(task: unknown): string {
	if (!isRecord(task)) return "subagent";
	const taskLabel = typeof task.task === "string" ? task.task : undefined;
	const agent = typeof task.agent === "string" ? task.agent : undefined;
	return taskLabel || agent || "subagent";
}

function getDurationMs(progress: Record<string, unknown>): number {
	return typeof progress.durationMs === "number"
		? Math.max(0, progress.durationMs)
		: 0;
}
