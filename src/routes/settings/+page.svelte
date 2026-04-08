<script lang="ts">
	import { base } from '$app/paths';
	import { db } from '$lib/db.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { themeState, type Theme } from '$lib/theme.svelte.js';
	import {
		isSupported as notifSupported,
		permissionState,
		requestPermission,
		syncSettingsToSW,
		init as initNotifications
	} from '$lib/notifications.js';
	import { subscription } from '$lib/subscription.svelte.js';
	import { checkAiHealth } from '$lib/ai-service.js';

	// Profile settings
	let displayName = $state('Driver');
	let defaultFuelType = $state('gasoline');
	let currency = $state('PHP');

	// Subscription
	let activationKey = $state('');
	let activationError = $state('');
	let activationSuccess = $state('');
	let aiStatus = $state<'unchecked' | 'checking' | 'connected' | 'disconnected'>('unchecked');

	// Fuel price
	let fuelPricePerLiter = $state(59.5);

	// Notification preferences
	let fuelPriceAlerts = $state(true);
	let efficiencyInsights = $state(true);
	let maintenanceReminders = $state(false);
	let notifPermission = $state<NotificationPermission | 'unsupported'>('default');

	// Status messages
	let saveMessage = $state('');

	// Load settings from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('drivefuel-settings');
			if (saved) {
				try {
					const settings = JSON.parse(saved);
					displayName = settings.displayName ?? 'Driver';
					defaultFuelType = settings.defaultFuelType ?? 'gasoline';
					currency = settings.currency ?? 'PHP';
					fuelPricePerLiter = settings.fuelPricePerLiter ?? 59.5;
					fuelPriceAlerts = settings.fuelPriceAlerts ?? true;
					efficiencyInsights = settings.efficiencyInsights ?? true;
					maintenanceReminders = settings.maintenanceReminders ?? false;
				} catch {
					// ignore parse errors
				}
			}
			notifPermission = permissionState();
		}
	});

	function saveSettings() {
		const settings = {
			displayName,
			defaultFuelType,
			currency,
			fuelPricePerLiter,
			fuelPriceAlerts,
			efficiencyInsights,
			maintenanceReminders
		};
		localStorage.setItem('drivefuel-settings', JSON.stringify(settings));
		saveMessage = 'Settings saved successfully!';
		setTimeout(() => (saveMessage = ''), 3000);

		// Sync notification settings to service worker
		if (notifSupported() && notifPermission === 'granted') {
			syncSettingsToSW({
				fuelPriceAlerts,
				efficiencyInsights,
				maintenanceReminders
			});
		}
	}

	async function enableNotifications() {
		const permission = await requestPermission();
		notifPermission = permission;
		if (permission === 'granted') {
			await syncSettingsToSW({
				fuelPriceAlerts,
				efficiencyInsights,
				maintenanceReminders
			});
			await initNotifications();
			saveMessage = 'Notifications enabled!';
			setTimeout(() => (saveMessage = ''), 3000);
		}
	}

	function activatePro() {
		activationError = '';
		activationSuccess = '';
		const ok = subscription.activate(activationKey);
		if (ok) {
			activationSuccess = 'Pro plan activated successfully!';
			activationKey = '';
			setTimeout(() => (activationSuccess = ''), 5000);
		} else {
			activationError = 'Invalid activation key. Format: DFPRO-XXXX-XXXX-XXXX';
		}
	}

	function deactivatePro() {
		if (!confirm('Are you sure you want to deactivate your Pro subscription?')) return;
		subscription.deactivate();
		activationSuccess = '';
		activationError = '';
	}

	async function testAiConnection() {
		aiStatus = 'checking';
		const ok = await checkAiHealth();
		aiStatus = ok ? 'connected' : 'disconnected';
	}

	async function exportAllData() {
		try {
			const vehicles = await db.vehicles.toArray();
			const fuelLogs = await db.fuelLogs.toArray();
			const tripLogs = await db.tripLogs.toArray();
			const aiInsights = await db.aiInsights.toArray();
			const fuelPrices = await db.fuelPrices.toArray();

			const data = {
				exportedAt: new Date().toISOString(),
				vehicles,
				fuelLogs,
				tripLogs,
				aiInsights,
				fuelPrices
			};

			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `drivefuel-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export failed:', error);
		}
	}

	async function clearAllData() {
		if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
			return;
		}
		try {
			await db.delete();
			window.location.reload();
		} catch (error) {
			console.error('Clear data failed:', error);
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
		<p class="text-muted-foreground">Manage your preferences and data</p>
	</div>

	<!-- 2-column layout -->
	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Left column -->
		<div class="space-y-6 lg:col-span-3">
			<!-- Card 1: Profile Settings -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Profile Settings</Card.Title>
					<Card.Description>
						{#snippet children()}Manage your personal information{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<div class="space-y-2">
							<Label for="displayName">Display Name</Label>
							<Input id="displayName" type="text" bind:value={displayName} placeholder="Driver" />
						</div>

						<div class="space-y-2">
							<Label for="defaultFuelType">Default Fuel Type</Label>
							<select
								id="defaultFuelType"
								bind:value={defaultFuelType}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<option value="gasoline">Gasoline</option>
								<option value="diesel">Diesel</option>
								<option value="ev">Electric</option>
								<option value="hybrid">Hybrid</option>
							</select>
						</div>

						<div class="space-y-2">
							<Label for="currency">Currency</Label>
							<select
								id="currency"
								bind:value={currency}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<option value="PHP">&#8369; PHP</option>
								<option value="USD">$ USD</option>
								<option value="EUR">&#8364; EUR</option>
								<option value="JPY">&#165; JPY</option>
							</select>
						</div>

						<div class="space-y-2">
							<Label for="fuelPrice">Fuel Price per Liter ({currency === 'PHP' ? '₱' : currency})</Label>
							<Input
								id="fuelPrice"
								type="number"
								step="0.1"
								min="0"
								bind:value={fuelPricePerLiter}
								placeholder="59.5"
							/>
							<p class="text-xs text-muted-foreground">
								Used for estimated fuel cost calculations. Update this when fuel prices change.
							</p>
						</div>

						{#if saveMessage}
							<p class="text-sm text-green-600">{saveMessage}</p>
						{/if}

						<Button class="bg-green-600 hover:bg-green-700 text-white" onclick={saveSettings}>
							{#snippet children()}Save Changes{/snippet}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Card: Subscription -->
			<Card.Root class={subscription.isPro ? 'border-primary/40' : ''}>
				<Card.Header>
					<div class="flex items-center justify-between">
						<Card.Title>Subscription</Card.Title>
						{#if subscription.isPro}
							<span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Pro Active
							</span>
						{:else}
							<span class="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
								Free Plan
							</span>
						{/if}
					</div>
					<Card.Description>
						{#snippet children()}Manage your DriveFuel AI subscription{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#if subscription.isPro}
							<!-- Pro status -->
							<div class="rounded-lg border border-primary/20 bg-primary/5 p-4">
								<div class="flex items-start gap-3">
									<div class="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary">
											<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
										</svg>
									</div>
									<div class="flex-1">
										<p class="font-semibold text-sm">Pro Plan</p>
										<p class="text-xs text-muted-foreground mt-0.5">
											Full access to AI predictions, driving analysis, cost forecasting, and real-time coaching.
										</p>
										{#if subscription.activatedAt}
											<p class="text-xs text-muted-foreground mt-1">
												Activated: {new Date(subscription.activatedAt).toLocaleDateString()}
											</p>
										{/if}
									</div>
								</div>
							</div>

							<!-- AI Service status -->
							<div class="flex items-center justify-between">
								<span class="text-sm text-muted-foreground">AI Service Status</span>
								<div class="flex items-center gap-2">
									{#if aiStatus === 'connected'}
										<span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
										<span class="text-sm text-green-600">Connected</span>
									{:else if aiStatus === 'disconnected'}
										<span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
										<span class="text-sm text-red-500">Offline</span>
									{:else if aiStatus === 'checking'}
										<span class="text-sm text-muted-foreground">Checking...</span>
									{:else}
										<Button variant="ghost" size="sm" onclick={testAiConnection}>
											{#snippet children()}Check{/snippet}
										</Button>
									{/if}
								</div>
							</div>

							<Button variant="outline" class="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onclick={deactivatePro}>
								{#snippet children()}Deactivate Pro{/snippet}
							</Button>
						{:else}
							<!-- Free plan — activation form -->
							<div class="rounded-lg border border-dashed p-4">
								<div class="space-y-3">
									<div class="flex items-start gap-3">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mt-0.5 shrink-0">
											<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
										</svg>
										<div>
											<p class="font-semibold text-sm">Upgrade to Pro</p>
											<p class="text-xs text-muted-foreground mt-0.5">
												Enter your activation key to unlock AI-powered insights, predictions, and real-time driving analysis.
											</p>
										</div>
									</div>

									<div class="space-y-2">
										<Label for="activationKey">Activation Key</Label>
										<div class="flex gap-2">
											<Input
												id="activationKey"
												type="text"
												bind:value={activationKey}
												placeholder="DFPRO-XXXX-XXXX-XXXX"
												class="font-mono uppercase"
											/>
											<Button onclick={activatePro} disabled={!activationKey.trim()}>
												{#snippet children()}Activate{/snippet}
											</Button>
										</div>
									</div>

									{#if activationError}
										<p class="text-sm text-destructive">{activationError}</p>
									{/if}
									{#if activationSuccess}
										<p class="text-sm text-green-600">{activationSuccess}</p>
									{/if}
								</div>
							</div>

							<!-- Pro features list -->
							<div class="space-y-2">
								<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pro includes</p>
								{#each [
									'AI fuel efficiency predictions',
									'Smart cost forecasting',
									'Driving behavior analysis',
									'Real-time AI coaching during trips',
									'Personalized optimization tips'
								] as feature}
									<div class="flex items-center gap-2 text-sm">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
										<span>{feature}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Card: Appearance -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Appearance</Card.Title>
					<Card.Description>
						{#snippet children()}Choose your preferred theme{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-3 gap-3">
						{#each [
							{ value: 'light', label: 'Light' },
							{ value: 'dark', label: 'Dark' },
							{ value: 'system', label: 'System' }
						] as option}
							<button
								onclick={() => themeState.set(option.value as Theme)}
								class="flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors
									{themeState.current === option.value
										? 'border-primary bg-primary/5'
										: 'border-border hover:border-muted-foreground/30'}"
							>
								{#if option.value === 'light'}
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500">
										<circle cx="12" cy="12" r="4"/>
										<path d="M12 2v2"/><path d="M12 20v2"/>
										<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
										<path d="M2 12h2"/><path d="M20 12h2"/>
										<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
									</svg>
								{:else if option.value === 'dark'}
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400">
										<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
									</svg>
								{:else}
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
										<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
									</svg>
								{/if}
								<span class="text-sm font-medium">{option.label}</span>
							</button>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Card 2: Notification Preferences -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Notification Preferences</Card.Title>
					<Card.Description>
						{#snippet children()}Choose which alerts to receive{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<!-- Permission Banner -->
						{#if notifPermission === 'unsupported'}
							<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
								<p class="text-sm text-amber-600 dark:text-amber-400">
									Notifications are not supported in this browser.
								</p>
							</div>
						{:else if notifPermission === 'default'}
							<button
								onclick={enableNotifications}
								class="w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/20"
							>
								<div class="flex items-center gap-3">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary shrink-0">
										<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
									</svg>
									<div>
										<p class="text-sm font-medium text-primary">Enable Notifications</p>
										<p class="text-xs text-muted-foreground">Get background alerts for trip tracking, fuel prices, and maintenance reminders</p>
									</div>
								</div>
							</button>
						{:else if notifPermission === 'denied'}
							<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
								<p class="text-sm text-destructive">
									Notifications are blocked. Please enable them in your browser settings to receive alerts.
								</p>
							</div>
						{:else}
							<div class="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
								<div class="flex items-center gap-2">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600 dark:text-green-400">
										<path d="M20 6 9 17l-5-5"/>
									</svg>
									<p class="text-sm text-green-600 dark:text-green-400">
										Notifications enabled — you'll receive alerts even when the app is minimized
									</p>
								</div>
							</div>
						{/if}

						<!-- Fuel Price Alerts -->
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">Fuel Price Alerts</p>
								<p class="text-sm text-muted-foreground">Get notified about fuel price changes</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={fuelPriceAlerts}
								class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {fuelPriceAlerts ? 'bg-primary' : 'bg-muted'}"
								onclick={() => {
									fuelPriceAlerts = !fuelPriceAlerts;
									saveSettings();
								}}
							>
								<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {fuelPriceAlerts ? 'translate-x-6' : 'translate-x-1'}" />
							</button>
						</div>

						<!-- Efficiency Insights -->
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">Efficiency Insights</p>
								<p class="text-sm text-muted-foreground">Receive AI efficiency recommendations</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={efficiencyInsights}
								class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {efficiencyInsights ? 'bg-primary' : 'bg-muted'}"
								onclick={() => {
									efficiencyInsights = !efficiencyInsights;
									saveSettings();
								}}
							>
								<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {efficiencyInsights ? 'translate-x-6' : 'translate-x-1'}" />
							</button>
						</div>

						<!-- Maintenance Reminders -->
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">Maintenance Reminders</p>
								<p class="text-sm text-muted-foreground">Service and maintenance alerts</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={maintenanceReminders}
								class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {maintenanceReminders ? 'bg-primary' : 'bg-muted'}"
								onclick={() => {
									maintenanceReminders = !maintenanceReminders;
									saveSettings();
								}}
							>
								<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {maintenanceReminders ? 'translate-x-6' : 'translate-x-1'}" />
							</button>
						</div>

						<!-- Trip Tracking Info -->
						{#if notifPermission === 'granted'}
							<div class="border-t pt-4">
								<div class="flex items-start gap-3">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground mt-0.5 shrink-0">
										<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
									</svg>
									<p class="text-xs text-muted-foreground">
										Live trip tracking notifications appear automatically when you minimize the app during an active trip, showing your distance, time, and speed — similar to ride-hailing apps.
									</p>
								</div>
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Card 3: Data Management -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Data Management</Card.Title>
					<Card.Description>
						{#snippet children()}Export or clear your data{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-3">
						<Button variant="outline" class="w-full border-primary text-primary hover:bg-primary/10" onclick={exportAllData}>
							{#snippet children()}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="7 10 12 15 17 10" />
									<line x1="12" y1="15" x2="12" y2="3" />
								</svg>
								Export All Data (JSON)
							{/snippet}
						</Button>
						<Button variant="destructive" class="w-full" onclick={clearAllData}>
							{#snippet children()}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
									<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
									<line x1="12" y1="9" x2="12" y2="13" />
									<line x1="12" y1="17" x2="12.01" y2="17" />
								</svg>
								Clear All Data
							{/snippet}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Right column -->
		<div class="lg:col-span-2">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-3">
						<!-- App icon -->
						<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2C12 2 4 8 4 14a8 8 0 0 0 16 0c0-6-8-12-8-12Z"/>
								<path d="M12 22v-4"/>
								<path d="M9 16l3-3 3 3"/>
							</svg>
						</div>
						<Card.Title>DriveFuel</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						<p class="text-sm text-muted-foreground">
							AI-powered fuel tracking and optimization platform helping you save money and drive more efficiently.
						</p>

						<!-- Info rows -->
						<div class="space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Version</span>
								<span class="font-medium">1.0.0</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Storage</span>
								<span class="font-medium">IndexedDB</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Privacy</span>
								<span class="font-medium">100% Private</span>
							</div>
						</div>

						<!-- Feature list -->
						<div class="space-y-2 pt-2">
							{#each ['Fuel log tracking', 'AI predictions', 'Live tracking', 'Cost optimization', 'Driving analysis'] as feature}
								<div class="flex items-center gap-2 text-sm">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600">
										<polyline points="20 6 9 17 4 12" />
									</svg>
									<span>{feature}</span>
								</div>
							{/each}
						</div>

						<!-- Footer note -->
						<p class="text-xs text-muted-foreground border-t pt-4">
							All data is stored locally on your device. No account or login is required.
						</p>
						<a
							href="{base}/privacy"
							class="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
						>
							Privacy Policy
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m9 18 6-6-6-6"/>
							</svg>
						</a>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
