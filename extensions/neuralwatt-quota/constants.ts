import type {
	NeuralwattQuotaConfig,
	NeuralwattQuotaDisplayMode,
} from "./types.js";

export const NEURALWATT_BASE_URL = (
	process.env.NEURALWATT_BASE_URL || "https://api.neuralwatt.com/v1"
).replace(/\/+$/, "");

export const NEURALWATT_QUOTA_CONFIG_FILE_NAME = "neuralwatt-quota.json";
export const FETCH_TIMEOUT_MS = 15_000;

export const DEFAULT_NEURALWATT_QUOTA_CONFIG: NeuralwattQuotaConfig = {
	displayMode: "both",
};

export const NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS = [
	{ label: "Both credits and energy (default)", value: "both" },
	{ label: "Credits only", value: "credits" },
	{ label: "Energy only (subscription)", value: "energy" },
	{ label: "Hide usage from footer", value: "hidden" },
] as const satisfies readonly {
	label: string;
	value: NeuralwattQuotaDisplayMode;
}[];
