<script lang="ts">
	import type { FuelLog } from '$lib/db.js';
	import type { FuelStats, DrivingScore } from '$lib/api.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

	interface Alert {
		type: 'info' | 'warning' | 'success';
		title: string;
		message: string;
	}

	let {
		fuelLogs = [],
		stats = null,
		drivingScore = null
	}: {
		fuelLogs: FuelLog[];
		stats: FuelStats | null;
		drivingScore: DrivingScore | null;
	} = $props();

	const alerts = $derived.by(() => {
		const result: Alert[] = [];

		// Check for no recent fuel logs
		if (fuelLogs.length > 0) {
			const lastLog = fuelLogs[0]; // Already sorted desc
			const lastDate = new Date(lastLog.date);
			const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

			if (daysSince > 14) {
				result.push({
					type: 'info',
					title: 'Missing Fuel Logs',
					message: `You haven't logged fuel in ${daysSince} days. Keeping logs consistent improves AI predictions.`
				});
			}
		}

		// Check efficiency trends
		if (stats?.efficiencyData && stats.efficiencyData.length >= 3) {
			const recent = stats.efficiencyData.slice(-3);
			const older = stats.efficiencyData.slice(-6, -3);

			if (older.length > 0) {
				const recentAvg = recent.reduce((s, d) => s + d.kmPerLiter, 0) / recent.length;
				const olderAvg = older.reduce((s, d) => s + d.kmPerLiter, 0) / older.length;
				const dropPercent = ((olderAvg - recentAvg) / olderAvg) * 100;

				if (dropPercent > 10) {
					result.push({
						type: 'warning',
						title: 'Efficiency Drop',
						message: `Your last 3 fill-ups show ${dropPercent.toFixed(0)}% lower efficiency than before. Check tire pressure, air filter, or driving habits.`
					});
				} else if (dropPercent < -5) {
					result.push({
						type: 'success',
						title: 'Efficiency Improving',
						message: `Your fuel efficiency improved by ${Math.abs(dropPercent).toFixed(0)}% recently. Keep up the good driving!`
					});
				}
			}
		}

		// Driving score alerts
		if (drivingScore?.score != null) {
			if (drivingScore.score < 50) {
				result.push({
					type: 'warning',
					title: 'Low Driving Score',
					message: `Your driving score is ${drivingScore.score}/100. Check the tips below to improve fuel efficiency.`
				});
			} else if (drivingScore.score >= 85) {
				result.push({
					type: 'success',
					title: 'Great Driving Score',
					message: `Your driving score is ${drivingScore.score}/100. Your driving habits are fuel-efficient!`
				});
			}
		}

		// No data alerts
		if (fuelLogs.length === 0) {
			result.push({
				type: 'info',
				title: 'Get Started',
				message: 'Log your first fuel fill-up to start tracking efficiency.'
			});
		}

		return result;
	});

	function badgeVariant(type: string) {
		if (type === 'warning') return 'warning' as const;
		if (type === 'success') return 'success' as const;
		return 'secondary' as const;
	}
</script>

<div class="space-y-3">
	{#if alerts.length === 0}
		<p class="text-sm text-muted-foreground text-center py-4">No alerts right now. Everything looks good!</p>
	{:else}
		{#each alerts as alert}
			<div class="flex items-start gap-3 p-3 rounded-md border">
				<Badge variant={badgeVariant(alert.type)}>
					{#snippet children()}{alert.type === 'warning' ? '!' : alert.type === 'success' ? '&#10003;' : 'i'}{/snippet}
				</Badge>
				<div>
					<p class="text-sm font-medium">{alert.title}</p>
					<p class="text-sm text-muted-foreground">{alert.message}</p>
				</div>
			</div>
		{/each}
	{/if}
</div>
