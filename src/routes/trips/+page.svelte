<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { vehiclesApi, tripLogsApi } from '$lib/api.js';
	import { tripLogSchema, type TripLogInput } from '$lib/validators.js';
	import type { Vehicle, TripLog } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { goto } from '$app/navigation';

	const queryClient = useQueryClient();

	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	let vehicleId = $state('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let startOdometer = $state('');
	let endOdometer = $state('');
	let fuelConsumedLiters = $state('');
	let durationMinutes = $state('');
	let errors = $state<Record<string, string>>({});

	// Auto-select first vehicle
	$effect(() => {
		if (vehiclesQuery.data?.length && !vehicleId) {
			vehicleId = vehiclesQuery.data[0].id;
		}
	});

	// Computed distance from odometer readings
	const computedDistanceKm = $derived(() => {
		const s = parseFloat(startOdometer);
		const e = parseFloat(endOdometer);
		if (s > 0 && e > s) return e - s;
		return 0;
	});

	const tripLogsQuery = createQuery<TripLog[]>(() => ({
		queryKey: ['trip-logs', vehicleId],
		queryFn: () => tripLogsApi.list(vehicleId || undefined),
		enabled: !!vehicleId
	}));

	const createMut = createMutation(() => ({
		mutationFn: (data: TripLogInput) => tripLogsApi.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trip-logs'] });
			queryClient.invalidateQueries({ queryKey: ['driving-score'] });
			startOdometer = '';
			endOdometer = '';
			fuelConsumedLiters = '';
			durationMinutes = '';
		}
	}));

	const deleteMut = createMutation(() => ({
		mutationFn: (id: string) => tripLogsApi.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trip-logs'] });
			queryClient.invalidateQueries({ queryKey: ['driving-score'] });
		}
	}));

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};

		const distance = computedDistanceKm();
		if (distance <= 0) {
			errors['distanceKm'] = 'End odometer must be greater than start odometer';
			return;
		}

		const dur = durationMinutes ? parseFloat(durationMinutes) : undefined;
		const avgSpeed = dur && dur > 0 ? parseFloat(((distance / dur) * 60).toFixed(1)) : undefined;

		const data = {
			vehicleId,
			date,
			distanceKm: distance,
			durationMinutes: dur,
			avgSpeedKmh: avgSpeed,
			hardBrakingCount: 0,
			rapidAccelCount: 0,
			idleMinutes: 0,
			fuelConsumedLiters: fuelConsumedLiters ? parseFloat(fuelConsumedLiters) : undefined,
			tripType: 'manual' as const,
			notes: startOdometer && endOdometer ? `Odometer: ${formatNumber(parseFloat(startOdometer))} → ${formatNumber(parseFloat(endOdometer))} km` : undefined
		};

		const result = tripLogSchema.safeParse(data);
		if (!result.success) {
			for (const issue of result.error.issues) {
				const path = issue.path.join('.');
				errors[path] = issue.message;
			}
			return;
		}

		createMut.mutate(result.data);
	}

	function getEfficiency(trip: TripLog): number | null {
		if (trip.fuelConsumedLiters && trip.fuelConsumedLiters > 0) {
			return trip.distanceKm / trip.fuelConsumedLiters;
		}
		return null;
	}

	function getEfficiencyColor(kmPerLiter: number): { bg: string; text: string; label: string } {
		if (kmPerLiter > 12) return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Good' };
		if (kmPerLiter >= 8) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Moderate' };
		return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Poor' };
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		if (d.getHours() === 0 && d.getMinutes() === 0) return '';
		return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
	}

	function formatNumber(n: number): string {
		return n.toLocaleString('en-PH');
	}

	function parseOdometerFromNotes(notes?: string): { start: number; end: number } | null {
		if (!notes) return null;
		const match = notes.match(/Odometer:\s*([\d,]+(?:\.\d+)?)\s*→\s*([\d,]+(?:\.\d+)?)\s*km/);
		if (match) {
			return {
				start: parseFloat(match[1].replace(/,/g, '')),
				end: parseFloat(match[2].replace(/,/g, ''))
			};
		}
		return null;
	}

	// Summary statistics
	const totalTrips = $derived(tripLogsQuery.data?.length ?? 0);
	const totalDistance = $derived(
		(tripLogsQuery.data ?? []).reduce((sum, t) => sum + t.distanceKm, 0)
	);
	const totalFuel = $derived(
		(tripLogsQuery.data ?? []).reduce((sum, t) => sum + (t.fuelConsumedLiters ?? 0), 0)
	);
	const avgEfficiency = $derived(
		totalFuel > 0 ? totalDistance / totalFuel : 0
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Trip Tracking</h1>
		<p class="text-muted-foreground">Monitor your driving habits and fuel efficiency</p>
	</div>

	{#if !vehiclesQuery.data?.length && !vehiclesQuery.isLoading}
		<Card.Root class="p-12 text-center">
			<Card.Content>
				<p class="text-lg text-muted-foreground mb-4">Add a vehicle first before logging trips.</p>
				<Button onclick={() => goto('/vehicles/new')} class="bg-violet-500 hover:bg-violet-600 text-white">
					{#snippet children()}Add Vehicle{/snippet}
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 2-column layout -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Left column: Add Trip form -->
			<Card.Root class="border-violet-200 dark:border-violet-800/40">
				<Card.Header>
					<Card.Title class="text-xl font-semibold">Add Trip</Card.Title>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleSubmit} class="space-y-4">
						{#if (vehiclesQuery.data?.length ?? 0) > 1}
							<div class="space-y-2">
								<Label for="vehicle">Vehicle</Label>
								<select
									id="vehicle"
									bind:value={vehicleId}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
								>
									{#each vehiclesQuery.data ?? [] as v}
										<option value={v.id}>{v.name}</option>
									{/each}
								</select>
							</div>
						{/if}

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="startOdo">Start Odometer (km)</Label>
								<Input id="startOdo" type="number" step="0.1" min="0" placeholder="e.g. 16,300" bind:value={startOdometer} />
							</div>
							<div class="space-y-2">
								<Label for="endOdo">End Odometer (km)</Label>
								<Input id="endOdo" type="number" step="0.1" min="0" placeholder="e.g. 17,020" bind:value={endOdometer} />
							</div>
						</div>
						{#if errors.distanceKm}
							<p class="text-sm text-destructive">{errors.distanceKm}</p>
						{/if}
						{#if computedDistanceKm() > 0}
							<p class="text-sm text-violet-600 dark:text-violet-400 font-medium">
								Distance: {formatNumber(computedDistanceKm())} km
							</p>
						{/if}

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<Label for="fuel">Fuel Used (Liters)</Label>
								<Input id="fuel" type="number" step="0.01" min="0" placeholder="e.g. 45.5" bind:value={fuelConsumedLiters} />
								{#if errors.fuelConsumedLiters}<p class="text-sm text-destructive">{errors.fuelConsumedLiters}</p>{/if}
							</div>
							<div class="space-y-2">
								<Label for="duration">Duration (minutes)</Label>
								<Input id="duration" type="number" step="1" min="0" placeholder="e.g. 90" bind:value={durationMinutes} />
							</div>
						</div>

						<div class="space-y-2">
							<Label for="date">Date & Time</Label>
							<Input id="date" type="date" bind:value={date} />
						</div>

						<Button
							type="submit"
							class="w-full text-white font-medium"
							style="background-color: #8B5CF6;"
							disabled={createMut.isPending}
						>
							{#snippet children()}{createMut.isPending ? 'Saving...' : 'Add Trip'}{/snippet}
						</Button>

						{#if createMut.isError}
							<p class="text-sm text-destructive">{createMut.error.message}</p>
						{/if}
						{#if createMut.isSuccess}
							<p class="text-sm text-green-600 dark:text-green-400">Trip added successfully!</p>
						{/if}
					</form>
				</Card.Content>
			</Card.Root>

			<!-- Right column: All Trips list -->
			<div class="space-y-4">
				<h2 class="text-xl font-semibold">All Trips</h2>

				{#if tripLogsQuery.isLoading}
					<Card.Root class="p-6">
						<p class="text-muted-foreground">Loading trips...</p>
					</Card.Root>
				{:else if !tripLogsQuery.data?.length}
					<Card.Root class="p-6">
						<p class="text-muted-foreground">No trips logged yet. Add your first trip to get started.</p>
					</Card.Root>
				{:else}
					<div class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
						{#each tripLogsQuery.data ?? [] as trip}
							{@const eff = getEfficiency(trip)}
							{@const odo = parseOdometerFromNotes(trip.notes)}
							<Card.Root class="border shadow-sm hover:shadow-md transition-shadow">
								<Card.Content class="p-4">
									<div class="flex items-start justify-between">
										<div class="flex-1 space-y-2">
											<!-- Date & time -->
											<div class="flex items-center gap-2">
												<p class="font-semibold text-sm">{formatDate(trip.date)}</p>
												{#if formatTime(trip.date)}
													<span class="text-xs text-muted-foreground">{formatTime(trip.date)}</span>
												{/if}
											</div>

											<!-- Trip details -->
											<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
												<span>{trip.distanceKm.toFixed(1)} km</span>
												{#if trip.fuelConsumedLiters}
													<span class="text-muted-foreground/50">|</span>
													<span>{trip.fuelConsumedLiters.toFixed(1)} L</span>
												{/if}
												{#if trip.durationMinutes}
													<span class="text-muted-foreground/50">|</span>
													<span>{trip.durationMinutes.toFixed(0)} min</span>
												{/if}
											</div>

											<!-- Odometer range -->
											{#if odo}
												<p class="text-xs text-muted-foreground">
													{formatNumber(odo.start)} → {formatNumber(odo.end)} km
												</p>
											{/if}
										</div>

										<div class="flex items-center gap-2 ml-3">
											<!-- Efficiency badge -->
											{#if eff !== null}
												{@const effColor = getEfficiencyColor(eff)}
												<Badge class="{effColor.bg} {effColor.text} border-0 text-xs whitespace-nowrap">
													{#snippet children()}{eff.toFixed(1)} km/L · {effColor.label}{/snippet}
												</Badge>
											{/if}

											<!-- Delete button -->
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
												onclick={() => {
													if (confirm('Delete this trip?')) deleteMut.mutate(trip.id);
												}}
											>
												{#snippet children()}
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
												{/snippet}
											</Button>
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Summary Statistics bar -->
		{#if totalTrips > 0}
			<div class="rounded-xl p-6 text-white" style="background: linear-gradient(135deg, #8B5CF6, #7C3AED);">
				<div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
					<div>
						<p class="text-sm text-white/70 font-medium">Total Trips</p>
						<p class="text-3xl font-bold mt-1">{totalTrips}</p>
					</div>
					<div>
						<p class="text-sm text-white/70 font-medium">Total Distance</p>
						<p class="text-3xl font-bold mt-1">{formatNumber(Math.round(totalDistance))} <span class="text-lg font-normal">km</span></p>
					</div>
					<div>
						<p class="text-sm text-white/70 font-medium">Total Fuel</p>
						<p class="text-3xl font-bold mt-1">{totalFuel.toFixed(1)} <span class="text-lg font-normal">L</span></p>
					</div>
					<div>
						<p class="text-sm text-white/70 font-medium">Avg Efficiency</p>
						<p class="text-3xl font-bold mt-1">
							{#if avgEfficiency > 0}
								{avgEfficiency.toFixed(1)} <span class="text-lg font-normal">km/L</span>
							{:else}
								-- <span class="text-lg font-normal">km/L</span>
							{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
