export type NeuralwattQuotaDisplayMode =
	| "credits"
	| "energy"
	| "both"
	| "hidden";

export interface NeuralwattQuotaSnapshot {
	/** Current USD credit balance */
	creditsRemainingUsd?: number;
	/** Lifetime credits purchased or granted */
	totalCreditsUsd?: number;
	/** Credits used = total - remaining */
	creditsUsedUsd?: number;
	/** Billing method: "token" or "energy" */
	accountingMethod?: string;
	/** Subscription plan name, if subscribed */
	plan?: string;
	/** Subscription status, if subscribed */
	status?: string;
	/** kWh included this billing period, if subscribed */
	kwhIncluded?: number;
	/** kWh used this billing period, if subscribed */
	kwhUsed?: number;
	/** kWh remaining this billing period, if subscribed */
	kwhRemaining?: number;
	/** Whether usage has exceeded the included allocation */
	inOverage?: boolean;
	/** ISO 8601 end of current billing period */
	periodEnd?: string;
	/** API key name */
	keyName?: string;
	/** Per-key allowance limit, if configured */
	allowanceLimitUsd?: number;
	/** Per-key allowance spent, if configured */
	allowanceSpentUsd?: number;
	/** Per-key allowance remaining, if configured */
	allowanceRemainingUsd?: number;
	/** Current calendar month cost in USD */
	monthlyCostUsd?: number;
	/** Current calendar month request count */
	monthlyRequests?: number;
	fetchedAt: number;
}

export interface NeuralwattQuotaConfig {
	displayMode: NeuralwattQuotaDisplayMode;
}

export interface NeuralwattQuotaState {
	quotaSnapshot?: NeuralwattQuotaSnapshot;
	footerConfig: NeuralwattQuotaConfig;
}
