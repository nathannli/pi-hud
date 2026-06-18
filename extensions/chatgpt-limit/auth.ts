import { OPENAI_AUTH_CLAIM, OPENAI_PROFILE_CLAIM } from "./constants.js";
import { isRecord } from "../utils/records.js";

export function isOpenAICodexProvider(provider: string | undefined): boolean {
	return provider === "openai-codex" || /^openai-codex-\d+$/.test(provider ?? "");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
	const parts = token.split(".");
	if (parts.length < 2) return {};

	try {
		const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
		const parsed: unknown = JSON.parse(decoded);
		return isRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

export function getTokenMetadata(token: string): {
	accountId?: string;
	planType?: string;
	email?: string;
} {
	const payload = decodeJwtPayload(token);
	const auth = payload[OPENAI_AUTH_CLAIM];
	const profile = payload[OPENAI_PROFILE_CLAIM];
	const authRecord = isRecord(auth) ? auth : undefined;
	const profileRecord = isRecord(profile) ? profile : undefined;

	return {
		accountId:
			typeof authRecord?.chatgpt_account_id === "string"
				? authRecord.chatgpt_account_id
				: undefined,
		planType:
			typeof authRecord?.chatgpt_plan_type === "string"
				? authRecord.chatgpt_plan_type
				: undefined,
		email:
			typeof profileRecord?.email === "string"
				? profileRecord.email
				: undefined,
	};
}
