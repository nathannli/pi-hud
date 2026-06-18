import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_NEURALWATT_QUOTA_CONFIG,
	NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS,
} from "./constants.js";
import {
	describeNeuralwattQuotaConfig,
	normalizeNeuralwattQuotaConfig,
	writeNeuralwattQuotaConfig,
} from "./config.js";
import { isNeuralwattProvider } from "./auth.js";
import { buildNeuralwattQuotaDetails } from "./usage.js";
import type {
	NeuralwattQuotaSnapshot,
	NeuralwattQuotaState,
} from "./types.js";

async function configureDisplayMode(
	ctx: ExtensionCommandContext,
	state: NeuralwattQuotaState,
	onChange: () => void,
): Promise<void> {
	const selected = await ctx.ui.select(
		"What should the NeuralWatt quota footer show?",
		NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS.map((option) => option.label),
	);
	const option = NEURALWATT_QUOTA_DISPLAY_MODE_OPTIONS.find(
		(candidate) => candidate.label === selected,
	);
	if (!option) return;

	state.footerConfig = normalizeNeuralwattQuotaConfig({
		...state.footerConfig,
		displayMode: option.value,
	});
	writeNeuralwattQuotaConfig(state.footerConfig);
	onChange();
	ctx.ui.notify(
		option.value === "hidden"
			? "NeuralWatt quota HUD display hidden."
			: `NeuralWatt quota HUD display: ${option.label}`,
		"info",
	);
}

async function resetFooterConfig(
	ctx: ExtensionCommandContext,
	state: NeuralwattQuotaState,
	onChange: () => void,
): Promise<void> {
	state.footerConfig = { ...DEFAULT_NEURALWATT_QUOTA_CONFIG };
	writeNeuralwattQuotaConfig(state.footerConfig);
	onChange();
	ctx.ui.notify(
		"NeuralWatt quota HUD settings reset to defaults.",
		"info",
	);
}

export function registerNeuralwattQuotaCommand(
	pi: ExtensionAPI,
	state: NeuralwattQuotaState,
	queueUpdate: (
		ctx: ExtensionCommandContext,
	) => Promise<NeuralwattQuotaSnapshot | undefined>,
	onChange: () => void,
): void {
	pi.registerCommand("neuralwatt-quota", {
		description:
			"Show NeuralWatt credit balance, energy quota, and usage details",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			const action = await ctx.ui.select("NeuralWatt quota", [
				"Show current quota details",
				`Configure HUD footer display (${describeNeuralwattQuotaConfig(state.footerConfig)})`,
				"Reset HUD footer settings to defaults",
			]);

			if (action === "Reset HUD footer settings to defaults") {
				await resetFooterConfig(ctx, state, onChange);
				return;
			}

			if (action?.startsWith("Configure HUD footer display")) {
				await configureDisplayMode(ctx, state, onChange);
				return;
			}

			if (!action) return;

			if (!isNeuralwattProvider(ctx.model?.provider)) {
				ctx.ui.notify(
					"NeuralWatt quota is only available for neuralwatt models.",
					"info",
				);
				return;
			}

			const snapshot = await queueUpdate(ctx);
			if (!snapshot) {
				ctx.ui.notify("Could not load NeuralWatt quota.", "warning");
				return;
			}

			await ctx.ui.select(
				"NeuralWatt quota",
				buildNeuralwattQuotaDetails(
					snapshot,
					ctx.model?.provider,
					describeNeuralwattQuotaConfig(state.footerConfig),
				),
			);
		},
	});
}
