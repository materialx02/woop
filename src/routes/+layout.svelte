<script lang="ts">
	import '../app.css';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { themeState } from '$lib/theme.svelte.js';
	import { pwaInfo } from 'virtual:pwa-info';
	import { onMount } from 'svelte';

	let { children } = $props();

	$effect(() => {
		themeState.init();
	});

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onRegisteredSW(swUrl, registration) {
					console.log(`SW registered: ${swUrl}`);
					// Check for updates every hour
					if (registration) {
						setInterval(() => registration.update(), 60 * 60 * 1000);
					}
				},
				onOfflineReady() {
					console.log('App ready to work offline');
				}
			});
		}
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
		{ href: '', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/fuel-log', label: 'Fuel Log', icon: 'fuel' },
		{ href: '/trips', label: 'Trips', icon: 'trips' },
		{ href: '/insights', label: 'Insights', icon: 'insights' },
		{ href: '/live-tracking', label: 'Live Tracking', icon: 'tracking' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	function isActive(href: string): boolean {
		const fullHref = base + href;
		if (href === '') return page.url.pathname === base || page.url.pathname === base + '/';
		return page.url.pathname.startsWith(fullHref);
	}

	function toggleTheme() {
		themeState.set(themeState.current === 'dark' ? 'light' : 'dark');
	}
</script>

<svelte:head>
	<title>FuelWise</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
	{#if pwaInfo?.webManifest?.href}
		<link rel="manifest" href={pwaInfo.webManifest.href} crossorigin="use-credentials" />
	{/if}
</svelte:head>

<QueryClientProvider client={queryClient}>
	<div class="min-h-screen bg-background">
		<header class="sticky top-0 z-50 w-full bg-card border-b shadow-sm">
			<div class="container mx-auto flex h-16 items-center px-6">
				<!-- Logo -->
				<a href="{base}/" class="flex items-center gap-2.5 mr-8">
					<div class="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 22V6l9-4 9 4v16" />
							<path d="M12 2v20" />
							<path d="M3 10h18" />
							<path d="M3 14h18" />
						</svg>
					</div>
					<div>
						<span class="font-bold text-lg leading-tight block">FuelWise</span>
						<span class="text-xs text-muted-foreground leading-tight">AI-Powered Fuel Tracking</span>
					</div>
				</a>

				<!-- Navigation -->
				<nav class="flex items-center gap-1">
					{#each navItems as item}
						<a
							href="{base}{item.href}"
							class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
								{isActive(item.href)
									? 'text-primary bg-primary/8'
									: 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
						>
							{#if item.icon === 'dashboard'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
							{:else if item.icon === 'fuel'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><path d="M7 9h4"/></svg>
							{:else if item.icon === 'trips'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
							{:else if item.icon === 'insights'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.997.398-.997.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/></svg>
							{:else if item.icon === 'tracking'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
							{:else if item.icon === 'settings'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
							{item.label}
						</a>
					{/each}
				</nav>

				<!-- Theme toggle -->
				<div class="ml-auto">
					<button
						onclick={toggleTheme}
						class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
						aria-label="Toggle theme"
					>
						{#if themeState.current === 'dark'}
							<!-- Sun icon -->
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="4"/>
								<path d="M12 2v2"/><path d="M12 20v2"/>
								<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
								<path d="M2 12h2"/><path d="M20 12h2"/>
								<path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
							</svg>
						{:else}
							<!-- Moon icon -->
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
							</svg>
						{/if}
					</button>
				</div>
			</div>
		</header>

		<main class="container mx-auto px-6 py-6">
			{@render children()}
		</main>
	</div>
</QueryClientProvider>
