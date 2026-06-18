import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	DEFAULT_NEURALWATT_QUOTA_CONFIG,
	NEURALWATT_QUOTA_CONFIG_FILE_NAME,
	NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS,
} from "./constants.js";
import type {
	NeuralwattQuotaConfig,
	NeuralwattQuotaDisplayMode,
} from "./types.js";
import { isRecord } from "../utils/records.js";

function isDisplayMode(value: unknown): value is NeuralwattQuotaDisplayMode {
	return (
		typeof value === "string" &&
		NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS.some(
			(option) => option.value === value,
		)
	);
}

export function normalizeNeuralwattQuotaConfig(
	value: unknown,
): NeuralwattQuotaConfig {
	const record = isRecord(value) ? value : undefined;
	const rawDisplayMode = record?.displayMode;
	const displayMode = isDisplayMode(rawDisplayMode)
		? rawDisplayMode
		: DEFAULT_NEURALWATT_QUOTA_CONFIG.displayMode;
	return { displayMode };
}

export function getNeuralwattQuotaConfigPath(): string {
	const agentDir =
		process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
	return join(agentDir, NEURALWATT_QUOTA_CONFIG_FILE_NAME);
}

export function readNeuralwattQuotaConfig(): NeuralwattQuotaConfig {
	const path = getNeuralwattQuotaConfigPath();
	if (!existsSync(path)) return { ...DEFAULT_NEURALWATT_QUOTA_CONFIG };
	try {
		return normalizeNeuralwattQuotaConfig(
			JSON.parse(readFileSync(path, "utf8")),
		);
	} catch {
		return { ...DEFAULT_NEURALWATT_QUOTA_CONFIG };
	}
}

export function writeNeuralwattQuotaConfig(
	config: NeuralwattQuotaConfig,
): void {
	const normalized = normalizeNeuralwattQuotaConfig(config);
	const path = getNeuralwattQuotaConfigPath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function describeNeuralwattQuotaConfig(
	config: NeuralwattQuotaConfig,
): string {
	const displayMode = NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS.find(
		(option) => option.value === config.displayMode,
	);
	return displayMode?.label ?? "Both credits and energy";
}
