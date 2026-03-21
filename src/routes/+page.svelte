<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery } from '@tanstack/svelte-query';
	import {
		vehiclesApi,
		fuelLogsApi,
		tripLogsApi,
		type FuelStats,
		type DrivingScore
	} from '$lib/api.js';
	import type { Vehicle, FuelLog, TripLog } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';

	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	const fuelLogsQuery = createQuery<FuelLog[]>(() => ({
		queryKey: ['fuel-logs'],
		queryFn: () => fuelLogsApi.list()
	}));

	const tripLogsQuery = createQuery<TripLog[]>(() => ({
		queryKey: ['trip-logs'],
		queryFn: () => tripLogsApi.list()
	}));

	let activeVehicleId = $state<string | null>(null);

	const activeVehicle = $derived(
		vehiclesQuery.data?.find((v: Vehicle) => v.id === activeVehicleId) ?? vehiclesQuery.data?.[0]
	);

	const statsQuery = createQuery<FuelStats>(() => ({
		queryKey: ['fuel-stats', activeVehicle?.id],
		queryFn: () => fuelLogsApi.stats(activeVehicle!.id),
		enabled: !!activeVehicle
	}));

	const drivingScoreQuery = createQuery<DrivingScore>(() => ({
		queryKey: ['driving-score', activeVehicle?.id],
		queryFn: () => tripLogsApi.drivingScore(activeVehicle!.id),
		enabled: !!activeVehicle
	}));

	// Vehicle fuel logs (filtered, sorted newest first)
	const vehicleFuelLogs = $derived.by(() => {
		if (!fuelLogsQuery.data || !activeVehicle) return [];
		return fuelLogsQuery.data.filter((l: FuelLog) => l.vehicleId === activeVehicle.id);
	});

	// Vehicle trip logs (filtered, sorted newest first)
	const vehicleTripLogs = $derived.by(() => {
		if (!tripLogsQuery.data || !activeVehicle) return [];
		return tripLogsQuery.data.filter((t: TripLog) => t.vehicleId === activeVehicle.id);
	});

	// Combined stats from both fuel logs AND trip logs
	const tripTotalDistance = $derived(
		vehicleTripLogs.reduce((sum, t) => sum + t.distanceKm, 0)
	);
	const tripTotalFuel = $derived(
		vehicleTripLogs.reduce((sum, t) => sum + (t.fuelConsumedLiters ?? 0), 0)
	);
	const combinedTotalDistance = $derived(
		Math.max(statsQuery.data?.totalDistance ?? 0, tripTotalDistance)
	);
	const combinedAvgEfficiency = $derived.by(() => {
		// Prefer fuel log stats if available (more accurate), fallback to trip data
		if (statsQuery.data?.avgKmPerLiter) return statsQuery.data.avgKmPerLiter;
		if (tripTotalFuel > 0 && tripTotalDistance > 0) return tripTotalDistance / tripTotalFuel;
		return null;
	});
	const totalTrips = $derived(vehicleTripLogs.length);

	// Cost trend data (chronological order for chart)
	const costTrendData = $derived.by(() => {
		return [...vehicleFuelLogs].reverse().map((l) => ({
			date: l.date,
			totalCost: l.totalCost
		}));
	});

	// Efficiency data from stats
	const efficiencyData = $derived(statsQuery.data?.efficiencyData ?? []);

	// Distance per trip data (chronological, last 10)
	const distancePerTrip = $derived.by(() => {
		return [...vehicleTripLogs]
			.reverse()
			.slice(-10)
			.map((t) => ({
				date: t.date,
				distance: t.distanceKm
			}));
	});

	// Average speed data (chronological, last 10)
	const avgSpeedData = $derived.by(() => {
		return [...vehicleTripLogs]
			.reverse()
			.slice(-10)
			.map((t) => ({
				date: t.date,
				speed: t.avgSpeedKmh ?? 0
			}));
	});

	// Recent fuel logs for table (last 5, newest first)
	const recentLogs = $derived(vehicleFuelLogs.slice(0, 5));

	// Next refuel estimate based on fuel logs or trip efficiency
	const nextRefuelEstimate = $derived.by(() => {
		// Use fuel log data if available
		if (vehicleFuelLogs.length >= 2) {
			const recent = vehicleFuelLogs.slice(0, 5);
			const avgCost = recent.reduce((sum, l) => sum + l.totalCost, 0) / recent.length;
			return Math.round(avgCost);
		}
		// Fallback: estimate from trip data + default fuel price
		if (tripTotalFuel > 0 && vehicleTripLogs.length > 0) {
			const avgFuelPerTrip = tripTotalFuel / vehicleTripLogs.length;
			const pricePerLiter = 59.5; // default PHP price
			return Math.round(avgFuelPerTrip * pricePerLiter);
		}
		return null;
	});

	// Efficiency change vs last period
	const efficiencyChange = $derived.by(() => {
		const data = efficiencyData;
		if (data.length < 4) return null;
		const mid = Math.floor(data.length / 2);
		const recentAvg =
			data.slice(mid).reduce((s, d) => s + d.kmPerLiter, 0) / (data.length - mid);
		const olderAvg = data.slice(0, mid).reduce((s, d) => s + d.kmPerLiter, 0) / mid;
		if (olderAvg === 0) return null;
		return Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
	});

	function formatNumber(n: number | null | undefined, decimals = 1): string {
		if (n == null) return '--';
		return n.toFixed(decimals);
	}

	function formatCurrency(n: number | null | undefined): string {
		if (n == null) return '--';
		return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// SVG chart helpers
	function scalePoints(
		data: { x: number; y: number }[],
		width: number,
		height: number,
		padding = 20
	): { sx: number; sy: number; value: number }[] {
		if (data.length === 0) return [];
		const minY = Math.min(...data.map((d) => d.y));
		const maxY = Math.max(...data.map((d) => d.y));
		const rangeY = maxY - minY || 1;
		const usableW = width - padding * 2;
		const usableH = height - padding * 2;

		return data.map((d, i) => ({
			sx:
				padding +
				(data.length === 1 ? usableW / 2 : (i / (data.length - 1)) * usableW),
			sy: padding + usableH - ((d.y - minY) / rangeY) * usableH,
			value: d.y
		}));
	}

	function polylineStr(points: { sx: number; sy: number }[]): string {
		return points.map((p) => `${p.sx},${p.sy}`).join(' ');
	}

	function areaStr(
		points: { sx: number; sy: number }[],
		height: number,
		padding = 20
	): string {
		if (points.length === 0) return '';
		const bottomY = height - padding;
		const first = points[0];
		const last = points[points.length - 1];
		return `${first.sx},${bottomY} ${polylineStr(points)} ${last.sx},${bottomY}`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
		<p class="text-muted-foreground">Your fuel optimization overview</p>
	</div>

	{#if vehiclesQuery.isLoading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if !vehiclesQuery.data?.length}
		<Card.Root class="p-12 text-center">
			<Card.Content>
				<p class="text-lg text-muted-foreground mb-4">
					No vehicles yet. Add your first vehicle to get started.
				</p>
				<a
					href="{base}/vehicles/new"
					class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Add Vehicle
				</a>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Vehicle selector -->
		{#if (vehiclesQuery.data?.length ?? 0) > 1}
			<div class="flex gap-2 flex-wrap">
				{#each vehiclesQuery.data ?? [] as vehicle}
					<button
						class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {activeVehicle?.id ===
						vehicle.id
							? 'bg-primary text-primary-foreground'
							: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
						onclick={() => (activeVehicleId = vehicle.id)}
					>
						{vehicle.name}
					</button>
				{/each}
			</div>
		{/if}

		<!-- 4 Stat Cards -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<!-- Avg Fuel Efficiency -->
			<Card.Root class="shadow-sm">
				<Card.Content class="p-5">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm text-muted-foreground font-medium">Avg Fuel Efficiency</p>
							<p class="text-2xl font-bold mt-1">
								{formatNumber(combinedAvgEfficiency, 2)} km/L
							</p>
							{#if efficiencyChange != null}
								<p
									class="text-xs mt-1 {efficiencyChange >= 0
										? 'text-green-600 dark:text-green-400'
										: 'text-red-500 dark:text-red-400'}"
								>
									{efficiencyChange >= 0 ? '+' : ''}{efficiencyChange}% vs last period
								</p>
							{/if}
						</div>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40"
						>
							<svg
								class="h-5 w-5 text-green-600 dark:text-green-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
								/>
								<path d="M12 6v6l4 2" />
							</svg>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Total Fuel Cost -->
			<Card.Root class="shadow-sm">
				<Card.Content class="p-5">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm text-muted-foreground font-medium">Total Fuel Cost</p>
							<p class="text-2xl font-bold mt-1">
								{formatCurrency(statsQuery.data?.totalCost ?? 0)}
							</p>
							{#if totalTrips > 0}
								<p class="text-xs text-muted-foreground mt-1">{totalTrips} trips recorded</p>
							{/if}
						</div>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40"
						>
							<svg
								class="h-5 w-5 text-amber-600 dark:text-amber-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="12" y1="1" x2="12" y2="23" />
								<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
							</svg>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Total Distance -->
			<Card.Root class="shadow-sm">
				<Card.Content class="p-5">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm text-muted-foreground font-medium">Total Distance</p>
							<p class="text-2xl font-bold mt-1">
								{formatNumber(combinedTotalDistance, 1)} km
							</p>
						</div>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40"
						>
							<svg
								class="h-5 w-5 text-blue-600 dark:text-blue-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
								<circle cx="12" cy="10" r="3" />
							</svg>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Next Refuel Est. -->
			<Card.Root class="shadow-sm">
				<Card.Content class="p-5">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm text-muted-foreground font-medium">Next Refuel Est.</p>
							<p class="text-2xl font-bold mt-1">
								{nextRefuelEstimate != null ? formatCurrency(nextRefuelEstimate) : '--'}
							</p>
							<p class="text-xs text-muted-foreground mt-1">AI prediction</p>
						</div>
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40"
						>
							<svg
								class="h-5 w-5 text-orange-600 dark:text-orange-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M12 2a10 10 0 1 0 10 10H12V2z" />
								<path d="M12 2a10 10 0 0 1 10 10" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- 2 Alert Banners -->
		<div class="grid gap-4 md:grid-cols-2">
			<!-- Fuel Efficiency Alert -->
			<div class="rounded-lg border-l-4 border-green-500 bg-green-50 dark:bg-green-950/40 p-4">
				<div class="flex items-start gap-3">
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 mt-0.5"
					>
						<svg
							class="h-4 w-4 text-green-600 dark:text-green-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
							/>
							<line x1="12" y1="9" x2="12" y2="13" />
							<line x1="12" y1="17" x2="12.01" y2="17" />
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-green-800 dark:text-green-300">Fuel Efficiency Dropped</h3>
						<p class="text-sm text-green-700 dark:text-green-400 mt-1">
							{#if efficiencyChange != null && efficiencyChange < 0}
								Your fuel consumption increased by {Math.abs(efficiencyChange)}% compared to
								the previous period. Consider checking tire pressure and driving habits.
							{:else}
								Monitor your fuel consumption trends. Maintaining steady speeds and proper
								tire pressure helps optimize efficiency.
							{/if}
						</p>
					</div>
				</div>
			</div>

			<!-- Fuel Price Alert -->
			<div class="rounded-lg border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/40 p-4">
				<div class="flex items-start gap-3">
					<div
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 mt-0.5"
					>
						<svg
							class="h-4 w-4 text-orange-600 dark:text-orange-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-orange-800 dark:text-orange-300">Fuel Price Alert</h3>
						<p class="text-sm text-orange-700 dark:text-orange-400 mt-1">
							Fuel prices are expected to change next week. Consider filling up soon to save
							on your next refuel.
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Blue CTA Banner - Live Tracking -->
		<a
			href="{base}/live-tracking"
			class="block rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 p-5 text-white shadow-md hover:from-blue-700 hover:to-blue-600 transition-all"
		>
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold">Try Live Tracking</h3>
					<p class="text-blue-100 text-sm mt-1">
						Real-time motion sensors & GPS tracking for instant driving insights
					</p>
				</div>
				<svg
					class="h-6 w-6 text-white shrink-0 ml-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="5" y1="12" x2="19" y2="12" />
					<polyline points="12 5 19 12 12 19" />
				</svg>
			</div>
		</a>

		<!-- 4 Charts in 2x2 grid -->
		<div class="grid gap-6 md:grid-cols-2">
			<!-- Fuel Cost Trends (Area Chart - Blue) -->
			<Card.Root class="shadow-sm">
				<Card.Header>
					<Card.Title class="text-base">Fuel Cost Trends</Card.Title>
					<Card.Description>Total cost per refuel over time</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="h-48">
						{#if costTrendData.length > 1}
							{@const chartData = costTrendData.map((d, i) => ({ x: i, y: d.totalCost }))}
							{@const pts = scalePoints(chartData, 400, 200)}
							<svg
								viewBox="0 0 400 200"
								class="w-full h-full"
								preserveAspectRatio="none"
							>
								<defs>
									<linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stop-color="rgb(59,130,246)" stop-opacity="0.3" />
										<stop
											offset="100%"
											stop-color="rgb(59,130,246)"
											stop-opacity="0.05"
										/>
									</linearGradient>
								</defs>
								<polygon points={areaStr(pts, 200)} fill="url(#costGrad)" />
								<polyline
									points={polylineStr(pts)}
									fill="none"
									stroke="rgb(59,130,246)"
									stroke-width="2.5"
									stroke-linejoin="round"
									stroke-linecap="round"
								/>
								{#each pts as pt}
									<circle cx={pt.sx} cy={pt.sy} r="3" fill="rgb(59,130,246)" />
								{/each}
							</svg>
						{:else}
							<div
								class="flex items-center justify-center h-full text-muted-foreground text-sm"
							>
								Not enough data for chart
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Fuel Efficiency Trends (Line Chart - Green) -->
			<Card.Root class="shadow-sm">
				<Card.Header>
					<Card.Title class="text-base">Fuel Efficiency Trends</Card.Title>
					<Card.Description>km/L efficiency per fill-up</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="h-48">
						{#if efficiencyData.length > 1}
							{@const chartData = efficiencyData.map((d, i) => ({
								x: i,
								y: d.kmPerLiter
							}))}
							{@const pts = scalePoints(chartData, 400, 200)}
							<svg
								viewBox="0 0 400 200"
								class="w-full h-full"
								preserveAspectRatio="none"
							>
								<polyline
									points={polylineStr(pts)}
									fill="none"
									stroke="rgb(34,197,94)"
									stroke-width="2.5"
									stroke-linejoin="round"
									stroke-linecap="round"
								/>
								{#each pts as pt}
									<circle
										cx={pt.sx}
										cy={pt.sy}
										r="4"
										fill="var(--card)"
										stroke="rgb(34,197,94)"
										stroke-width="2.5"
									/>
								{/each}
							</svg>
						{:else}
							<div
								class="flex items-center justify-center h-full text-muted-foreground text-sm"
							>
								Not enough data for chart
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Distance Per Trip (Bar Chart - Purple) -->
			<Card.Root class="shadow-sm">
				<Card.Header>
					<Card.Title class="text-base">Distance Per Trip</Card.Title>
					<Card.Description>Kilometers traveled each trip</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="h-48">
						{#if distancePerTrip.length > 0}
							{@const maxDist = Math.max(...distancePerTrip.map((d) => d.distance), 1)}
							<div class="flex items-end gap-1 h-full">
								{#each distancePerTrip as trip}
									<div class="flex-1 flex flex-col items-center justify-end h-full">
										<div
											class="w-full rounded-t-sm bg-purple-500 min-h-[4px] transition-all"
											style="height: {(trip.distance / maxDist) * 100}%"
											title="{trip.distance.toFixed(1)} km - {formatDate(trip.date)}"
										></div>
									</div>
								{/each}
							</div>
						{:else}
							<div
								class="flex items-center justify-center h-full text-muted-foreground text-sm"
							>
								No trip data yet
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Average Speed (Line Chart - Orange) -->
			<Card.Root class="shadow-sm">
				<Card.Header>
					<Card.Title class="text-base">Average Speed</Card.Title>
					<Card.Description>Speed trends over time</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="h-48">
						{#if avgSpeedData.length > 1}
							{@const chartData = avgSpeedData.map((d, i) => ({ x: i, y: d.speed }))}
							{@const pts = scalePoints(chartData, 400, 200)}
							<svg
								viewBox="0 0 400 200"
								class="w-full h-full"
								preserveAspectRatio="none"
							>
								<polyline
									points={polylineStr(pts)}
									fill="none"
									stroke="rgb(249,115,22)"
									stroke-width="2.5"
									stroke-linejoin="round"
									stroke-linecap="round"
								/>
								{#each pts as pt}
									<circle
										cx={pt.sx}
										cy={pt.sy}
										r="4"
										fill="var(--card)"
										stroke="rgb(249,115,22)"
										stroke-width="2.5"
									/>
								{/each}
							</svg>
						{:else}
							<div
								class="flex items-center justify-center h-full text-muted-foreground text-sm"
							>
								Not enough data for chart
							</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Recent Fuel Logs Table -->
		<Card.Root class="shadow-sm">
			<Card.Header>
				<Card.Title class="text-base">Recent Fuel Logs</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if recentLogs.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b text-left">
									<th class="pb-3 pr-4 font-medium text-muted-foreground">Date</th>
									<th class="pb-3 pr-4 font-medium text-muted-foreground">Fuel Type</th>
									<th class="pb-3 pr-4 font-medium text-muted-foreground">Quantity</th>
									<th class="pb-3 pr-4 font-medium text-muted-foreground">Price/L</th>
									<th class="pb-3 pr-4 font-medium text-muted-foreground">Total Cost</th>
									<th class="pb-3 font-medium text-muted-foreground">Odometer</th>
								</tr>
							</thead>
							<tbody>
								{#each recentLogs as log}
									<tr class="border-b last:border-0">
										<td class="py-3 pr-4">{formatDate(log.date)}</td>
										<td class="py-3 pr-4 capitalize">{log.fuelBrand ?? 'Regular'}</td>
										<td class="py-3 pr-4"
											>{log.liters != null
												? `${log.liters.toFixed(2)} L`
												: '--'}</td
										>
										<td class="py-3 pr-4">{formatCurrency(log.pricePerUnit)}</td>
										<td class="py-3 pr-4 font-bold text-green-600 dark:text-green-400"
											>{formatCurrency(log.totalCost)}</td
										>
										<td class="py-3">{log.odometerKm.toLocaleString()} km</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-muted-foreground text-sm py-4 text-center">
						No fuel logs recorded yet.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
