<script lang="ts">
	import type { DrivingScore } from '$lib/api.js';

	let { data }: { data: DrivingScore | null | undefined } = $props();

	const score = $derived(data?.score ?? 0);
	const percentage = $derived(score / 100);

	// SVG arc for gauge
	const radius = 80;
	const strokeWidth = 16;
	const circumference = Math.PI * radius; // half circle
	const dashOffset = $derived(circumference * (1 - percentage));

	function scoreColor(s: number): string {
		if (s >= 80) return 'text-green-500';
		if (s >= 60) return 'text-yellow-500';
		if (s >= 40) return 'text-orange-500';
		return 'text-red-500';
	}

	function scoreLabel(s: number): string {
		if (s >= 80) return 'Excellent';
		if (s >= 60) return 'Good';
		if (s >= 40) return 'Fair';
		return 'Needs Improvement';
	}
</script>

{#if data?.score != null}
	<div class="flex flex-col items-center gap-4">
		<!-- Gauge -->
		<div class="relative">
			<svg width="200" height="120" viewBox="0 0 200 120">
				<!-- Background arc -->
				<path
					d="M 20 100 A 80 80 0 0 1 180 100"
					fill="none"
					stroke="currentColor"
					stroke-width={strokeWidth}
					class="text-muted/30"
					stroke-linecap="round"
				/>
				<!-- Score arc -->
				<path
					d="M 20 100 A 80 80 0 0 1 180 100"
					fill="none"
					stroke="currentColor"
					stroke-width={strokeWidth}
					class={scoreColor(score)}
					stroke-linecap="round"
					stroke-dasharray={circumference}
					stroke-dashoffset={dashOffset}
					style="transition: stroke-dashoffset 0.8s ease-out"
				/>
			</svg>
			<div class="absolute inset-0 flex flex-col items-center justify-end pb-2">
				<span class="text-4xl font-bold {scoreColor(score)}">{score}</span>
				<span class="text-sm text-muted-foreground">{scoreLabel(score)}</span>
			</div>
		</div>

		<!-- Breakdown -->
		{#if data.breakdown}
			<div class="grid grid-cols-4 gap-3 w-full text-center text-xs">
				<div>
					<div class="font-semibold">{data.breakdown.braking}/25</div>
					<div class="text-muted-foreground">Braking</div>
				</div>
				<div>
					<div class="font-semibold">{data.breakdown.acceleration}/25</div>
					<div class="text-muted-foreground">Accel</div>
				</div>
				<div>
					<div class="font-semibold">{data.breakdown.idling}/25</div>
					<div class="text-muted-foreground">Idling</div>
				</div>
				<div>
					<div class="font-semibold">{data.breakdown.speed}/25</div>
					<div class="text-muted-foreground">Speed</div>
				</div>
			</div>
		{/if}

		<!-- Tips -->
		{#if data.tips.length > 0}
			<div class="w-full space-y-1.5">
				{#each data.tips as tip}
					<p class="text-sm text-muted-foreground flex gap-2">
						<span class="shrink-0">&#9679;</span>
						{tip}
					</p>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<p class="text-sm text-muted-foreground text-center py-8">No trip data yet. Log trips to see your driving score.</p>
{/if}
