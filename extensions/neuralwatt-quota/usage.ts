import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { FETCH_TIMEOUT_MS, NEURALWATT_BASE_URL } from "./constants.js";
import { isNeuralwattProvider } from "./auth.js";
import {
	formatCreditsUsedPercent,
	formatEnergyUsedPercent,
	formatKwh,
	formatPeriodEnd,
	formatUsd,
} from "./format.js";
import type {
	NeuralwattQuotaSnapshot,
	NeuralwattQuotaState,
} from "./types.js";
import { isRecord } from "../utils/records.js";

function parseQuotaSnapshot(data: unknown): NeuralwattQuotaSnapshot {
	const raw = isRecord(data) ? data : undefined;
	const balance = isRecord(raw?.balance) ? raw.balance : undefined;
	const subscription = isRecord(raw?.subscription) ? raw.subscription : undefined;
	const key = isRecord(raw?.key) ? raw.key : undefined;
	const allowance = isRecord(key?.allowance) ? key.allowance : undefined;
	const usage = isRecord(raw?.usage) ? raw.usage : undefined;
	const currentMonth = isRecord(usage?.current_month)
		? usage.current_month
		: undefined;

	const snapshot: NeuralwattQuotaSnapshot = {
		fetchedAt: Date.now(),
	};

	if (typeof balance?.credits_remaining_usd === "number")
		snapshot.creditsRemainingUsd = balance.credits_remaining_usd;
	if (typeof balance?.total_credits_usd === "number")
		snapshot.totalCreditsUsd = balance.total_credits_usd;
	if (typeof balance?.credits_used_usd === "number")
		snapshot.creditsUsedUsd = balance.credits_used_usd;
	if (typeof balance?.accounting_method === "string")
		snapshot.accountingMethod = balance.accounting_method;

	if (subscription) {
		if (typeof subscription.plan === "string")
			snapshot.plan = subscription.plan;
		if (typeof subscription.status === "string")
			snapshot.status = subscription.status;
		if (typeof subscription.kwh_included === "number")
			snapshot.kwhIncluded = subscription.kwh_included;
		if (typeof subscription.kwh_used === "number")
			snapshot.kwhUsed = subscription.kwh_used;
		if (typeof subscription.kwh_remaining === "number")
			snapshot.kwhRemaining = subscription.kwh_remaining;
		if (typeof subscription.in_overage === "boolean")
			snapshot.inOverage = subscription.in_overage;
		if (typeof subscription.current_period_end === "string")
			snapshot.periodEnd = subscription.current_period_end;
	}

	if (key) {
		if (typeof key.name === "string") snapshot.keyName = key.name;
		if (allowance) {
			if (typeof allowance.limit_usd === "number")
				snapshot.allowanceLimitUsd = allowance.limit_usd;
			if (typeof allowance.spent_usd === "number")
				snapshot.allowanceSpentUsd = allowance.spent_usd;
			if (typeof allowance.remaining_usd === "number")
				snapshot.allowanceRemainingUsd = allowance.remaining_usd;
		}
	}

	if (currentMonth) {
		if (typeof currentMonth.cost_usd === "number")
			snapshot.monthlyCostUsd = currentMonth.cost_usd;
		if (typeof currentMonth.requests === "number")
			snapshot.monthlyRequests = currentMonth.requests;
	}

	return snapshot;
}

export async function updateNeuralwattQuota(
	ctx: ExtensionContext,
	state: NeuralwattQuotaState,
): Promise<NeuralwattQuotaSnapshot | undefined> {
	const model = ctx.model;
	if (!model || !isNeuralwattProvider(model.provider)) {
		state.quotaSnapshot = undefined;
		return undefined;
	}

	const auth = await ctx.modelRegistry?.getApiKeyAndHeaders(model);
	if (!auth?.ok || !auth.apiKey) {
		state.quotaSnapshot = undefined;
		return undefined;
	}

	const headers = {
		Authorization: `Bearer ${auth.apiKey}`,
		Accept: "application/json",
		"User-Agent": "pi-hud-neuralwatt-quota",
	};

	try {
		const response = await fetch(`${NEURALWATT_BASE_URL}/quota`, {
			headers,
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!response.ok) {
			state.quotaSnapshot = undefined;
			return undefined;
		}

		const snapshot = parseQuotaSnapshot(await response.json());
		state.quotaSnapshot = snapshot;
		return snapshot;
	} catch {
		state.quotaSnapshot = undefined;
		return undefined;
	}
}

export function buildNeuralwattQuotaDetails(
	snapshot: NeuralwattQuotaSnapshot | undefined,
	provider: string | undefined,
	footerDescription: string,
): string[] {
	const lines: string[] = [];
	lines.push(`provider: ${provider ?? "unknown"}`);

	if (snapshot?.accountingMethod)
		lines.push(`billing: ${snapshot.accountingMethod}`);

	const creditsUsed = formatCreditsUsedPercent(snapshot);
	lines.push(
		`credits: ${formatUsd(snapshot?.creditsRemainingUsd)} remaining of ${formatUsd(snapshot?.totalCreditsUsd)} (${creditsUsed} used)`,
	);

	if (snapshot?.plan) {
		const energyUsed = formatEnergyUsedPercent(snapshot);
		lines.push(
			`energy: ${formatKwh(snapshot?.kwhRemaining)} remaining of ${formatKwh(snapshot?.kwhIncluded)} (${energyUsed} used)`,
		);
		lines.push(`plan: ${snapshot.plan}`);
		if (snapshot.status) lines.push(`status: ${snapshot.status}`);
		if (snapshot.inOverage !== undefined)
			lines.push(`in overage: ${snapshot.inOverage ? "yes" : "no"}`);
		if (snapshot.periodEnd)
			lines.push(`resets: ${formatPeriodEnd(snapshot.periodEnd)}`);
	}

	if (snapshot?.keyName) {
		lines.push(`key: ${snapshot.keyName}`);
		if (snapshot.allowanceLimitUsd !== undefined) {
			lines.push(
				`allowance: ${formatUsd(snapshot.allowanceSpentUsd)}/${formatUsd(snapshot.allowanceLimitUsd)} spent, ${formatUsd(snapshot.allowanceRemainingUsd)} remaining`,
			);
		}
	}

	if (snapshot?.monthlyCostUsd !== undefined) {
		lines.push(`this month: ${formatUsd(snapshot.monthlyCostUsd)}`);
		if (snapshot.monthlyRequests !== undefined)
			lines.push(`requests: ${snapshot.monthlyRequests.toLocaleString()}`);
	}

	if (snapshot?.fetchedAt) {
		lines.push(`fetched: ${new Date(snapshot.fetchedAt).toLocaleString()}`);
	}
	lines.push(`footer: ${footerDescription}`);
	lines.push(`endpoint: ${NEURALWATT_BASE_URL}/quota`);
	return lines;
}
