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
							<Badge variant="outline">
								{#snippet children()}{fuelTypeLabel(vehicle.fuelType)}{/snippet}
							</Badge>
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
					<Card.Footer class="gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => (window.location.href = `${base}/vehicles/${vehicle.id}/edit`)}
						>
							{#snippet children()}Edit{/snippet}
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onclick={() => handleDelete(vehicle.id, vehicle.name)}
						>
							{#snippet children()}Delete{/snippet}
						</Button>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
