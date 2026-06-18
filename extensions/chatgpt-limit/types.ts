export type ChatGptLimitQuotaWindow =
	| "weekly"
	| "fiveHour"
	| "both"
	| "hidden";

export type ChatGptLimitDisplayMode =
	| "used"
	| "compact"
	| "pace"
	| "paceCompact"
	| "paceResetCompact"
	| "remaining"
	| "remainingCompact";

export interface ChatGptLimitWindow {
	usedPercent: number;
	windowSeconds: number;
	resetAt?: number;
}

export interface ChatGptLimitSnapshot {
	planType?: string;
	email?: string;
	fiveHour?: ChatGptLimitWindow;
	weekly?: ChatGptLimitWindow;
	fetchedAt: number;
}

export interface ChatGptLimitConfig {
	quotaWindow: ChatGptLimitQuotaWindow;
	displayMode: ChatGptLimitDisplayMode;
}

export interface ChatGptLimitState {
	usageSnapshot?: ChatGptLimitSnapshot;
	footerConfig: ChatGptLimitConfig;
}
