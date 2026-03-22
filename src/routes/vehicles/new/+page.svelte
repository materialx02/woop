<script lang="ts">
	import { base } from '$app/paths';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { vehiclesApi } from '$lib/api.js';
	import { vehicleSchema, type VehicleInput } from '$lib/validators.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { goto } from '$app/navigation';

	const queryClient = useQueryClient();

	let name = $state('');
	let make = $state('');
	let model = $state('');
	let year = $state('');
	let fuelType = $state<'gasoline' | 'diesel' | 'ev' | 'hybrid'>('gasoline');
	let tankCapacityLiters = $state('');
	let batteryCapacityKwh = $state('');
	let odometerKm = $state('');
	let fuelPricePerLiter = $state('');
	let errors = $state<Record<string, string>>({});

	// Check if this is the first vehicle (show fuel price field)
	let isFirstVehicle = $state(true);
	vehiclesApi.list().then((v) => {
		isFirstVehicle = v.length === 0;
	});

	const mutation = createMutation(() => ({
		mutationFn: (data: VehicleInput) => vehiclesApi.create(data),
		onSuccess: () => {
			// Save fuel price to settings if provided
			if (fuelPricePerLiter) {
				const price = parseFloat(fuelPricePerLiter);
				if (!isNaN(price) && price > 0) {
					try {
						const raw = localStorage.getItem('fuelwise-settings');
						const settings = raw ? JSON.parse(raw) : {};
						settings.fuelPricePerLiter = price;
						localStorage.setItem('fuelwise-settings', JSON.stringify(settings));
					} catch { /* ignore */ }
				}
			}
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
		<h1 class="text-3xl font-bold tracking-tight">Add Vehicle</h1>
		<p class="text-muted-foreground">Register a new vehicle to track</p>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Vehicle Name *</Label>
					<Input id="name" placeholder="e.g. My Civic" bind:value={name} />
					{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
				</div>

				<div class="grid grid-cols-3 gap-4">
					<div class="space-y-2">
						<Label for="make">Make</Label>
						<Input id="make" placeholder="Honda" bind:value={make} />
					</div>
					<div class="space-y-2">
						<Label for="model">Model</Label>
						<Input id="model" placeholder="Civic" bind:value={model} />
					</div>
					<div class="space-y-2">
						<Label for="year">Year</Label>
						<Input id="year" type="number" placeholder="2024" bind:value={year} />
						{#if errors.year}<p class="text-sm text-destructive">{errors.year}</p>{/if}
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
					<Input id="odometer" type="number" step="0.1" placeholder="0" bind:value={odometerKm} />
				</div>

				{#if isFirstVehicle && fuelType !== 'ev'}
					<div class="space-y-2">
						<Label for="fuelPrice">Current Fuel Price per Liter (&#8369;)</Label>
						<Input id="fuelPrice" type="number" step="0.01" placeholder="e.g. 59.50" bind:value={fuelPricePerLiter} />
						<p class="text-xs text-muted-foreground">Helps estimate trip fuel costs. You can update it anytime in Settings.</p>
					</div>
				{/if}

				<div class="flex gap-2 pt-4">
					<Button type="submit" disabled={mutation.isPending}>
						{#snippet children()}{mutation.isPending ? 'Saving...' : 'Add Vehicle'}{/snippet}
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
</div>
