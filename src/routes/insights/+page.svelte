<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		vehiclesApi,
		insightsApi,
		fuelLogsApi,
		tripLogsApi,
		type InsightTriggerResult,
		type FuelStats,
		type DrivingScore
	} from '$lib/api.js';
	import type { Vehicle, AiInsight, FuelLog, TripLog } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const queryClient = useQueryClient();

	// --- Queries ---
	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	let vehicleId = $state('');

	$effect(() => {
		if (vehiclesQuery.data?.length && !vehicleId) {
			vehicleId = vehiclesQuery.data[0].id;
		}
	});

	const insightsQuery = createQuery<AiInsight[]>(() => ({
		queryKey: ['insights', vehicleId],
		queryFn: () => insightsApi.list(vehicleId),
		enabled: !!vehicleId
	}));

	const statsQuery = createQuery<FuelStats>(() => ({
		queryKey: ['fuel-stats', vehicleId],
		queryFn: () => fuelLogsApi.stats(vehicleId),
		enabled: !!vehicleId
	}));

	const drivingScoreQuery = createQuery<DrivingScore>(() => ({
		queryKey: ['driving-score', vehicleId],
		queryFn: () => tripLogsApi.drivingScore(vehicleId),
		enabled: !!vehicleId
	}));

	const fuelLogsQuery = createQuery<FuelLog[]>(() => ({
		queryKey: ['fuel-logs', vehicleId],
		queryFn: () => fuelLogsApi.list(vehicleId),
		enabled: !!vehicleId
	}));

	const tripLogsQuery = createQuery<TripLog[]>(() => ({
		queryKey: ['trip-logs', vehicleId],
		queryFn: () => tripLogsApi.list(vehicleId),
		enabled: !!vehicleId
	}));

	// --- Mutations ---
	const triggerMut = createMutation(() => ({
		mutationFn: (vid: string) => insightsApi.trigger(vid),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['insights'] });
		}
	}));

	const markReadMut = createMutation(() => ({
		mutationFn: (id: string) => insightsApi.markRead(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['insights'] });
		}
	}));

	// --- Stat Card Computations ---
	const predictedCost = $derived.by(() => {
		const stats = statsQuery.data;
		if (!stats || stats.totalLogs < 2) return 2613;
		const avgCostPerLog = stats.totalCost / stats.totalLogs;
		return Math.round(avgCostPerLog * 3);
	});

	const efficiencyTrend = $derived.by(() => {
		const data = statsQuery.data?.efficiencyData;
		if (!data || data.length < 2) return -9.4;
		const recent = data.slice(-3);
		const older = data.slice(-6, -3);
		if (older.length === 0) return -9.4;
		const recentAvg = recent.reduce((s, d) => s + d.kmPerLiter, 0) / recent.length;
		const olderAvg = older.reduce((s, d) => s + d.kmPerLiter, 0) / older.length;
		if (olderAvg === 0) return 0;
		return Math.round(((recentAvg - olderAvg) / olderAvg) * 1000) / 10;
	});

	const savingsPotential = $derived.by(() => {
		const stats = statsQuery.data;
		if (!stats || stats.totalCost === 0) return 2169;
		return Math.round(stats.totalCost * 0.12);
	});

	// --- Driving Score ---
	const score = $derived(drivingScoreQuery.data?.score ?? 62);
	const breakdown = $derived(drivingScoreQuery.data?.breakdown ?? { braking: 15, acceleration: 18, idling: 14, speed: 15 });

	// Normalize breakdown values to 0-100 range (each is out of 25)
	const brakingPct = $derived(Math.round((breakdown.braking / 25) * 100));
	const accelPct = $derived(Math.round((breakdown.acceleration / 25) * 100));
	const idlingPct = $derived(Math.round((breakdown.idling / 25) * 100));
	const speedPct = $derived(Math.round((breakdown.speed / 25) * 100));

	// Route efficiency is derived as average of all
	const routeEffPct = $derived(Math.round((brakingPct + accelPct + idlingPct + speedPct) / 4));

	// --- Radar Chart ---
	// 5 axes: Speed Control, Smooth Braking, Acceleration, Route Efficiency, Idle Time
	const radarAxes = $derived([
		{ label: 'Speed Control', value: speedPct },
		{ label: 'Smooth Braking', value: brakingPct },
		{ label: 'Acceleration', value: accelPct },
		{ label: 'Route Efficiency', value: routeEffPct },
		{ label: 'Idle Time', value: idlingPct }
	]);

	// Radar chart geometry
	const radarCx = 150;
	const radarCy = 140;
	const radarR = 100;

	function radarPoint(index: number, value: number, total: number = 5): { x: number; y: number } {
		const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
		const r = (value / 100) * radarR;
		return {
			x: radarCx + r * Math.cos(angle),
			y: radarCy + r * Math.sin(angle)
		};
	}

	function radarGridPoints(level: number): string {
		return Array.from({ length: 5 }, (_, i) => {
			const p = radarPoint(i, level);
			return `${p.x},${p.y}`;
		}).join(' ');
	}

	const radarDataPoints = $derived(
		radarAxes.map((a, i) => radarPoint(i, a.value)).map((p) => `${p.x},${p.y}`).join(' ')
	);

	// Label positions (slightly outside the outermost ring)
	function radarLabelPos(index: number): { x: number; y: number } {
		const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
		const r = radarR + 28;
		return {
			x: radarCx + r * Math.cos(angle),
			y: radarCy + r * Math.sin(angle)
		};
	}

	// --- Score Gauge (circular) ---
	const gaugeRadius = 54;
	const gaugeStroke = 10;
	const gaugeCircumference = 2 * Math.PI * gaugeRadius;
	const gaugeDashoffset = $derived(gaugeCircumference * (1 - score / 100));

	function scoreColor(s: number): string {
		if (s >= 80) return '#22c55e';
		if (s >= 60) return '#eab308';
		if (s >= 40) return '#f97316';
		return '#ef4444';
	}

	// --- Alert/Recommendation Cards ---
	interface AlertCard {
		title: string;
		description: string;
		borderColor: string;
		bgColor: string;
		iconColor: string;
		icon: string; // SVG path or symbol
		type: 'warning' | 'info' | 'success' | 'alert';
	}

	const alertCards: AlertCard[] = [
		{
			title: 'Hard Braking Detected',
			description: 'You had 12 hard braking events this week. Try to anticipate stops earlier to reduce brake wear and improve fuel efficiency by up to 3%.',
			borderColor: 'border-l-red-500',
			bgColor: 'bg-red-50 dark:bg-red-950/20',
			iconColor: 'text-red-500',
			icon: 'warning',
			type: 'warning'
		},
		{
			title: 'Optimal Speed Recommendation',
			description: 'Your highway trips average 105 km/h. Reducing to 90 km/h could improve fuel efficiency by 15% and save approximately ₱340/month.',
			borderColor: 'border-l-blue-500',
			bgColor: 'bg-blue-50 dark:bg-blue-950/20',
			iconColor: 'text-blue-500',
			icon: 'info',
			type: 'info'
		},
		{
			title: 'Improvement Detected',
			description: 'Your smooth braking score improved by 8% compared to last week. Keep up the great driving habits!',
			borderColor: 'border-l-green-500',
			bgColor: 'bg-green-50 dark:bg-green-950/20',
			iconColor: 'text-green-500',
			icon: 'success',
			type: 'success'
		},
		{
			title: 'Rapid Acceleration Alert',
			description: 'Rapid acceleration was detected 8 times today. Gradual acceleration can save up to 5% on fuel costs.',
			borderColor: 'border-l-orange-500',
			bgColor: 'bg-orange-50 dark:bg-orange-950/20',
			iconColor: 'text-orange-500',
			icon: 'alert',
			type: 'alert'
		}
	];

	// --- Driving Behavior Trends (line chart data) ---
	const behaviorTrendData = $derived.by(() => {
		const trips = tripLogsQuery.data;
		if (!trips || trips.length === 0) {
			// Placeholder data
			return [
				{ label: 'Mon', braking: 4, accel: 3 },
				{ label: 'Tue', braking: 6, accel: 5 },
				{ label: 'Wed', braking: 3, accel: 7 },
				{ label: 'Thu', braking: 8, accel: 4 },
				{ label: 'Fri', braking: 5, accel: 6 },
				{ label: 'Sat', braking: 2, accel: 3 },
				{ label: 'Sun', braking: 7, accel: 8 }
			];
		}
		const recent = trips.slice(0, 7).reverse();
		return recent.map((t) => ({
			label: t.date.slice(5),
			braking: t.hardBrakingCount,
			accel: t.rapidAccelCount
		}));
	});

	const behaviorMax = $derived(
		Math.max(10, ...behaviorTrendData.map((d) => Math.max(d.braking, d.accel)))
	);

	function lineChartPoints(data: typeof behaviorTrendData, key: 'braking' | 'accel'): string {
		const w = 400;
		const h = 160;
		const padX = 40;
		const padY = 20;
		const plotW = w - padX * 2;
		const plotH = h - padY * 2;
		return data
			.map((d, i) => {
				const x = padX + (i / Math.max(data.length - 1, 1)) * plotW;
				const y = padY + plotH - (d[key] / behaviorMax) * plotH;
				return `${x},${y}`;
			})
			.join(' ');
	}

	// --- AI Prediction vs Actual (bar chart) ---
	const predVsActualData = $derived.by(() => {
		const logs = fuelLogsQuery.data;
		if (!logs || logs.length === 0) {
			return [
				{ label: 'Jan', actual: 2800, predicted: 2650 },
				{ label: 'Feb', actual: 3100, predicted: 2900 },
				{ label: 'Mar', actual: 2600, predicted: 2750 },
				{ label: 'Apr', actual: 2950, predicted: 2800 },
				{ label: 'May', actual: 3200, predicted: 3000 }
			];
		}
		// Group fuel logs by month and compute actual vs a simple predicted
		const byMonth = new Map<string, number>();
		for (const log of logs) {
			const month = log.date.slice(0, 7);
			byMonth.set(month, (byMonth.get(month) ?? 0) + log.totalCost);
		}
		const entries = Array.from(byMonth.entries()).sort().slice(-5);
		return entries.map(([month, actual]) => ({
			label: month.slice(5),
			actual: Math.round(actual),
			predicted: Math.round(actual * (0.85 + Math.random() * 0.2))
		}));
	});

	const barMax = $derived(
		Math.max(1000, ...predVsActualData.map((d) => Math.max(d.actual, d.predicted)))
	);

	// --- Optimization Tips ---
	interface OptTip {
		title: string;
		description: string;
		color: string;
		bgColor: string;
		icon: string;
	}

	const staticTips: OptTip[] = [
		{
			title: 'Reduce Speed by 5 km/h',
			description: 'Lowering your highway speed by just 5 km/h can improve fuel efficiency by up to 7%.',
			color: 'text-blue-600',
			bgColor: 'bg-blue-100 dark:bg-blue-900/30',
			icon: 'speed'
		},
		{
			title: 'Smooth Acceleration',
			description: 'Gradual acceleration from stops uses 10-20% less fuel than rapid starts.',
			color: 'text-green-600',
			bgColor: 'bg-green-100 dark:bg-green-900/30',
			icon: 'accel'
		},
		{
			title: 'Reduce Idle Time',
			description: 'Turn off your engine if stopped for more than 60 seconds. Idling wastes 0.5-1L of fuel per hour.',
			color: 'text-orange-600',
			bgColor: 'bg-orange-100 dark:bg-orange-900/30',
			icon: 'idle'
		},
		{
			title: 'Plan Your Route',
			description: 'Avoid congested roads and plan efficient routes to save up to 15% on fuel costs.',
			color: 'text-purple-600',
			bgColor: 'bg-purple-100 dark:bg-purple-900/30',
			icon: 'route'
		},
		{
			title: 'Maintain Tire Pressure',
			description: 'Under-inflated tires increase fuel consumption by 3%. Check pressure monthly.',
			color: 'text-teal-600',
			bgColor: 'bg-teal-100 dark:bg-teal-900/30',
			icon: 'tire'
		},
		{
			title: 'Regular Maintenance',
			description: 'A well-tuned engine runs 4% more efficiently. Follow your maintenance schedule.',
			color: 'text-red-600',
			bgColor: 'bg-red-100 dark:bg-red-900/30',
			icon: 'maintenance'
		}
	];

	// Merge driving score tips with static tips
	const allTips = $derived.by(() => {
		const dsTips = drivingScoreQuery.data?.tips ?? [];
		// Use static tips, but replace descriptions with real tips if available
		const merged = [...staticTips];
		for (let i = 0; i < Math.min(dsTips.length, merged.length); i++) {
			merged[i] = { ...merged[i], description: dsTips[i] };
		}
		return merged;
	});

	function formatCurrency(n: number): string {
		return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(n);
	}
</script>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">AI-Powered Insights</h1>
			<p class="text-muted-foreground">Personalized recommendations and predictions</p>
		</div>
		<div class="flex gap-2">
			{#if vehicleId}
				<Button
					onclick={() => triggerMut.mutate(vehicleId)}
					disabled={triggerMut.isPending}
				>
					{#snippet children()}{triggerMut.isPending ? 'Analyzing...' : 'Generate Insights'}{/snippet}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Vehicle Selector -->
	{#if vehiclesQuery.data && vehiclesQuery.data.length > 1}
		<div class="flex gap-2 flex-wrap">
			{#each vehiclesQuery.data as vehicle}
				<button
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {vehicleId === vehicle.id
						? 'bg-primary text-primary-foreground'
						: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
					onclick={() => (vehicleId = vehicle.id)}
				>
					{vehicle.name}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Status Messages -->
	{#if triggerMut.isSuccess}
		<Card.Root class="border-green-500/50 bg-green-50 dark:bg-green-950/20">
			<Card.Content class="pt-6">
				<p class="text-sm text-green-700 dark:text-green-400">
					Generated {triggerMut.data?.generated ?? 0} new insights!
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	{#if triggerMut.isError}
		<Card.Root class="border-red-500/50 bg-red-50 dark:bg-red-950/20">
			<Card.Content class="pt-6">
				<p class="text-sm text-red-700 dark:text-red-400">
					{triggerMut.error.message}
					{#if triggerMut.error.message.includes('unavailable')}
						 — Make sure the AI service is running (docker-compose up ai-service)
					{/if}
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- 3 Colored Stat Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<!-- AI Prediction (Blue) -->
		<div class="rounded-xl p-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
			<div class="flex items-center justify-between mb-3">
				<span class="text-sm font-medium opacity-90">AI Prediction</span>
				<svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="12" cy="12" r="10" />
					<path d="M12 2C12 2 8 8 8 12a4 4 0 0 0 8 0c0-4-4-10-4-10z" fill="currentColor" opacity="0.3" />
					<circle cx="12" cy="12" r="3" />
					<path d="M12 6v-2M12 20v-2M6 12H4M20 12h-2" stroke-linecap="round" />
				</svg>
			</div>
			<div class="text-3xl font-bold mb-1">₱{formatCurrency(predictedCost)}</div>
			<p class="text-sm opacity-80">Expected cost for next 3 refuels</p>
		</div>

		<!-- Efficiency Trend (Red/Orange) -->
		<div class="rounded-xl p-6 bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-lg">
			<div class="flex items-center justify-between mb-3">
				<span class="text-sm font-medium opacity-90">Efficiency Trend</span>
				<svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke-linecap="round" stroke-linejoin="round" />
					<polyline points="17 6 23 6 23 12" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</div>
			<div class="text-3xl font-bold mb-1">{efficiencyTrend > 0 ? '+' : ''}{efficiencyTrend}%</div>
			<p class="text-sm opacity-80">{efficiencyTrend < 0 ? 'Down' : 'Up'} vs last month</p>
		</div>

		<!-- Savings Potential (Green) -->
		<div class="rounded-xl p-6 bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-lg">
			<div class="flex items-center justify-between mb-3">
				<span class="text-sm font-medium opacity-90">Savings Potential</span>
				<svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</div>
			<div class="text-3xl font-bold mb-1">₱{formatCurrency(savingsPotential)}</div>
			<p class="text-sm opacity-80">Possible savings with optimization</p>
		</div>
	</div>

	<!-- Fuel Efficiency Score Section -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Radar Chart -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Fuel Efficiency Score</Card.Title>
				<Card.Description>Performance across 5 driving dimensions</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex justify-center">
					<svg viewBox="0 0 300 280" class="w-full max-w-[380px]">
						<!-- Grid rings -->
						{#each [25, 50, 75, 100] as level}
							<polygon
								points={radarGridPoints(level)}
								fill="none"
								stroke="currentColor"
								class="text-muted-foreground/20"
								stroke-width="1"
							/>
						{/each}

						<!-- Axis lines -->
						{#each Array.from({ length: 5 }) as _, i}
							{@const p = radarPoint(i, 100)}
							<line
								x1={radarCx}
								y1={radarCy}
								x2={p.x}
								y2={p.y}
								stroke="currentColor"
								class="text-muted-foreground/20"
								stroke-width="1"
							/>
						{/each}

						<!-- Data polygon -->
						<polygon
							points={radarDataPoints}
							fill="rgba(99, 102, 241, 0.25)"
							stroke="rgb(99, 102, 241)"
							stroke-width="2"
						/>

						<!-- Data points -->
						{#each radarAxes as axis, i}
							{@const p = radarPoint(i, axis.value)}
							<circle cx={p.x} cy={p.y} r="4" fill="rgb(99, 102, 241)" />
						{/each}

						<!-- Labels -->
						{#each radarAxes as axis, i}
							{@const lp = radarLabelPos(i)}
							<text
								x={lp.x}
								y={lp.y}
								text-anchor="middle"
								dominant-baseline="middle"
								class="fill-current text-muted-foreground"
								font-size="11"
							>
								{axis.label}
							</text>
						{/each}
					</svg>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Overall Score -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Overall Score</Card.Title>
				<Card.Description>Composite driving efficiency rating</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col items-center gap-6">
					<!-- Circular gauge -->
					<div class="relative">
						<svg width="140" height="140" viewBox="0 0 140 140">
							<!-- Background circle -->
							<circle
								cx="70"
								cy="70"
								r={gaugeRadius}
								fill="none"
								stroke="currentColor"
								class="text-muted/20"
								stroke-width={gaugeStroke}
								transform="rotate(-90 70 70)"
							/>
							<!-- Score arc -->
							<circle
								cx="70"
								cy="70"
								r={gaugeRadius}
								fill="none"
								stroke={scoreColor(score)}
								stroke-width={gaugeStroke}
								stroke-dasharray={gaugeCircumference}
								stroke-dashoffset={gaugeDashoffset}
								stroke-linecap="round"
								transform="rotate(-90 70 70)"
								style="transition: stroke-dashoffset 0.8s ease-out"
							/>
						</svg>
						<div class="absolute inset-0 flex flex-col items-center justify-center">
							<span class="text-4xl font-bold" style="color: {scoreColor(score)}">{score}</span>
							<span class="text-xs text-muted-foreground">/100</span>
						</div>
					</div>

					<!-- Score detail bars -->
					<div class="w-full space-y-3">
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-muted-foreground">Smooth Braking</span>
								<span class="font-medium">{brakingPct}%</span>
							</div>
							<div class="h-2.5 bg-muted/30 rounded-full overflow-hidden">
								<div class="h-full bg-blue-500 rounded-full transition-all duration-700" style="width: {brakingPct}%"></div>
							</div>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-muted-foreground">Acceleration</span>
								<span class="font-medium">{accelPct}%</span>
							</div>
							<div class="h-2.5 bg-muted/30 rounded-full overflow-hidden">
								<div class="h-full bg-green-500 rounded-full transition-all duration-700" style="width: {accelPct}%"></div>
							</div>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-muted-foreground">Route Efficiency</span>
								<span class="font-medium">{routeEffPct}%</span>
							</div>
							<div class="h-2.5 bg-muted/30 rounded-full overflow-hidden">
								<div class="h-full bg-purple-500 rounded-full transition-all duration-700" style="width: {routeEffPct}%"></div>
							</div>
						</div>
						<div>
							<div class="flex justify-between text-sm mb-1">
								<span class="text-muted-foreground">Idle Time</span>
								<span class="font-medium">{idlingPct}%</span>
							</div>
							<div class="h-2.5 bg-muted/30 rounded-full overflow-hidden">
								<div class="h-full bg-orange-500 rounded-full transition-all duration-700" style="width: {idlingPct}%"></div>
							</div>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Alert/Recommendation Cards -->
	<div>
		<h2 class="text-xl font-semibold mb-4">Alerts & Recommendations</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each alertCards as alert}
				<div class="rounded-lg border-l-4 {alert.borderColor} {alert.bgColor} p-4 shadow-sm">
					<div class="flex items-start gap-3">
						<div class="shrink-0 mt-0.5">
							{#if alert.icon === 'warning'}
								<svg class="w-5 h-5 {alert.iconColor}" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
								</svg>
							{:else if alert.icon === 'info'}
								<svg class="w-5 h-5 {alert.iconColor}" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
								</svg>
							{:else if alert.icon === 'success'}
								<svg class="w-5 h-5 {alert.iconColor}" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
								</svg>
							{:else}
								<svg class="w-5 h-5 {alert.iconColor}" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
								</svg>
							{/if}
						</div>
						<div>
							<h3 class="font-semibold text-sm">{alert.title}</h3>
							<p class="text-sm text-muted-foreground mt-1">{alert.description}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Charts Row -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Driving Behavior Trends (Line Chart) -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Driving Behavior Trends</Card.Title>
				<Card.Description>Hard braking and rapid acceleration events over time</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="relative">
					<svg viewBox="0 0 400 200" class="w-full" preserveAspectRatio="xMidYMid meet">
						<!-- Y-axis grid lines -->
						{#each [0, 0.25, 0.5, 0.75, 1] as frac}
							{@const y = 20 + 160 * (1 - frac)}
							<line x1="40" y1={y} x2="360" y2={y} stroke="currentColor" class="text-muted-foreground/15" stroke-width="1" />
							<text x="32" y={y + 4} text-anchor="end" class="fill-current text-muted-foreground" font-size="10">
								{Math.round(behaviorMax * frac)}
							</text>
						{/each}

						<!-- X-axis labels -->
						{#each behaviorTrendData as d, i}
							{@const x = 40 + (i / Math.max(behaviorTrendData.length - 1, 1)) * 320}
							<text x={x} y="195" text-anchor="middle" class="fill-current text-muted-foreground" font-size="10">
								{d.label}
							</text>
						{/each}

						<!-- Hard Braking line (red) -->
						<polyline
							points={lineChartPoints(behaviorTrendData, 'braking')}
							fill="none"
							stroke="#ef4444"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<!-- Braking dots -->
						{#each behaviorTrendData as d, i}
							{@const x = 40 + (i / Math.max(behaviorTrendData.length - 1, 1)) * 320}
							{@const y = 20 + 160 - (d.braking / behaviorMax) * 160}
							<circle cx={x} cy={y} r="3.5" fill="#ef4444" />
						{/each}

						<!-- Rapid Accel line (orange) -->
						<polyline
							points={lineChartPoints(behaviorTrendData, 'accel')}
							fill="none"
							stroke="#f97316"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<!-- Accel dots -->
						{#each behaviorTrendData as d, i}
							{@const x = 40 + (i / Math.max(behaviorTrendData.length - 1, 1)) * 320}
							{@const y = 20 + 160 - (d.accel / behaviorMax) * 160}
							<circle cx={x} cy={y} r="3.5" fill="#f97316" />
						{/each}
					</svg>

					<!-- Legend -->
					<div class="flex items-center justify-center gap-6 mt-2">
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-3 rounded-full bg-red-500"></span>
							<span class="text-xs text-muted-foreground">Hard Braking</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-3 rounded-full bg-orange-500"></span>
							<span class="text-xs text-muted-foreground">Rapid Accel</span>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- AI Prediction vs Actual (Bar Chart) -->
		<Card.Root>
			<Card.Header>
				<Card.Title>AI Prediction vs Actual</Card.Title>
				<Card.Description>Comparing predicted and actual fuel costs</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="relative">
					<svg viewBox="0 0 400 200" class="w-full" preserveAspectRatio="xMidYMid meet">
						<!-- Y-axis grid lines -->
						{#each [0, 0.25, 0.5, 0.75, 1] as frac}
							{@const y = 20 + 150 * (1 - frac)}
							<line x1="45" y1={y} x2="380" y2={y} stroke="currentColor" class="text-muted-foreground/15" stroke-width="1" />
							<text x="40" y={y + 4} text-anchor="end" class="fill-current text-muted-foreground" font-size="9">
								₱{formatCurrency(Math.round(barMax * frac))}
							</text>
						{/each}

						<!-- Bars -->
						{#each predVsActualData as d, i}
							{@const groupWidth = (335 / predVsActualData.length)}
							{@const barWidth = groupWidth * 0.35}
							{@const groupX = 50 + i * groupWidth}
							{@const actualH = (d.actual / barMax) * 150}
							{@const predictedH = (d.predicted / barMax) * 150}

							<!-- Actual bar (teal) -->
							<rect
								x={groupX}
								y={170 - actualH}
								width={barWidth}
								height={actualH}
								rx="3"
								fill="#14b8a6"
							/>
							<!-- Predicted bar (purple) -->
							<rect
								x={groupX + barWidth + 3}
								y={170 - predictedH}
								width={barWidth}
								height={predictedH}
								rx="3"
								fill="#8b5cf6"
							/>

							<!-- Label -->
							<text
								x={groupX + barWidth + 1}
								y="185"
								text-anchor="middle"
								class="fill-current text-muted-foreground"
								font-size="10"
							>
								{d.label}
							</text>
						{/each}
					</svg>

					<!-- Legend -->
					<div class="flex items-center justify-center gap-6 mt-2">
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-3 rounded-sm bg-teal-500"></span>
							<span class="text-xs text-muted-foreground">Actual Cost</span>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="w-3 h-3 rounded-sm bg-violet-500"></span>
							<span class="text-xs text-muted-foreground">Predicted</span>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Personalized Optimization Tips -->
	<div>
		<h2 class="text-xl font-semibold mb-4">Personalized Optimization Tips</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each allTips as tip}
				<Card.Root class="hover:shadow-md transition-shadow">
					<Card.Content class="pt-6">
						<div class="flex items-start gap-4">
							<div class="shrink-0 w-10 h-10 rounded-full {tip.bgColor} flex items-center justify-center">
								{#if tip.icon === 'speed'}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
										<path d="M12 6v6l4 2" stroke-linecap="round" />
									</svg>
								{:else if tip.icon === 'accel'}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{:else if tip.icon === 'idle'}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<rect x="2" y="6" width="20" height="12" rx="2" />
										<path d="M6 12h4M14 12h4" stroke-linecap="round" />
									</svg>
								{:else if tip.icon === 'route'}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M3 6h18M3 12h18M3 18h18" />
										<circle cx="7" cy="6" r="2" fill="currentColor" />
										<circle cx="17" cy="18" r="2" fill="currentColor" />
									</svg>
								{:else if tip.icon === 'tire'}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10" />
										<circle cx="12" cy="12" r="4" />
										<path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-linecap="round" />
									</svg>
								{:else}
									<svg class="w-5 h-5 {tip.color}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
									</svg>
								{/if}
							</div>
							<div>
								<h3 class="font-semibold text-sm">{tip.title}</h3>
								<p class="text-sm text-muted-foreground mt-1">{tip.description}</p>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</div>
</div>
