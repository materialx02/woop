<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { vehiclesApi, tripLogsApi, type DrivingScore } from '$lib/api.js';
	import type { Vehicle, TripLog } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { getFuelPricePerLiter } from '$lib/utils.js';

	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	const tripLogsQuery = createQuery<TripLog[]>(() => ({
		queryKey: ['trip-logs'],
		queryFn: () => tripLogsApi.list()
	}));

	// Fetch driving score per vehicle
	const allScores = $derived.by(() => {
		if (!vehiclesQuery.data?.length) return new Map<string, DrivingScore>();
		return new Map<string, DrivingScore>();
	});

	// We'll compute scores inline from trip data since drivingScore API is per-vehicle
	// Build a map of vehicleId -> aggregated stats
	const vehicleStats = $derived.by(() => {
		const trips = tripLogsQuery.data ?? [];
		const vehicles = vehiclesQuery.data ?? [];
		const map = new Map<string, {
			vehicle: Vehicle;
			trips: TripLog[];
			totalBraking: number;
			totalAccel: number;
			totalIdle: number;
			totalEvents: number;
			totalDistance: number;
			totalDuration: number;
		}>();

		for (const v of vehicles) {
			map.set(v.id, {
				vehicle: v,
				trips: [],
				totalBraking: 0,
				totalAccel: 0,
				totalIdle: 0,
				totalEvents: 0,
				totalDistance: 0,
				totalDuration: 0
			});
		}

		for (const t of trips) {
			const entry = map.get(t.vehicleId);
			if (entry) {
				entry.trips.push(t);
				entry.totalBraking += t.hardBrakingCount;
				entry.totalAccel += t.rapidAccelCount;
				entry.totalIdle += t.idleMinutes;
				entry.totalEvents += t.hardBrakingCount + t.rapidAccelCount;
				entry.totalDistance += t.distanceKm;
				entry.totalDuration += t.durationMinutes ?? 0;
			}
		}

		return map;
	});

	// Per-trip rows sorted newest first
	const tripRows = $derived.by(() => {
		const trips = tripLogsQuery.data ?? [];
		const vehicles = vehiclesQuery.data ?? [];
		const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

		return trips.map((t) => {
			const vehicle = vehicleMap.get(t.vehicleId);
			return {
				...t,
				vehicle,
				totalEvents: t.hardBrakingCount + t.rapidAccelCount,
				score: tripScore(t),
				savings: tripSavings(t, vehicle)
			};
		});
	});

	// Compute a simple driving score from trip data (same formula as API)
	function computeScore(trips: TripLog[]): number | null {
		const recent = [...trips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
		if (recent.length === 0) return null;

		let totalBraking = 0;
		let totalAccel = 0;
		let totalIdleMinutes = 0;
		let totalDurationMinutes = 0;
		let highSpeedTrips = 0;

		for (const trip of recent) {
			totalBraking += trip.hardBrakingCount;
			totalAccel += trip.rapidAccelCount;
			totalIdleMinutes += trip.idleMinutes;
			totalDurationMinutes += trip.durationMinutes ?? 0;
			if ((trip.maxSpeedKmh ?? 0) > 120) highSpeedTrips++;
		}

		const n = recent.length;
		const avgBraking = totalBraking / n;
		const avgAccel = totalAccel / n;
		const idleRatio = totalDurationMinutes > 0 ? totalIdleMinutes / totalDurationMinutes : 0;
		const highSpeedRatio = highSpeedTrips / n;

		const brakingScore = Math.max(0, 25 - avgBraking * 5);
		const accelScore = Math.max(0, 25 - avgAccel * 5);
		const idleScore = Math.max(0, 25 - idleRatio * 100);
		const speedScore = Math.max(0, 25 - highSpeedRatio * 50);

		return Math.round(brakingScore + accelScore + idleScore + speedScore);
	}

	// Per-trip driving score
	function tripScore(trip: TripLog): number {
		const duration = trip.durationMinutes ?? 0;
		const idleRatio = duration > 0 ? trip.idleMinutes / duration : 0;
		const highSpeed = (trip.maxSpeedKmh ?? 0) > 120 ? 1 : 0;

		const brakingScore = Math.max(0, 25 - trip.hardBrakingCount * 5);
		const accelScore = Math.max(0, 25 - trip.rapidAccelCount * 5);
		const idleScore = Math.max(0, 25 - idleRatio * 100);
		const speedScore = Math.max(0, 25 - highSpeed * 50);

		return Math.round(brakingScore + accelScore + idleScore + speedScore);
	}

	// Estimated fuel savings compared to an average driver (score 50)
	const BASE_EFFICIENCY: Record<string, number> = {
		gasoline: 12, diesel: 14, hybrid: 18, ev: 6
	};

	function tripSavings(trip: TripLog, vehicle: Vehicle | undefined): number {
		if (!vehicle || trip.distanceKm < 0.01) return 0;
		const baseEff = BASE_EFFICIENCY[vehicle.fuelType] ?? 12;
		const score = tripScore(trip);
		// Score 50 = baseline, score 100 = +15% efficiency, score 0 = -15%
		const adjustment = ((score - 50) / 100) * 0.3;
		const thisEff = baseEff * (1 + adjustment);
		const baselineFuel = trip.distanceKm / baseEff;
		const thisFuel = trip.distanceKm / thisEff;
		const price = getFuelPricePerLiter();
		return (baselineFuel - thisFuel) * price;
	}

	// Global driving score across all trips
	const globalScore = $derived(computeScore(tripLogsQuery.data ?? []));

	// Global totals
	const globalTotals = $derived.by(() => {
		const trips = tripLogsQuery.data ?? [];
		return {
			totalTrips: trips.length,
			totalBraking: trips.reduce((sum, t) => sum + t.hardBrakingCount, 0),
			totalAccel: trips.reduce((sum, t) => sum + t.rapidAccelCount, 0),
			totalIdle: trips.reduce((sum, t) => sum + t.idleMinutes, 0),
			totalEvents: trips.reduce((sum, t) => sum + t.hardBrakingCount + t.rapidAccelCount, 0)
		};
	});

	let sortField = $state<'date' | 'score' | 'events' | 'braking' | 'accel' | 'idle' | 'savings'>('date');
	let sortDir = $state<'asc' | 'desc'>('desc');

	function toggleSort(field: typeof sortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'desc';
		}
	}

	const sortedRows = $derived.by(() => {
		const rows = [...tripRows];
		const dir = sortDir === 'asc' ? 1 : -1;
		rows.sort((a, b) => {
			switch (sortField) {
				case 'date':
					return dir * a.date.localeCompare(b.date);
				case 'score':
					return dir * (a.score - b.score);
				case 'events':
					return dir * (a.totalEvents - b.totalEvents);
				case 'braking':
					return dir * (a.hardBrakingCount - b.hardBrakingCount);
				case 'accel':
					return dir * (a.rapidAccelCount - b.rapidAccelCount);
				case 'idle':
					return dir * (a.idleMinutes - b.idleMinutes);
				case 'savings':
					return dir * (a.savings - b.savings);
				default:
					return dir * a.date.localeCompare(b.date);
			}
		});
		return rows;
	});

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
	}

	function scoreColor(score: number | null): string {
		if (score == null) return 'text-muted-foreground';
		if (score >= 75) return 'text-green-600 dark:text-green-400';
		if (score >= 50) return 'text-amber-600 dark:text-amber-400';
		return 'text-red-600 dark:text-red-400';
	}

	function scoreBadge(score: number | null): 'default' | 'secondary' | 'destructive' | 'outline' {
		if (score == null) return 'outline';
		if (score >= 75) return 'default';
		if (score >= 50) return 'secondary';
		return 'destructive';
	}

	function formatCurrency(n: number): string {
		return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
	}

	function savingsColor(savings: number): string {
		if (savings > 0.5) return 'text-green-600 dark:text-green-400';
		if (savings < -0.5) return 'text-red-600 dark:text-red-400';
		return 'text-muted-foreground';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Trips</h1>
		<p class="text-muted-foreground">Driving events and trip history</p>
	</div>

	<!-- Global Summary Cards -->
	<div class="grid gap-4 grid-cols-2 md:grid-cols-5">
		<Card.Root class="shadow-sm">
			<Card.Content class="p-4 text-center">
				<p class="text-xs text-muted-foreground font-medium">Driving Score</p>
				<p class="text-3xl font-bold mt-1 {scoreColor(globalScore)}">
					{globalScore ?? '--'}
				</p>
			</Card.Content>
		</Card.Root>
		<Card.Root class="shadow-sm">
			<Card.Content class="p-4 text-center">
				<p class="text-xs text-muted-foreground font-medium">Total Events</p>
				<p class="text-3xl font-bold mt-1">{globalTotals.totalEvents}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root class="shadow-sm">
			<Card.Content class="p-4 text-center">
				<p class="text-xs text-muted-foreground font-medium">Hard Braking</p>
				<p class="text-3xl font-bold mt-1 text-orange-600 dark:text-orange-400">{globalTotals.totalBraking}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root class="shadow-sm">
			<Card.Content class="p-4 text-center">
				<p class="text-xs text-muted-foreground font-medium">Rapid Accel</p>
				<p class="text-3xl font-bold mt-1 text-amber-600 dark:text-amber-400">{globalTotals.totalAccel}</p>
			</Card.Content>
		</Card.Root>
		<Card.Root class="shadow-sm col-span-2 md:col-span-1">
			<Card.Content class="p-4 text-center">
				<p class="text-xs text-muted-foreground font-medium">Idle Time</p>
				<p class="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">{globalTotals.totalIdle}<span class="text-sm font-normal text-muted-foreground"> min</span></p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Per-Vehicle Summary -->
	{#if (vehiclesQuery.data?.length ?? 0) > 1}
		<div>
			<h2 class="text-lg font-semibold mb-3">By Vehicle</h2>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each vehiclesQuery.data ?? [] as vehicle}
					{@const stats = vehicleStats.get(vehicle.id)}
					{@const score = stats ? computeScore(stats.trips) : null}
					<Card.Root class="shadow-sm">
						<Card.Content class="p-4">
							<div class="flex items-center justify-between mb-3">
								<div>
									<p class="font-semibold">{vehicle.name}</p>
									<p class="text-xs text-muted-foreground">{stats?.trips.length ?? 0} trips</p>
								</div>
								<span class="text-2xl font-bold {scoreColor(score)}">
									{score ?? '--'}<span class="text-sm font-normal text-muted-foreground">/100</span>
								</span>
							</div>
							<div class="grid grid-cols-4 gap-2 text-center text-xs">
								<div>
									<p class="text-muted-foreground">Events</p>
									<p class="font-semibold text-sm">{stats?.totalEvents ?? 0}</p>
								</div>
								<div>
									<p class="text-muted-foreground">Braking</p>
									<p class="font-semibold text-sm text-orange-600 dark:text-orange-400">{stats?.totalBraking ?? 0}</p>
								</div>
								<div>
									<p class="text-muted-foreground">Accel</p>
									<p class="font-semibold text-sm text-amber-600 dark:text-amber-400">{stats?.totalAccel ?? 0}</p>
								</div>
								<div>
									<p class="text-muted-foreground">Idle</p>
									<p class="font-semibold text-sm text-blue-600 dark:text-blue-400">{stats?.totalIdle ?? 0}m</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Trip Log -->
	{#if tripLogsQuery.isLoading}
		<p class="text-muted-foreground p-6">Loading...</p>
	{:else if !sortedRows.length}
		<Card.Root class="shadow-sm">
			<Card.Content class="p-12 text-center">
				<p class="text-lg text-muted-foreground mb-1">No trips yet</p>
				<p class="text-sm text-muted-foreground">Start a live tracking session to record trips.</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- Mobile: Sort selector -->
		<div class="flex items-center gap-2 md:hidden">
			<span class="text-xs text-muted-foreground">Sort by</span>
			<select
				bind:value={sortField}
				class="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<option value="date">Date</option>
				<option value="score">Score</option>
				<option value="events">Events</option>
				<option value="savings">Est. Savings</option>
				<option value="braking">Braking</option>
				<option value="accel">Accel</option>
				<option value="idle">Idle</option>
			</select>
			<button
				type="button"
				class="flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors"
				onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
				aria-label="Toggle sort direction"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
				</svg>
			</button>
		</div>

		<!-- Mobile: Card list -->
		<div class="space-y-3 md:hidden">
			{#each sortedRows as row}
				<Card.Root class="shadow-sm">
					<Card.Content class="p-4">
						<!-- Header: vehicle, type badge, score -->
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<span class="font-semibold text-sm">{row.vehicle?.name ?? 'Unknown'}</span>
								<Badge variant="outline">
									{#snippet children()}{row.tripType}{/snippet}
								</Badge>
							</div>
							<div class="text-right">
								<span class="font-bold text-lg {scoreColor(row.score)}">{row.score}</span>
								<span class="text-xs text-muted-foreground">/100</span>
							</div>
						</div>

						<!-- Date + distance -->
						<div class="flex items-center gap-2 text-xs text-muted-foreground mb-3">
							<span>{formatDate(row.date)} {formatTime(row.date)}</span>
							<span>&middot;</span>
							<span>{row.distanceKm.toFixed(1)} km</span>
						</div>

						<!-- Stats grid -->
						<div class="grid grid-cols-4 gap-2 text-center text-xs mb-3">
							<div class="rounded-md bg-muted/50 py-1.5">
								<p class="text-muted-foreground">Events</p>
								<p class="font-semibold text-sm {row.totalEvents > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">{row.totalEvents}</p>
							</div>
							<div class="rounded-md bg-muted/50 py-1.5">
								<p class="text-muted-foreground">Braking</p>
								<p class="font-semibold text-sm {row.hardBrakingCount > 0 ? 'text-orange-600 dark:text-orange-400' : ''}">{row.hardBrakingCount}</p>
							</div>
							<div class="rounded-md bg-muted/50 py-1.5">
								<p class="text-muted-foreground">Accel</p>
								<p class="font-semibold text-sm {row.rapidAccelCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}">{row.rapidAccelCount}</p>
							</div>
							<div class="rounded-md bg-muted/50 py-1.5">
								<p class="text-muted-foreground">Idle</p>
								<p class="font-semibold text-sm text-blue-600 dark:text-blue-400">{row.idleMinutes}m</p>
							</div>
						</div>

						<!-- Savings -->
						<div class="flex items-center justify-between pt-2 border-t">
							<span class="text-xs text-muted-foreground">Est. Fuel Savings</span>
							<span class="font-semibold text-sm {savingsColor(row.savings)}">
								{row.savings >= 0 ? '+' : ''}{formatCurrency(row.savings)}
							</span>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<!-- Desktop: Table -->
		<Card.Root class="shadow-sm hidden md:block">
			<Card.Content class="p-0">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="text-left px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 hover:text-foreground transition-colors" onclick={() => toggleSort('date')}>
										Date
										{#if sortField === 'date'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-left px-4 py-3 font-medium">Vehicle</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('events')}>
										Events
										{#if sortField === 'events'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('braking')}>
										Braking
										{#if sortField === 'braking'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('accel')}>
										Accel
										{#if sortField === 'accel'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('idle')}>
										Idle
										{#if sortField === 'idle'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-center px-4 py-3 font-medium">Distance</th>
								<th class="text-center px-4 py-3 font-medium">Type</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('score')}>
										Score
										{#if sortField === 'score'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
								<th class="text-center px-4 py-3 font-medium">
									<button type="button" class="flex items-center gap-1 mx-auto hover:text-foreground transition-colors" onclick={() => toggleSort('savings')}>
										Est. Savings
										{#if sortField === 'savings'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
												{#if sortDir === 'desc'}<path d="m6 9 6 6 6-6"/>{:else}<path d="m18 15-6-6-6 6"/>{/if}
											</svg>
										{/if}
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedRows as row}
								<tr class="border-b last:border-0 hover:bg-muted/30 transition-colors">
									<td class="px-4 py-3">
										<p class="font-medium">{formatDate(row.date)}</p>
										<p class="text-xs text-muted-foreground">{formatTime(row.date)}</p>
									</td>
									<td class="px-4 py-3">
										<p class="font-medium">{row.vehicle?.name ?? 'Unknown'}</p>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-semibold {row.totalEvents > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">
											{row.totalEvents}
										</span>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-medium {row.hardBrakingCount > 0 ? 'text-orange-600 dark:text-orange-400' : ''}">
											{row.hardBrakingCount}
										</span>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-medium {row.rapidAccelCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''}">
											{row.rapidAccelCount}
										</span>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-medium">{row.idleMinutes} min</span>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-medium">{row.distanceKm.toFixed(1)} km</span>
									</td>
									<td class="px-4 py-3 text-center">
										<Badge variant="outline">
											{#snippet children()}{row.tripType}{/snippet}
										</Badge>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-bold {scoreColor(row.score)}">{row.score}</span>
										<span class="text-xs text-muted-foreground">/100</span>
									</td>
									<td class="px-4 py-3 text-center">
										<span class="font-medium {savingsColor(row.savings)}">
											{row.savings >= 0 ? '+' : ''}{formatCurrency(row.savings)}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
