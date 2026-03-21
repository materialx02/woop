<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { vehiclesApi } from '$lib/api.js';
	import { vehicleSchema, type VehicleInput } from '$lib/validators.js';
	import type { Vehicle } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	const queryClient = useQueryClient();
	const vehicleId = $derived(page.params.id as string);

	const vehicleQuery = createQuery<Vehicle>(() => ({
		queryKey: ['vehicles', vehicleId],
		queryFn: () => vehiclesApi.get(vehicleId)
	}));

	let name = $state('');
	let make = $state('');
	let model = $state('');
	let year = $state('');
	let fuelType = $state<'gasoline' | 'diesel' | 'ev' | 'hybrid'>('gasoline');
	let tankCapacityLiters = $state('');
	let batteryCapacityKwh = $state('');
	let odometerKm = $state('');
	let errors = $state<Record<string, string>>({});
	let initialized = $state(false);

	$effect(() => {
		if (vehicleQuery.data && !initialized) {
			const v = vehicleQuery.data;
			name = v.name;
			make = v.make ?? '';
			model = v.model ?? '';
			year = v.year?.toString() ?? '';
			fuelType = v.fuelType;
			tankCapacityLiters = v.tankCapacityLiters?.toString() ?? '';
			batteryCapacityKwh = v.batteryCapacityKwh?.toString() ?? '';
			odometerKm = v.odometerKm?.toString() ?? '';
			initialized = true;
		}
	});

	const mutation = createMutation(() => ({
		mutationFn: (data: Partial<VehicleInput>) => vehiclesApi.update(vehicleId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['vehicles'] });
			goto(`${base}/vehicles`);
		}
	}));

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};

		const data = {
			name,
			make: make || undefined,
			model: model || undefined,
			year: year ? parseInt(year) : undefined,
			fuelType,
			tankCapacityLiters: tankCapacityLiters ? parseFloat(tankCapacityLiters) : undefined,
			batteryCapacityKwh: batteryCapacityKwh ? parseFloat(batteryCapacityKwh) : undefined,
			odometerKm: odometerKm ? parseFloat(odometerKm) : undefined
		};

		const result = vehicleSchema.safeParse(data);
		if (!result.success) {
			for (const issue of result.error.issues) {
				const path = issue.path.join('.');
				errors[path] = issue.message;
			}
			return;
		}

		mutation.mutate(result.data);
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit Vehicle</h1>
		<p class="text-muted-foreground">Update vehicle details</p>
	</div>

	{#if vehicleQuery.isLoading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if vehicleQuery.isError}
		<p class="text-destructive">Vehicle not found.</p>
	{:else}
		<Card.Root>
			<Card.Content class="pt-6">
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="space-y-2">
						<Label for="name">Vehicle Name *</Label>
						<Input id="name" bind:value={name} />
						{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
					</div>

					<div class="grid grid-cols-3 gap-4">
						<div class="space-y-2">
							<Label for="make">Make</Label>
							<Input id="make" bind:value={make} />
						</div>
						<div class="space-y-2">
							<Label for="model">Model</Label>
							<Input id="model" bind:value={model} />
						</div>
						<div class="space-y-2">
							<Label for="year">Year</Label>
							<Input id="year" type="number" bind:value={year} />
						</div>
					</div>

					<div class="space-y-2">
						<Label for="fuelType">Fuel Type</Label>
						<select
							id="fuelType"
							bind:value={fuelType}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<option value="gasoline">Gasoline</option>
							<option value="diesel">Diesel</option>
							<option value="ev">Electric (EV)</option>
							<option value="hybrid">Hybrid</option>
						</select>
					</div>

					{#if fuelType === 'ev'}
						<div class="space-y-2">
							<Label for="battery">Battery Capacity (kWh)</Label>
							<Input id="battery" type="number" step="0.1" bind:value={batteryCapacityKwh} />
						</div>
					{:else}
						<div class="space-y-2">
							<Label for="tank">Tank Capacity (Liters)</Label>
							<Input id="tank" type="number" step="0.1" bind:value={tankCapacityLiters} />
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="odometer">Current Odometer (km)</Label>
						<Input id="odometer" type="number" step="0.1" bind:value={odometerKm} />
					</div>

					<div class="flex gap-2 pt-4">
						<Button type="submit" disabled={mutation.isPending}>
							{#snippet children()}{mutation.isPending ? 'Saving...' : 'Save Changes'}{/snippet}
						</Button>
						<Button variant="outline" type="button" onclick={() => goto(`${base}/vehicles`)}>
							{#snippet children()}Cancel{/snippet}
						</Button>
					</div>

					{#if mutation.isError}
						<p class="text-sm text-destructive">{mutation.error.message}</p>
					{/if}
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
