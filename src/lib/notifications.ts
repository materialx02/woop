/**
 * Notification service for DriveFuel PWA.
 *
 * Provides local notifications via the Service Worker when the app is
 * backgrounded or closed. Uses Periodic Background Sync (Chrome/Edge)
 * for background condition checks and the Notification API for alerts.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface NotificationSettings {
	fuelPriceAlerts: boolean;
	efficiencyInsights: boolean;
	maintenanceReminders: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

export function isSupported(): boolean {
	return 'Notification' in window && 'serviceWorker' in navigator;
}

export function permissionState(): NotificationPermission | 'unsupported' {
	if (!isSupported()) return 'unsupported';
	return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
	if (!isSupported()) return 'denied';
	return Notification.requestPermission();
}

// ── Settings ───────────────────────────────────────────────────────

export function getSettings(): NotificationSettings {
	try {
		const raw = localStorage.getItem('drivefuel-settings');
		if (raw) {
			const s = JSON.parse(raw);
			return {
				fuelPriceAlerts: s.fuelPriceAlerts ?? true,
				efficiencyInsights: s.efficiencyInsights ?? true,
				maintenanceReminders: s.maintenanceReminders ?? false
			};
		}
	} catch {
		/* ignore */
	}
	return { fuelPriceAlerts: true, efficiencyInsights: true, maintenanceReminders: false };
}

/**
 * Sync notification settings to IndexedDB so the service worker
 * can read them (SW cannot access localStorage).
 */
export async function syncSettingsToSW(settings: NotificationSettings): Promise<void> {
	const reg = await navigator.serviceWorker.ready;
	reg.active?.postMessage({ type: 'SYNC_SETTINGS', settings });
}

// ── Periodic Background Sync ───────────────────────────────────────

async function registerPeriodicSync(tag: string, minInterval: number): Promise<boolean> {
	try {
		const reg = await navigator.serviceWorker.ready;
		if ('periodicSync' in reg) {
			const status = await navigator.permissions.query({
				name: 'periodic-background-sync' as PermissionName
			});
			if (status.state === 'granted') {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await (reg as any).periodicSync.register(tag, { minInterval });
				return true;
			}
		}
	} catch (e) {
		console.warn('[DriveFuel] Periodic sync registration failed:', e);
	}
	return false;
}

// ── Trip Tracking ──────────────────────────────────────────────────

export interface TripUpdatePayload {
	vehicleName: string;
	distance: number;
	duration: number;
	avgSpeed: number;
	isTracking: boolean;
}

export async function sendTripUpdate(data: TripUpdatePayload): Promise<void> {
	const reg = await navigator.serviceWorker.ready;
	reg.active?.postMessage({ type: 'TRIP_UPDATE', ...data });
}

export async function endTripNotification(): Promise<void> {
	const reg = await navigator.serviceWorker.ready;
	reg.active?.postMessage({ type: 'TRIP_END' });
}

// ── Manual Check Trigger ───────────────────────────────────────────

export async function triggerCheck(): Promise<void> {
	const reg = await navigator.serviceWorker.ready;
	reg.active?.postMessage({ type: 'CHECK_NOW' });
}

// ── Initialization ─────────────────────────────────────────────────

/**
 * Call once on app mount. Syncs settings to the SW and registers
 * periodic background sync for notification checks.
 */
export async function init(): Promise<void> {
	if (!isSupported()) return;
	if (Notification.permission !== 'granted') return;

	// Sync current settings to the service worker
	await syncSettingsToSW(getSettings());

	// Register periodic background sync (Chrome/Edge only)
	// Every ~12 hours for maintenance/insights checks
	await registerPeriodicSync('drivefuel-check', 12 * 60 * 60 * 1000);
}
