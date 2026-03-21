<script lang="ts">
	import { Chart, Svg, Axis, Area, Spline, Highlight } from 'layerchart';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import { curveMonotoneX } from 'd3-shape';

	interface DataPoint {
		date: string;
		totalCost: number;
	}

	let { data = [] }: { data: DataPoint[] } = $props();

	const chartData = $derived(
		data.map((d) => ({
			x: new Date(d.date),
			y: d.totalCost
		}))
	);
</script>

{#if chartData.length > 1}
	<div class="h-64 w-full">
		<Chart
			data={chartData}
			x="x"
			xScale={scaleTime()}
			y="y"
			yScale={scaleLinear()}
			yDomain={[0, undefined]}
			padding={{ left: 48, bottom: 24, top: 8, right: 8 }}
		>
			<Svg>
				<Axis placement="left" format={(v: number) => `₱${v}`} />
				<Axis placement="bottom" format={(v: Date) => `${v.getMonth() + 1}/${v.getDate()}`} />
				<Area line={{ curve: curveMonotoneX }} class="fill-primary/10" />
				<Spline curve={curveMonotoneX} class="stroke-primary stroke-2" />
				<Highlight points lines />
			</Svg>
		</Chart>
	</div>
{:else}
	<p class="text-sm text-muted-foreground text-center py-8">Need at least 2 fuel logs to show trend</p>
{/if}
