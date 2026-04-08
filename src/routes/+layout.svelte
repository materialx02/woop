<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { themeState } from '$lib/theme.svelte.js';
	import { pwaInfo } from 'virtual:pwa-info';
	import { onMount } from 'svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { db } from '$lib/db.js';
	import { tripState } from '$lib/trip-state.svelte.js';

	import { init as initNotifications } from '$lib/notifications.js';

	let { children } = $props();

	let drawerOpen = $state(false);
	let showOnboarding = $state(false);
	let onboardingChecked = $state(false);

	$effect(() => {
		themeState.init();
	});

	function completeOnboarding() {
		localStorage.setItem('drivefuel-onboarding-completed', 'true');
		showOnboarding = false;
	}

	// Close mobile drawer on navigation
	$effect(() => {
		page.url.pathname;
		drawerOpen = false;
	});

	onMount(async () => {
		// Show onboarding if never completed and no vehicles exist
		const completed = localStorage.getItem('drivefuel-onboarding-completed');
		if (!completed) {
			const vehicles = await db.vehicles.count();
			if (vehicles === 0) {
				showOnboarding = true;
			}
		}
		onboardingChecked = true;

		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegisteredSW(swUrl, registration) {
					console.log(`SW registered: ${swUrl}`);
					if (registration) {
						setInterval(() => registration.update(), 60 * 60 * 1000);
					}
				},
				onOfflineReady() {
					console.log('App ready to work offline');
				}
			});
		}

		// Initialize background notification system
		initNotifications();
	});

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5,
				refetchOnWindowFocus: false
			}
		}
	});

	const navItems = [
		{ href: '/live-tracking', label: 'Live Tracking', icon: 'tracking' },
		{ href: '/trips', label: 'Trips', icon: 'trips' },
		{ href: '/vehicles', label: 'Vehicles', icon: 'vehicles' },
		{ href: '/fuel-log', label: 'Fuel Log', icon: 'fuel' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	function isActive(href: string): boolean {
		return page.url.pathname.startsWith(base + href);
	}

	function toggleTheme() {
		themeState.set(themeState.current === 'dark' ? 'light' : 'dark');
	}

	// Derive current page title from route
	let currentPageTitle = $derived.by(() => {
		const item = navItems.find((n) => isActive(n.href));
		return item?.label ?? 'DriveFuel';
	});

	// Derive current page icon from route
	let currentPageIcon = $derived.by(() => {
		const item = navItems.find((n) => isActive(n.href));
		return item?.icon ?? 'dashboard';
	});

</script>

<svelte:head>
	<title>DriveFuel</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
	{#if pwaInfo?.webManifest?.href}
		<link rel="manifest" href={pwaInfo.webManifest.href} crossorigin="use-credentials" />
	{/if}
</svelte:head>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen bg-background">
		<!-- Header (mobile only) -->
		<header class="sticky top-0 z-30 w-full bg-card border-b shadow-sm md:hidden">
			<div class="flex h-14 items-center px-4">
				<!-- Hamburger -->
				<button
					onclick={() => (drawerOpen = !drawerOpen)}
					class="mr-3 flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
					aria-label="Toggle menu"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
					</svg>
				</button>

				<!-- Logo -->
				<a href="{base}/fuel-log" class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 2C12 2 4 8 4 14a8 8 0 0 0 16 0c0-6-8-12-8-12Z"/>
							<path d="M12 22v-4"/>
							<path d="M9 16l3-3 3 3"/>
						</svg>
					</div>
					<div>
						<span class="font-bold text-base leading-tight block">DriveFuel</span>
						<span class="text-[10px] text-muted-foreground leading-tight">Smart Fuel Tracking</span>
					</div>
				</a>

				<!-- Theme toggle -->
				<div class="ml-auto">
					<button
						onclick={toggleTheme}
						class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						aria-label="Toggle theme"
					>
						{#if themeState.current === 'dark'}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="4"/>
								<path d="M12 2v2"/><path d="M12 20v2"/>
								<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
								<path d="M2 12h2"/><path d="M20 12h2"/>
								<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
							</svg>
						{:else}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</header>

		<!-- Mobile Drawer Overlay -->
		{#if drawerOpen}
			<button
				class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
				onclick={() => (drawerOpen = false)}
				aria-label="Close menu"
			></button>
		{/if}

		<!-- Sidebar / Drawer -->
		<aside
			class="fixed top-0 left-0 z-50 h-full w-72 bg-card border-r shadow-xl
				transform transition-transform duration-300 ease-in-out md:transition-none
				{drawerOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:shadow-none"
		>
			<!-- Drawer Header -->
			<div class="flex items-center gap-2.5 px-5 h-14 border-b">
				<div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2C12 2 4 8 4 14a8 8 0 0 0 16 0c0-6-8-12-8-12Z"/>
						<path d="M12 22v-4"/>
						<path d="M9 16l3-3 3 3"/>
					</svg>
				</div>
				<div>
					<span class="font-bold text-base leading-tight block">DriveFuel</span>
					<span class="text-[10px] text-muted-foreground leading-tight">Smart Fuel Tracking</span>
				</div>
				<button
					onclick={() => (drawerOpen = false)}
					class="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors md:hidden"
					aria-label="Close menu"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
					</svg>
				</button>
			</div>

			<!-- Drawer Nav -->
			<nav class="flex flex-col gap-1 p-3">
				{#each navItems as item}
					<a
						href="{base}{item.href}"
						class="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
							{isActive(item.href)
								? 'text-primary bg-primary/10'
								: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
					>
						{@render navIcon(item.icon)}
						{item.label}
					</a>
				{/each}
			</nav>

			<!-- Drawer Footer -->
			<div class="absolute bottom-0 left-0 right-0 p-4 border-t">
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Theme</span>
					<button
						onclick={toggleTheme}
						class="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						aria-label="Toggle theme"
					>
						{#if themeState.current === 'dark'}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="4"/>
								<path d="M12 2v2"/><path d="M12 20v2"/>
								<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
								<path d="M2 12h2"/><path d="M20 12h2"/>
								<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
							</svg>
						{:else}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
							</svg>
						{/if}
					</button>
				</div>
				<p class="text-[10px] text-muted-foreground mt-2">v1.0.0 &middot; All data stored locally</p>
			</div>
		</aside>

		<!-- Main content area: offset by sidebar width on desktop -->
		<div class="md:ml-72">
			<!-- Desktop Header -->
			<header class="hidden md:block sticky top-0 z-30 w-full bg-card border-b shadow-sm">
				<div class="mx-auto max-w-[1400px] flex h-14 items-center px-8">
					<div class="flex items-center gap-2.5">
						{@render navIcon(currentPageIcon)}
						<h1 class="text-base font-semibold">{currentPageTitle}</h1>
					</div>
					<div class="ml-auto">
						<button
							onclick={toggleTheme}
							class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
							aria-label="Toggle theme"
						>
							{#if themeState.current === 'dark'}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<circle cx="12" cy="12" r="4"/>
									<path d="M12 2v2"/><path d="M12 20v2"/>
									<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
									<path d="M2 12h2"/><path d="M20 12h2"/>
									<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
								</svg>
							{:else}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
								</svg>
							{/if}
						</button>
					</div>
				</div>
			</header>

			<main class="mx-auto max-w-[1400px] px-4 py-5 md:px-8 md:py-6 pb-24 md:pb-6">
				{@render children()}
			</main>
		</div>

	</div>

	{#if onboardingChecked && showOnboarding && !tripState.active}
		<Onboarding onComplete={completeOnboarding} />
	{/if}
</QueryClientProvider>

{#snippet navIcon(icon: string)}
	{#if icon === 'fuel'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><path d="M7 9h4"/></svg>
	{:else if icon === 'trips'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
	{:else if icon === 'insights'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.997.398-.997.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/></svg>
	{:else if icon === 'tracking'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
	{:else if icon === 'vehicles'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
	{:else if icon === 'settings'}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
	{/if}
{/snippet}
