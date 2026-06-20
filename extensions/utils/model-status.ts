import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

export function getModelLabel(model: Model<Api> | undefined): string {
	const modelLabel = model?.name ?? model?.id ?? "No model";
	const providerLabel = model?.provider?.trim();
	if (!providerLabel || providerLabel === modelLabel) return modelLabel;
	return `${providerLabel} / ${modelLabel}`;
}

export function getThinkingLabel(
	pi: ExtensionAPI,
	model: Model<Api> | undefined,
): string | null {
	if (model?.reasoning !== true) return null;
	const thinkingLevel = (
		pi as { getThinkingLevel?: () => string | undefined }
	).getThinkingLevel?.();
	return thinkingLevel ? `thinking: ${thinkingLevel}` : null;
}
