import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface OpenSpecStatus {
	changeId: string;
	completedTasks?: number;
	totalTasks?: number;
	nextAction: string;
}

export function readOpenSpecStatus(projectPath: string): OpenSpecStatus | null {
	const openspecRoot = join(projectPath, "openspec");
	if (!existsSync(join(openspecRoot, "config.yaml"))) return null;

	const changesRoot = join(openspecRoot, "changes");
	if (!existsSync(changesRoot)) return null;

	const changeIds = readChangeIds(changesRoot);
	if (changeIds.length !== 1) return null;

	const changeId = changeIds[0]!;
	const changeRoot = join(changesRoot, changeId);
	const taskCounts = readTaskCounts(join(changeRoot, "tasks.md"));
	return {
		changeId,
		...taskCounts,
		nextAction: determineNextAction(changeRoot, taskCounts),
	};
}

function readChangeIds(changesRoot: string): string[] {
	try {
		return readdirSync(changesRoot, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() &&
					!entry.name.startsWith(".") &&
					entry.name !== "archive",
			)
			.map((entry) => entry.name)
			.sort();
	} catch {
		return [];
	}
}

function readTaskCounts(
	tasksPath: string,
): Pick<OpenSpecStatus, "completedTasks" | "totalTasks"> {
	if (!existsSync(tasksPath)) return {};
	try {
		const text = readFileSync(tasksPath, "utf8");
		const matches = [...text.matchAll(/^\s*- \[( |x|X)\]/gm)];
		if (matches.length === 0) return {};
		return {
			completedTasks: matches.filter((match) => match[1]?.toLowerCase() === "x")
				.length,
			totalTasks: matches.length,
		};
	} catch {
		return {};
	}
}

function determineNextAction(
	changeRoot: string,
	tasks: Pick<OpenSpecStatus, "completedTasks" | "totalTasks">,
): string {
	if (tasks.totalTasks !== undefined && tasks.completedTasks !== undefined) {
		if (tasks.completedTasks < tasks.totalTasks) return "apply";
		if (!existsSync(join(changeRoot, "verify-report.md"))) return "verify";
		if (!existsSync(join(changeRoot, "sync-report.md"))) return "sync";
		return "archive";
	}
	if (!existsSync(join(changeRoot, "proposal.md"))) return "proposal";
	if (!existsSync(join(changeRoot, "design.md"))) return "design";
	return "tasks";
}
