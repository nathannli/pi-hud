import type { GitPowerlineInfo, GitStatus } from "../git/git.js";

export function formatGitPowerlineLabel(
	info: GitPowerlineInfo | null,
	fallbackBranch: string | null,
): string | null {
	if (!info && !fallbackBranch) return null;
	const status = info?.status ?? "clean";
	const branch =
		info?.branch ??
		fallbackBranch ??
		(info?.commit ? `detached@${info.commit}` : info?.detached ? "detached" : null);
	const branchSegment = branch ? ` ${branch}` : "";
	const divergence = formatGitDivergence(info);
	const changes = formatGitChanges(info);
	return `${formatGitStatusIcon(status)}${branchSegment}${divergence}${changes}`;
}

export function formatGitStatusIcon(status: GitStatus): string {
	if (status === "conflict") return "🔴";
	if (status === "dirty") return "🟡";
	return "🟢";
}

function formatGitDivergence(info: GitPowerlineInfo | null): string {
	if (!info) return "";
	const ahead = info.ahead > 0 ? ` ↑${info.ahead}` : "";
	const behind = info.behind > 0 ? ` ↓${info.behind}` : "";
	return `${ahead}${behind}`;
}

function formatGitChanges(info: GitPowerlineInfo | null): string {
	if (!info) return "";
	const conflicts = info.conflicts > 0 ? ` !${info.conflicts}` : "";
	const staged = info.staged > 0 ? ` +${info.staged}` : "";
	const unstaged = info.unstaged > 0 ? ` ~${info.unstaged}` : "";
	const untracked = info.untracked > 0 ? ` ?${info.untracked}` : "";
	return `${conflicts}${staged}${unstaged}${untracked}`;
}
