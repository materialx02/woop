/**
 * Subscription state management.
 * Manages free/pro plan status with localStorage persistence.
 */

export type Plan = 'free' | 'pro';

interface SubscriptionData {
	plan: Plan;
	activatedAt: string | null;
	activationKey: string | null;
}

const STORAGE_KEY = 'drivefuel-subscription';

const defaults: SubscriptionData = {
	plan: 'free',
	activatedAt: null,
	activationKey: null
};

function load(): SubscriptionData {
	if (typeof window === 'undefined') return { ...defaults };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return { ...defaults, ...JSON.parse(raw) };
	} catch {
		// ignore
	}
	return { ...defaults };
}

function save(data: SubscriptionData) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let _data = $state<SubscriptionData>(load());

export const subscription = {
	get plan(): Plan {
		return _data.plan;
	},

	get isPro(): boolean {
		return _data.plan === 'pro';
	},

	get activatedAt(): string | null {
		return _data.activatedAt;
	},

	/** Activate Pro with an activation key. Returns true if valid. */
	activate(key: string): boolean {
		const trimmed = key.trim().toUpperCase();
		if (!trimmed) return false;

		// Validate key format: DFPRO-XXXX-XXXX-XXXX (alphanumeric groups)
		const pattern = /^DFPRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
		if (!pattern.test(trimmed)) return false;

		_data = {
			plan: 'pro',
			activatedAt: new Date().toISOString(),
			activationKey: trimmed
		};
		save(_data);
		return true;
	},

	/** Deactivate Pro subscription and revert to free plan. */
	deactivate() {
		_data = { ...defaults };
		save(_data);
	},

	/** Re-read from localStorage (useful after external changes). */
	refresh() {
		_data = load();
	}
};
