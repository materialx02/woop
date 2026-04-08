<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';

	let { onComplete }: { onComplete: () => void } = $props();

	let step = $state(0);
	const totalSteps = 4;

	function next() {
		if (step < totalSteps - 1) {
			step++;
		}
	}

	function prev() {
		if (step > 0) {
			step--;
		}
	}

	function skip() {
		onComplete();
	}

	function getStarted() {
		onComplete();
		goto(`${base}/vehicles/new`);
	}
</script>

<!-- Full-screen overlay -->
<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
	<div class="relative w-full max-w-lg bg-card rounded-xl shadow-2xl border overflow-hidden">
		<!-- Skip button -->
		{#if step < totalSteps - 1}
			<button
				onclick={skip}
				class="absolute top-4 right-4 z-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				Skip
			</button>
		{/if}

		<!-- Step content -->
		<div class="px-8 pt-10 pb-6">
			{#if step === 0}
				<!-- Welcome -->
				<div class="text-center space-y-5">
					<div class="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 2C12 2 4 8 4 14a8 8 0 0 0 16 0c0-6-8-12-8-12Z"/>
							<path d="M12 22v-4"/>
							<path d="M9 16l3-3 3 3"/>
						</svg>
					</div>
					<div>
						<h2 class="text-2xl font-bold tracking-tight">Welcome to DriveFuel</h2>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
							Your AI-powered personal fuel and driving assistant.
							Track fuel costs, monitor driving habits, and get smart insights to save money.
						</p>
					</div>
					<div class="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
						<span class="flex items-center gap-1.5">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
							Offline-first
						</span>
						<span class="flex items-center gap-1.5">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
							Single-user
						</span>
						<span class="flex items-center gap-1.5">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							Private data
						</span>
					</div>
				</div>

			{:else if step === 1}
				<!-- Feature: Fuel Tracking -->
				<div class="text-center space-y-5">
					<div class="mx-auto w-14 h-14 rounded-xl bg-success/15 text-success flex items-center justify-center">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><path d="M7 9h4"/></svg>
					</div>
					<div>
						<h2 class="text-xl font-bold tracking-tight">Track Every Fill-Up</h2>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
							Log fuel purchases with cost, liters, station, and brand.
							See your fuel efficiency (km/L), cost trends, and spending breakdowns at a glance.
						</p>
					</div>
					<div class="bg-muted/50 rounded-lg p-4 text-left space-y-2">
						<div class="flex items-center gap-3 text-sm">
							<span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
							<span>Add a fuel log after each fill-up</span>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
							<span>Track efficiency and cost per kilometer</span>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
							<span>View trends over time on the Insights page</span>
						</div>
					</div>
				</div>

			{:else if step === 2}
				<!-- Feature: Live Tracking & Trips -->
				<div class="text-center space-y-5">
					<div class="mx-auto w-14 h-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
					</div>
					<div>
						<h2 class="text-xl font-bold tracking-tight">Track Your Trips</h2>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
							Use live GPS tracking to record trips automatically.
							Monitor speed, braking habits, and acceleration patterns to improve your driving score.
						</p>
					</div>
					<div class="bg-muted/50 rounded-lg p-4 text-left space-y-2">
						<div class="flex items-center gap-3 text-sm">
							<span class="flex items-center gap-1.5 text-success">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Real-time GPS tracking
							</span>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<span class="flex items-center gap-1.5 text-success">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Driving behavior scoring
							</span>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<span class="flex items-center gap-1.5 text-success">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Hard braking & acceleration detection
							</span>
						</div>
						<div class="flex items-center gap-3 text-sm">
							<span class="flex items-center gap-1.5 text-success">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
								Demo mode to try it out first
							</span>
						</div>
					</div>
				</div>

			{:else if step === 3}
				<!-- Get Started -->
				<div class="text-center space-y-5">
					<div class="mx-auto w-14 h-14 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
					</div>
					<div>
						<h2 class="text-xl font-bold tracking-tight">Add Your First Vehicle</h2>
						<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
							To get started, add your vehicle with its name, fuel type, and tank size.
							You can always add more vehicles later.
						</p>
					</div>
					<div class="space-y-3 pt-2">
						<Button class="w-full h-12 text-base" onclick={getStarted}>
							{#snippet children()}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
								Add My Vehicle
							{/snippet}
						</Button>
						<button
							onclick={skip}
							class="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							I'll do it later
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer with dots and navigation -->
		<div class="px-8 pb-8 pt-2">
			<!-- Progress dots -->
			<div class="flex items-center justify-center gap-2 mb-5">
				{#each Array(totalSteps) as _, i}
					<button
						onclick={() => (step = i)}
						class="w-2 h-2 rounded-full transition-all duration-300 {i === step
							? 'bg-primary w-6'
							: 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}"
						aria-label="Go to step {i + 1}"
					></button>
				{/each}
			</div>

			<!-- Navigation buttons -->
			{#if step < totalSteps - 1}
				<div class="flex items-center justify-between">
					{#if step > 0}
						<Button variant="ghost" size="sm" onclick={prev}>
							{#snippet children()}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="m15 18-6-6 6-6"/></svg>
								Back
							{/snippet}
						</Button>
					{:else}
						<div></div>
					{/if}
					<Button onclick={next}>
						{#snippet children()}
							Next
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1"><path d="m9 18 6-6-6-6"/></svg>
						{/snippet}
					</Button>
				</div>
			{/if}
		</div>
	</div>
</div>
