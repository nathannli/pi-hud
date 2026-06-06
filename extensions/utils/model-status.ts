import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";

export function getModelLabel(model: Model<Api> | undefined): string {
	return model?.name ?? model?.id ?? "No model";
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
