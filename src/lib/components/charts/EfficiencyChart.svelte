<script lang="ts">
	interface DataPoint {
		date: string;
		kmPerLiter: number;
		distance: number;
		liters: number;
	}

	let { data = [] }: { data: DataPoint[] } = $props();

	const maxVal = $derived(Math.max(...data.map((d) => d.kmPerLiter), 1));
</script>

{#if data.length > 0}
	<div class="h-64 w-full">
		<div class="flex items-end gap-1 h-full pb-8 relative">
			<!-- Y axis labels -->
			<div class="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-muted-foreground w-10">
				<span>{maxVal.toFixed(0)}</span>
				<span>{(maxVal / 2).toFixed(0)}</span>
				<span>0</span>
			</div>

			<!-- Bars -->
			<div class="flex items-end gap-1 h-full ml-12 flex-1">
				{#each data as point}
					<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
						<!-- Tooltip on hover -->
						<div class="absolute bottom-full mb-2 hidden group-hover:block bg-popover text-popover-foreground border rounded-md px-2 py-1 text-xs whitespace-nowrap z-10 shadow-md">
							<div class="font-medium">{point.date}</div>
							<div>{point.kmPerLiter.toFixed(1)} km/L</div>
							<div>{point.distance.toFixed(0)} km &middot; {point.liters.toFixed(1)} L</div>
						</div>
						<div
							class="w-full bg-primary/80 rounded-t-sm min-h-[4px] transition-all hover:bg-primary cursor-pointer"
							style="height: {(point.kmPerLiter / maxVal) * 100}%"
						></div>
					</div>
				{/each}
			</div>
		</div>
		<!-- X axis labels -->
		<div class="flex gap-1 ml-12">
			{#each data as point}
				<div class="flex-1 text-center">
					<span class="text-xs text-muted-foreground">{point.date.slice(5)}</span>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<p class="text-sm text-muted-foreground text-center py-8">No efficiency data yet. Log full-tank fill-ups to see trends.</p>
{/if}
