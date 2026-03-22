<script lang="ts">
	import { base } from '$app/paths';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { vehiclesApi } from '$lib/api.js';
	import type { Vehicle } from '$lib/api.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const queryClient = useQueryClient();

	const vehiclesQuery = createQuery<Vehicle[]>(() => ({
		queryKey: ['vehicles'],
		queryFn: vehiclesApi.list
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: vehiclesApi.delete,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['vehicles'] });
		}
	}));

	function handleDelete(id: string, name: string) {
		if (confirm(`Delete "${name}"? This will also delete all associated fuel logs.`)) {
			deleteMutation.mutate(id);
		}
	}

	function fuelTypeLabel(type: string): string {
		return { gasoline: 'Gasoline', diesel: 'Diesel', ev: 'EV', hybrid: 'Hybrid' }[type] ?? type;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Vehicles</h1>
			<p class="text-muted-foreground">Manage your vehicles</p>
		</div>
		<Button onclick={() => (window.location.href = `${base}/vehicles/new`)}>
			{#snippet children()}Add Vehicle{/snippet}
		</Button>
	</div>

	{#if vehiclesQuery.isLoading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if !vehiclesQuery.data?.length}
		<Card.Root class="p-12 text-center">
			<Card.Content>
				<p class="text-lg text-muted-foreground mb-4">No vehicles yet.</p>
				<Button onclick={() => (window.location.href = `${base}/vehicles/new`)}>
					{#snippet children()}Add Your First Vehicle{/snippet}
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each vehiclesQuery.data ?? [] as vehicle}
				<Card.Root>
					<Card.Header>
						<div class="flex items-start justify-between">
							<div>
								<Card.Title>{vehicle.name}</Card.Title>
								<Card.Description>
									{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') ||
										'No details'}
								</Card.Description>
							</div>
							<div class="flex items-center gap-1">
								<Badge variant="outline">
									{#snippet children()}{fuelTypeLabel(vehicle.fuelType)}{/snippet}
								</Badge>
								<button
									type="button"
									class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
									onclick={() => (window.location.href = `${base}/vehicles/${vehicle.id}/edit`)}
									aria-label="Edit {vehicle.name}"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
								</button>
								<button
									type="button"
									class="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
									onclick={() => handleDelete(vehicle.id, vehicle.name)}
									aria-label="Delete {vehicle.name}"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
								</button>
							</div>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div>
								<span class="text-muted-foreground">Odometer</span>
								<p class="font-medium">
									{(vehicle.odometerKm ?? 0).toLocaleString()} km
								</p>
							</div>
							{#if vehicle.fuelType === 'ev'}
								<div>
									<span class="text-muted-foreground">Battery</span>
									<p class="font-medium">{vehicle.batteryCapacityKwh ?? '--'} kWh</p>
								</div>
							{:else}
								<div>
									<span class="text-muted-foreground">Tank</span>
									<p class="font-medium">{vehicle.tankCapacityLiters ?? '--'} L</p>
								</div>
							{/if}
						</div>
					</Card.Content>
					<Card.Footer class="gap-2 justify-end">
						<Button
							variant="outline"
							size="sm"
							onclick={() => (window.location.href = `${base}/fuel-log?vehicleId=${vehicle.id}`)}
						>
							{#snippet children()}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><path d="M3 22h12"/><path d="M7 9h4"/></svg>
								Log Fuel
							{/snippet}
						</Button>
						<Button
							size="sm"
							onclick={() => (window.location.href = `${base}/live-tracking?autostart=true`)}
						>
							{#snippet children()}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
								Start Trip
							{/snippet}
						</Button>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
