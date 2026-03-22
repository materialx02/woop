<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { vehiclesApi, fuelLogsApi } from '$lib/api.js';
	import type { FuelStats } from '$lib/api.js';
	import { fuelLogSchema, type FuelLogInput } from '$lib/validators.js';
	import type { Vehicle, FuelLog } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { goto } from '$app/navigation';

	const initialVehicleId = page.url.searchParams.get('vehicleId') ?? '';

	const queryClient = useQueryClient();

	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	let vehicleId = $state('');
	let fuelType = $state('gasoline');
	let date = $state(new Date().toISOString().split('T')[0]);
	let odometerKm = $state('');
	let liters = $state('');
	let pricePerUnit = $state('');
	let totalCost = $state('');
	let isFullTank = $state(true);
	let fuelBrand = $state('');
	let stationName = $state('');
	let notes = $state('');
	let errors = $state<Record<string, string>>({});

	// Auto-calculate total cost
	$effect(() => {
		if (liters && pricePerUnit) {
			const calc = parseFloat(liters) * parseFloat(pricePerUnit);
			if (!isNaN(calc)) totalCost = calc.toFixed(2);
		}
	});

	// Auto-select vehicle from query param or first vehicle
	$effect(() => {
		if (vehiclesQuery.data?.length && !vehicleId) {
			if (initialVehicleId && vehiclesQuery.data.some((v) => v.id === initialVehicleId)) {
				vehicleId = initialVehicleId;
			} else {
				vehicleId = vehiclesQuery.data[0].id;
			}
		}
	});

	// Sync fuel type from selected vehicle
	$effect(() => {
		if (vehicleId && vehiclesQuery.data?.length) {
			const vehicle = vehiclesQuery.data.find((v) => v.id === vehicleId);
			if (vehicle) {
				fuelType = vehicle.fuelType;
			}
		}
	});

	const hasMultipleVehicles = $derived((vehiclesQuery.data?.length ?? 0) > 1);

	const fuelLogsQuery = createQuery<FuelLog[]>(() => ({
		queryKey: ['fuel-logs', vehicleId],
		queryFn: () => fuelLogsApi.list(vehicleId || undefined),
		enabled: !!vehicleId
	}));

	const statsQuery = createQuery<FuelStats>(() => ({
		queryKey: ['fuel-stats', vehicleId],
		queryFn: () => fuelLogsApi.stats(vehicleId),
		enabled: !!vehicleId
	}));

	const createMut = createMutation(() => ({
		mutationFn: (data: FuelLogInput) => fuelLogsApi.create(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
			queryClient.invalidateQueries({ queryKey: ['fuel-stats'] });
			queryClient.invalidateQueries({ queryKey: ['vehicles'] });
			odometerKm = '';
			liters = '';
			pricePerUnit = '';
			totalCost = '';
			isFullTank = true;
			fuelBrand = '';
			stationName = '';
			notes = '';
		}
	}));

	const deleteMut = createMutation(() => ({
		mutationFn: (id: string) => fuelLogsApi.delete(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['fuel-logs'] });
			queryClient.invalidateQueries({ queryKey: ['fuel-stats'] });
		}
	}));

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};

		const data = {
			vehicleId,
			date,
			odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
			liters: liters ? parseFloat(liters) : undefined,
			pricePerUnit: parseFloat(pricePerUnit),
			totalCost: parseFloat(totalCost),
			isFullTank,
			fuelBrand: fuelBrand || undefined,
			stationName: stationName || undefined,
			notes: notes || undefined
		};

		const result = fuelLogSchema.safeParse(data);
		if (!result.success) {
			for (const issue of result.error.issues) {
				const path = issue.path.join('.');
				errors[path] = issue.message;
			}
			return;
		}

		createMut.mutate(result.data);
	}

	function formatCurrency(n: number): string {
		return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-PH', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleTimeString('en-PH', {
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function fuelTypeLabel(type: string): string {
		const map: Record<string, string> = {
			gasoline: 'Gasoline',
			diesel: 'Diesel',
			ev: 'EV',
			hybrid: 'Hybrid'
		};
		return map[type] ?? type;
	}

	function getVehicleFuelType(log: FuelLog): string {
		const vehicle = vehiclesQuery.data?.find((v) => v.id === log.vehicleId);
		return vehicle?.fuelType ?? 'gasoline';
	}

	function getVehicleName(log: FuelLog): string {
		const vehicle = vehiclesQuery.data?.find((v) => v.id === log.vehicleId);
		return vehicle?.name ?? 'Unknown';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Fuel Log</h1>
		<p class="text-muted-foreground">Track your refueling events and costs</p>
	</div>

	{#if !vehiclesQuery.data?.length && !vehiclesQuery.isLoading}
		<Card.Root class="border-dashed">
			<Card.Content class="flex flex-col items-center py-12 px-6 text-center">
				<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><path d="M7 9h4"/></svg>
				</div>
				<h3 class="font-semibold text-lg mb-1">No vehicle yet</h3>
				<p class="text-sm text-muted-foreground mb-5">You need to add a vehicle before you can log fuel refills.</p>
				<Button onclick={() => goto(`${base}/vehicles/new`)}>
					{#snippet children()}Add Your Vehicle{/snippet}
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<!-- 2-column layout -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Left column: Add Fuel Log form -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Add Fuel Log</Card.Title>
					<Card.Description>
						{#snippet children()}Enter refueling details{/snippet}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<form onsubmit={handleSubmit} class="space-y-4">
						<!-- Vehicle selector -->
						<div class="space-y-2">
							<Label for="vehicle">Vehicle</Label>
							<select
								id="vehicle"
								bind:value={vehicleId}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								{#each vehiclesQuery.data ?? [] as v}
									<option value={v.id}>{v.name} ({fuelTypeLabel(v.fuelType)})</option>
								{/each}
							</select>
						</div>

						<!-- Liters -->
						<div class="space-y-2">
							<Label for="liters">Liters</Label>
							<Input
								id="liters"
								type="number"
								step="0.001"
								placeholder="e.g. 46"
								bind:value={liters}
							/>
							{#if errors.liters}<p class="text-sm text-destructive">{errors.liters}</p>{/if}
						</div>

						<!-- Price per Unit -->
						<div class="space-y-2">
							<Label for="price">Price per Liter (&#8369;)</Label>
							<Input
								id="price"
								type="number"
								step="0.01"
								placeholder="e.g. 59.5"
								bind:value={pricePerUnit}
							/>
							{#if errors.pricePerUnit}<p class="text-sm text-destructive">{errors.pricePerUnit}</p>{/if}
						</div>

						<!-- Total Cost (auto-calculated, shown as info) -->
						{#if totalCost && parseFloat(totalCost) > 0}
							<div class="rounded-md bg-muted px-4 py-3">
								<p class="text-sm text-muted-foreground">Total Cost</p>
								<p class="text-lg font-bold">{formatCurrency(parseFloat(totalCost))}</p>
							</div>
						{/if}

						<!-- Date -->
						<div class="space-y-2">
							<Label for="date">Date</Label>
							<Input id="date" type="date" bind:value={date} />
						</div>

						<!-- Submit button -->
						<Button type="submit" class="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={createMut.isPending}>
							{#snippet children()}{createMut.isPending ? 'Saving...' : 'Add Fuel Log'}{/snippet}
						</Button>

						{#if createMut.isError}
							<p class="text-sm text-destructive">{createMut.error.message}</p>
						{/if}
						{#if createMut.isSuccess}
							<div class="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-3">
								<p class="text-sm font-medium text-green-600 dark:text-green-400">Fuel log saved successfully!</p>
								<a
									href="{base}/live-tracking"
									class="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
								>
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polygon points="5 3 19 12 5 21 5 3"></polygon>
									</svg>
									Start Trip
								</a>
							</div>
						{/if}
					</form>
				</Card.Content>
			</Card.Root>

			<!-- Right column: All Fuel Logs list -->
			<div class="space-y-4">
				<h2 class="text-xl font-semibold">All Fuel Logs</h2>

				{#if fuelLogsQuery.isLoading}
					<p class="text-muted-foreground">Loading...</p>
				{:else if !fuelLogsQuery.data?.length}
					<Card.Root class="p-8 text-center">
						<Card.Content>
							<p class="text-muted-foreground">No fuel logs yet. Add your first entry!</p>
						</Card.Content>
					</Card.Root>
				{:else}
					<div class="space-y-3">
						{#each fuelLogsQuery.data ?? [] as log}
							<Card.Root class="relative">
								<Card.Content class="p-4">
									<!-- Top row: vehicle + badge + date + delete -->
									<div class="flex items-center justify-between mb-3">
										<div class="flex items-center gap-2 flex-wrap">
											<span class="text-sm font-semibold">{getVehicleName(log)}</span>
											<Badge variant="outline" class="border-primary text-primary">
												{#snippet children()}{fuelTypeLabel(getVehicleFuelType(log))}{/snippet}
											</Badge>
											<span class="text-sm text-muted-foreground">
												{formatDate(log.date)} {formatTime(log.date)}
											</span>
										</div>
										<button
											type="button"
											class="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-muted"
											onclick={() => {
												if (confirm('Delete this fuel log?')) deleteMut.mutate(log.id);
											}}
											aria-label="Delete fuel log"
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
										</button>
									</div>

									<!-- Details row -->
									<div class="flex items-center gap-4 text-sm">
										<span class="text-foreground font-medium">
											{log.liters ? `${log.liters.toLocaleString()} L` : '--'}
										</span>
										{#if log.odometerKm}
											<span class="text-muted-foreground">
												{log.odometerKm.toLocaleString()} km
											</span>
										{/if}
									</div>

									<!-- Price row -->
									<div class="flex items-center gap-4 text-sm mt-1">
										<span class="text-muted-foreground">
											{formatCurrency(log.pricePerUnit)}/L
										</span>
										<span class="font-semibold text-foreground">
											{formatCurrency(log.totalCost)}
										</span>
									</div>
								</Card.Content>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Summary Statistics bar -->
		{#if statsQuery.data}
			<div class="bg-primary text-primary-foreground rounded-lg p-6">
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="text-center">
						<p class="text-sm opacity-80">Total Logs</p>
						<p class="text-2xl font-bold">{statsQuery.data.totalLogs}</p>
					</div>
					<div class="text-center">
						<p class="text-sm opacity-80">Total Fuel</p>
						<p class="text-2xl font-bold">{statsQuery.data.totalLiters.toLocaleString()} L</p>
					</div>
					<div class="text-center">
						<p class="text-sm opacity-80">Total Cost</p>
						<p class="text-2xl font-bold">{formatCurrency(statsQuery.data.totalCost)}</p>
					</div>
					<div class="text-center">
						<p class="text-sm opacity-80">Avg Price</p>
						<p class="text-2xl font-bold">
							{statsQuery.data.totalLiters > 0
								? formatCurrency(statsQuery.data.totalCost / statsQuery.data.totalLiters)
								: '--'}
							{#if statsQuery.data.totalLiters > 0}<span class="text-sm font-normal opacity-80">/L</span>{/if}
						</p>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
