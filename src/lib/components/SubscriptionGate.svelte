<script lang="ts">
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { goto } from '$app/navigation';
</script>

<!-- Subscription Gate: shown to free-tier users on the Insights page -->
<div class="space-y-8">
	<!-- Hero banner -->
	<div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 md:p-12 text-white shadow-xl">
		<!-- Background pattern -->
		<div class="absolute inset-0 opacity-10">
			<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
						<circle cx="2" cy="2" r="1.5" fill="white" />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#dots)" />
			</svg>
		</div>

		<div class="relative z-10 max-w-2xl mx-auto text-center">
			<!-- AI icon -->
			<div class="mx-auto w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2C12 2 8 8 8 12a4 4 0 0 0 8 0c0-4-4-10-4-10z" fill="white" opacity="0.3" />
					<circle cx="12" cy="12" r="10" />
					<circle cx="12" cy="12" r="3" />
					<path d="M12 6v-2M12 20v-2M6 12H4M20 12h-2" />
				</svg>
			</div>

			<h2 class="text-2xl md:text-3xl font-bold tracking-tight mb-3">
				Unlock AI-Powered Insights
			</h2>
			<p class="text-white/85 text-sm md:text-base leading-relaxed mb-8 max-w-lg mx-auto">
				Get personalized fuel predictions, driving analysis, real-time AI coaching, and smart cost forecasts powered by machine learning.
			</p>

			<Button
				class="bg-white text-indigo-700 hover:bg-white/90 h-12 px-8 text-base font-semibold shadow-lg"
				onclick={() => goto(`${base}/settings`)}
			>
				{#snippet children()}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2">
						<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
					</svg>
					Activate Pro
				{/snippet}
			</Button>
		</div>
	</div>

	<!-- Feature comparison -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<Card.Root class="border-2 border-dashed">
			<Card.Content class="pt-6">
				<div class="flex items-start gap-3">
					<div class="shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
							<circle cx="12" cy="12" r="10" />
							<path d="M12 2C12 2 8 8 8 12a4 4 0 0 0 8 0c0-4-4-10-4-10z" fill="currentColor" opacity="0.2" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold text-sm">AI Fuel Predictions</h3>
						<p class="text-xs text-muted-foreground mt-1">Predict efficiency and forecast costs based on your driving patterns</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-2 border-dashed">
			<Card.Content class="pt-6">
				<div class="flex items-start gap-3">
					<div class="shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600">
							<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold text-sm">Driving Score Analysis</h3>
						<p class="text-xs text-muted-foreground mt-1">Detailed driving behavior scoring with radar charts and breakdowns</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-2 border-dashed">
			<Card.Content class="pt-6">
				<div class="flex items-start gap-3">
					<div class="shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-600">
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold text-sm">Real-time AI Coaching</h3>
						<p class="text-xs text-muted-foreground mt-1">Live driving tips and fuel-saving alerts during your trips</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
