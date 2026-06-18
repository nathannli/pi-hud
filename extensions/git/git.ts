import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export interface GitWorktree {
	path: string;
	label: string;
	current: boolean;
}

export type GitStatus = "clean" | "dirty" | "conflict";

export interface GitPowerlineInfo {
	branch: string | null;
	detached: boolean;
	commit: string | null;
	status: GitStatus;
	staged: number;
	unstaged: number;
	untracked: number;
	conflicts: number;
	ahead: number;
	behind: number;
	remoteUrl: string | null;
	githubRepo: string | null;
}

export function getGitBranch(cwd: string): string | null {
	const gitPaths = findGitPaths(cwd);
	if (!gitPaths) return null;
	const result = spawnSync(
		"git",
		["--no-optional-locks", "symbolic-ref", "--quiet", "--short", "HEAD"],
		{
			cwd: gitPaths.repoDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		},
	);
	const branch = result.status === 0 ? result.stdout.trim() : "";
	return branch || null;
}

export function getGitWorktrees(cwd: string): GitWorktree[] {
	const gitPaths = findGitPaths(cwd);
	if (!gitPaths) return [];
	const result = spawnSync(
		"git",
		["--no-optional-locks", "worktree", "list", "--porcelain"],
		{
			cwd: gitPaths.repoDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		},
	);
	if (result.status !== 0) return [];
	return parseGitWorktreeList(result.stdout, gitPaths.repoDir);
}

export function getGitPowerlineInfo(cwd: string): GitPowerlineInfo | null {
	const gitPaths = findGitPaths(cwd);
	if (!gitPaths) return null;
	const fallbackBranch = getGitBranch(cwd);
	const statusResult = spawnSync(
		"git",
		["--no-optional-locks", "status", "--porcelain=v1", "--branch", "-uall"],
		{
			cwd: gitPaths.repoDir,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		},
	);
	const parsed = parseGitStatusPorcelain(
		statusResult.status === 0 ? statusResult.stdout : "",
		fallbackBranch,
	);
	const commit = parsed.detached ? getGitShortCommit(gitPaths.repoDir) : null;
	const remoteUrl = getGitRemoteUrl(gitPaths.repoDir);

	return {
		...parsed,
		commit,
		remoteUrl,
		githubRepo: parseGitHubRepository(remoteUrl),
	};
}

export function getGitDirty(cwd: string): boolean {
	return getGitStatus(cwd) !== "clean";
}

export function getGitStatus(cwd: string): GitStatus {
	return getGitPowerlineInfo(cwd)?.status ?? "clean";
}

function isConflictStatus(status: string): boolean {
	return ["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(status);
}

function parseGitStatusPorcelain(
	output: string,
	fallbackBranch: string | null,
): Omit<GitPowerlineInfo, "commit" | "remoteUrl" | "githubRepo"> {
	let branch = fallbackBranch;
	let detached = false;
	let ahead = 0;
	let behind = 0;
	let staged = 0;
	let unstaged = 0;
	let untracked = 0;
	let conflicts = 0;

	for (const line of output.split("\n")) {
		if (!line) continue;
		if (line.startsWith("## ")) {
			const parsedBranch = parseGitBranchHeader(line.slice(3), fallbackBranch);
			branch = parsedBranch.branch;
			detached = parsedBranch.detached;
			ahead = parsedBranch.ahead;
			behind = parsedBranch.behind;
			continue;
		}

		const status = line.slice(0, 2);
		if (status.trim().length === 0) continue;
		if (isConflictStatus(status)) {
			conflicts++;
			continue;
		}
		if (status === "??") {
			untracked++;
			continue;
		}

		const [indexStatus, worktreeStatus] = status;
		if (indexStatus && indexStatus !== " ") staged++;
		if (worktreeStatus && worktreeStatus !== " ") unstaged++;
	}

	const status: GitStatus =
		conflicts > 0 || staged > 0 || unstaged > 0 || untracked > 0
			? conflicts > 0
				? "conflict"
				: "dirty"
			: "clean";

	return {
		branch,
		detached,
		status,
		staged,
		unstaged,
		untracked,
		conflicts,
		ahead,
		behind,
	};
}

function parseGitBranchHeader(
	header: string,
	fallbackBranch: string | null,
): {
	branch: string | null;
	detached: boolean;
	ahead: number;
	behind: number;
} {
	let branch = fallbackBranch;
	let detached = false;
	let ahead = 0;
	let behind = 0;

	const divergenceMatch = header.match(/\[(.*)\]/);
	if (divergenceMatch?.[1]) {
		for (const marker of divergenceMatch[1].split(",")) {
			const aheadMatch = marker.trim().match(/^ahead (\d+)$/);
			const behindMatch = marker.trim().match(/^behind (\d+)$/);
			if (aheadMatch?.[1]) ahead = Number.parseInt(aheadMatch[1], 10);
			if (behindMatch?.[1]) behind = Number.parseInt(behindMatch[1], 10);
		}
	}

	const headerWithoutDivergence = header.replace(/\s*\[.*\]$/, "");
	if (headerWithoutDivergence.startsWith("No commits yet on ")) {
		branch = headerWithoutDivergence.slice("No commits yet on ".length).trim();
	} else if (headerWithoutDivergence.startsWith("HEAD ")) {
		detached = true;
		branch = null;
	} else {
		branch = headerWithoutDivergence.split("...")[0]?.trim() || fallbackBranch;
	}

	return { branch, detached, ahead, behind };
}

function getGitShortCommit(repoDir: string): string | null {
	const result = spawnSync("git", ["--no-optional-locks", "rev-parse", "--short", "HEAD"], {
		cwd: repoDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const commit = result.status === 0 ? result.stdout.trim() : "";
	return commit || null;
}

function getGitRemoteUrl(repoDir: string): string | null {
	const result = spawnSync("git", ["--no-optional-locks", "config", "--get", "remote.origin.url"], {
		cwd: repoDir,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
	const remoteUrl = result.status === 0 ? result.stdout.trim() : "";
	return remoteUrl || null;
}

function parseGitHubRepository(remoteUrl: string | null): string | null {
	if (!remoteUrl) return null;
	const normalized = remoteUrl.trim().replace(/\.git$/, "");
	const match =
		normalized.match(/^git@github\.com:([^/]+)\/(.+)$/) ??
		normalized.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+)$/) ??
		normalized.match(/^https?:\/\/github\.com\/([^/]+)\/(.+)$/);
	if (!match?.[1] || !match[2]) return null;
	return `${match[1]}/${match[2]}`;
}

function parseGitWorktreeList(
	output: string,
	currentRepoDir: string,
): GitWorktree[] {
	return output
		.trim()
		.split(/\n\s*\n/)
		.map((block) => {
			const lines = block.split("\n");
			const path = getPorcelainValue(lines, "worktree");
			if (!path || !isNearCurrentRepo(path, currentRepoDir)) return null;
			const branchRef = getPorcelainValue(lines, "branch");
			const label = branchRef?.replace(/^refs\/heads\//, "") ?? "detached";
			return {
				path,
				label,
				current: resolve(path) === resolve(currentRepoDir),
			};
		})
		.filter((entry): entry is GitWorktree => entry !== null);
}

function isNearCurrentRepo(path: string, currentRepoDir: string): boolean {
	return dirname(resolve(path)) === dirname(resolve(currentRepoDir));
}

function getPorcelainValue(lines: string[], key: string): string | null {
	const prefix = `${key} `;
	const line = lines.find((candidate) => candidate.startsWith(prefix));
	return line ? line.slice(prefix.length).trim() : null;
}

function findGitPaths(
	cwd: string,
): { repoDir: string; headPath: string } | null {
	let dir = cwd;
	while (true) {
		const gitPath = join(dir, ".git");
		if (existsSync(gitPath)) {
			try {
				const stat = statSync(gitPath);
				if (stat.isFile()) {
					const content = readFileSync(gitPath, "utf8").trim();
					if (content.startsWith("gitdir: ")) {
						const gitDir = resolve(dir, content.slice(8).trim());
						const headPath = join(gitDir, "HEAD");
						if (!existsSync(headPath)) return null;
						return { repoDir: dir, headPath };
					}
				} else if (stat.isDirectory()) {
					const headPath = join(gitPath, "HEAD");
					if (!existsSync(headPath)) return null;
					return { repoDir: dir, headPath };
				}
			} catch {
				return null;
			}
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}
