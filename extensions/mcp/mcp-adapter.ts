import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isRecord } from "../utils/records.js";

export function getMcpAdapterInfo(pi: ExtensionAPI, cwd: string): { available: boolean; servers: string[] } {
	const hasAdapter = pi.getAllTools().some((tool) => isMcpAdapterSource(tool.sourceInfo.source)) || pi.getCommands().some((command) => isMcpAdapterSource(command.sourceInfo.source));
	if (!hasAdapter) return { available: false, servers: [] };
	return { available: true, servers: getConfiguredMcpServers(cwd) };
}

function isMcpAdapterSource(source: string): boolean {
	return source.includes("pi-mcp-adapter") || source.includes("nicobailon/pi-mcp-adapter");
}

function getConfiguredMcpServers(cwd: string): string[] {
	const names = new Set<string>();
	for (const path of getMcpConfigPaths(cwd)) {
		for (const name of readMcpServerNames(path)) {
			names.add(name);
		}
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}

function getMcpConfigPaths(cwd: string): string[] {
	const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return [join(homedir(), ".config", "mcp", "mcp.json"), join(agentDir, "mcp.json"), join(cwd, ".mcp.json"), join(cwd, ".pi", "mcp.json")];
}

function readMcpServerNames(path: string): string[] {
	if (!existsSync(path)) return [];
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) return [];
		return Object.keys(parsed.mcpServers);
	} catch {
		return [];
	}
}
