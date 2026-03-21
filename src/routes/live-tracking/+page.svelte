<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { vehiclesApi, tripLogsApi, type Vehicle } from '$lib/api.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	// --- State ---
	let isTracking = $state(false);
	let gpsEnabled = $state(true);
	let motionEnabled = $state(true);

	// Vehicle selection
	let vehicles = $state<Vehicle[]>([]);
	let selectedVehicleId = $state('');
	let selectedVehicle = $derived(vehicles.find((v) => v.id === selectedVehicleId));

	// GPS data
	let currentSpeed = $state(0); // km/h
	let maxSpeed = $state(0); // km/h
	let distance = $state(0); // km
	let avgSpeed = $state(0); // km/h
	let lastPosition = $state<{ lat: number; lon: number } | null>(null);
	let speedReadings = $state<number[]>([]);

	// Acceleration data
	let accelX = $state(0);
	let accelY = $state(0);
	let accelZ = $state(0);

	// Trip tracking
	let startTime = $state<Date | null>(null);
	let elapsedSeconds = $state(0);
	let hardBrakingCount = $state(0);
	let rapidAccelCount = $state(0);
	let previousSpeed = $state(0);
	let idleSeconds = $state(0);

	// Events
	let events = $state<{ timestamp: Date; type: string; description: string }[]>([]);

	// AI Alerts
	let aiAlerts = $state<{ level: string; message: string; category: string }[]>([]);
	let aiScore = $state<number | null>(null);
	let aiEfficiency = $state<number | null>(null);
	let aiFuelTip = $state<string | null>(null);
	let aiLastFetched = $state(0);

	// Save state
	let isSaving = $state(false);
	let saveMessage = $state<string | null>(null);

	// Watcher/interval IDs
	let geoWatchId = $state<number | null>(null);
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);

	// --- Derived ---
	let drivingQuality = $derived.by(() => {
		if (aiScore !== null) {
			if (aiScore >= 80) return 'Excellent';
			if (aiScore >= 60) return 'Good';
			if (aiScore >= 40) return 'Fair';
			return 'Poor';
		}
		const totalEvents = hardBrakingCount + rapidAccelCount;
		if (totalEvents === 0) return 'Excellent';
		if (totalEvents <= 2) return 'Good';
		if (totalEvents <= 5) return 'Fair';
		return 'Poor';
	});

	let qualityScore = $derived(aiScore ?? Math.max(0, 100 - (hardBrakingCount + rapidAccelCount) * 10));

	let elapsedMinutes = $derived(Math.floor(elapsedSeconds / 60));
	let idleMinutes = $derived(Math.round(idleSeconds / 60 * 10) / 10);

	// Local efficiency estimate (mirrors AI service logic, works offline)
	let localEfficiency = $derived.by(() => {
		const fuelType = selectedVehicle?.fuelType ?? 'gasoline';
		const baseMap: Record<string, number> = { gasoline: 12, diesel: 14, hybrid: 18, ev: 6 };
		const base = baseMap[fuelType] ?? 12;

		let adjustment = 0;
		if (avgSpeed > 0) {
			if (avgSpeed >= 60 && avgSpeed <= 80) adjustment += 2;
			else if (avgSpeed > 100) adjustment -= 3;
			else if (avgSpeed < 20) adjustment -= 2;
		}
		if (distance > 0) {
			const eventsPerKm = (hardBrakingCount + rapidAccelCount) / Math.max(distance, 0.1);
			adjustment -= Math.min(eventsPerKm * 0.3, 3);
		}
		if (elapsedSeconds > 0) {
			const idleRatio = idleSeconds / elapsedSeconds;
			if (idleRatio > 0.3) adjustment -= 2;
			else if (idleRatio > 0.15) adjustment -= 1;
		}
		return Math.max(base + adjustment, base * 0.5);
	});

	let estFuelEfficiency = $derived.by(() => {
		if (aiEfficiency !== null) return aiEfficiency.toFixed(1);
		if (elapsedSeconds > 5) return localEfficiency.toFixed(1);
		return '--';
	});

	// Estimated fuel cost based on efficiency and distance
	let estFuelCost = $derived.by(() => {
		const eff = aiEfficiency ?? (elapsedSeconds > 5 ? localEfficiency : null);
		if (!eff || eff <= 0 || distance < 0.01) return null;
		const litersUsed = distance / eff;
		// Default price per liter (PHP) - could be fetched from fuel logs later
		const pricePerLiter = 59.5;
		return litersUsed * pricePerLiter;
	});

	// --- Auto-start flag ---
	let autoStartPending = $state(page.url.searchParams.get('autostart') === 'true');

	// --- Load vehicles ---
	$effect(() => {
		vehiclesApi.list().then((v) => {
			vehicles = v;
			if (v.length > 0 && !selectedVehicleId) {
				selectedVehicleId = v[0].id;
			}
		});
	});

	// --- Auto-start tracking when vehicles are loaded and autostart param is set ---
	$effect(() => {
		if (autoStartPending && vehicles.length > 0 && selectedVehicleId && !isTracking) {
			autoStartPending = false;
			// Clear the query param from URL without reload
			goto(`${base}/live-tracking`, { replaceState: true, noScroll: true });
			startTracking();
		}
	});

	// --- Haversine distance ---
	function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371; // Earth radius in km
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	// --- AI Real-time Analysis ---
	async function fetchAiAlerts() {
		if (!selectedVehicleId || !isTracking) return;

		const now = Date.now();
		// Throttle: at most once every 10 seconds
		if (now - aiLastFetched < 10000) return;
		aiLastFetched = now;

		try {
			const { analyzeRealtime } = await import('$lib/ai-service.js');
			const data = await analyzeRealtime(
				selectedVehicleId,
				selectedVehicle?.fuelType ?? 'gasoline',
				{
					current_speed_kmh: currentSpeed,
					avg_speed_kmh: avgSpeed,
					max_speed_kmh: maxSpeed,
					hard_braking_count: hardBrakingCount,
					rapid_accel_count: rapidAccelCount,
					idle_minutes: idleMinutes,
					distance_km: distance,
					duration_minutes: elapsedSeconds / 60,
					trip_type: 'mixed'
				}
			);

			if (data) {
				aiAlerts = data.alerts ?? [];
				aiScore = data.current_score ?? null;
				aiEfficiency = data.estimated_efficiency_km_l ?? null;
				aiFuelTip = data.fuel_saving_tip ?? null;
			}
		} catch {
			// Silently fail — don't interrupt tracking
		}
	}

	// --- GPS handler ---
	function handlePosition(pos: GeolocationPosition) {
		const { latitude, longitude, speed } = pos.coords;

		// Speed from GPS (m/s -> km/h), fallback to 0
		const gpsSpeed = speed !== null && speed >= 0 ? speed * 3.6 : 0;

		// Track max speed
		if (gpsSpeed > maxSpeed) maxSpeed = gpsSpeed;

		// Track idle time (speed < 3 km/h)
		if (gpsSpeed < 3) {
			idleSeconds++;
		}

		// Detect hard braking / rapid acceleration from speed changes
		const speedDelta = gpsSpeed - previousSpeed;
		const timeDelta = 1; // approximate 1 second between readings
		const accel = speedDelta / 3.6 / timeDelta; // convert km/h delta to m/s²

		if (accel < -3) {
			hardBrakingCount++;
			events = [
				{ timestamp: new Date(), type: 'hard-braking', description: 'Hard braking detected' },
				...events
			];
		} else if (accel > 3) {
			rapidAccelCount++;
			events = [
				{
					timestamp: new Date(),
					type: 'rapid-accel',
					description: 'Rapid acceleration detected'
				},
				...events
			];
		}

		previousSpeed = gpsSpeed;
		currentSpeed = gpsSpeed;
		speedReadings = [...speedReadings, gpsSpeed];
		avgSpeed =
			speedReadings.length > 0
				? speedReadings.reduce((a, b) => a + b, 0) / speedReadings.length
				: 0;

		// Calculate distance
		if (lastPosition) {
			const d = haversineDistance(lastPosition.lat, lastPosition.lon, latitude, longitude);
			// Filter out GPS noise: only add if > 5m
			if (d > 0.005) {
				distance += d;
			}
		}
		lastPosition = { lat: latitude, lon: longitude };

		// Fetch AI alerts periodically
		fetchAiAlerts();
	}

	function handlePositionError(err: GeolocationPositionError) {
		console.error('Geolocation error:', err.message);
		events = [
			{ timestamp: new Date(), type: 'error', description: `GPS error: ${err.message}` },
			...events
		];
	}

	// --- DeviceMotion handler ---
	function handleDeviceMotion(e: DeviceMotionEvent) {
		if (e.accelerationIncludingGravity) {
			accelX = e.accelerationIncludingGravity.x ?? 0;
			accelY = e.accelerationIncludingGravity.y ?? 0;
			accelZ = e.accelerationIncludingGravity.z ?? 0;
		}

		// Use linear acceleration for event detection if available
		if (e.acceleration) {
			const forwardAccel = e.acceleration.y ?? 0;
			if (Math.abs(forwardAccel) > 3 && !gpsEnabled) {
				// Only use motion for event detection if GPS is off
				if (forwardAccel < -3) {
					hardBrakingCount++;
					events = [
						{
							timestamp: new Date(),
							type: 'hard-braking',
							description: 'Hard braking detected (motion sensor)'
						},
						...events
					];
				} else if (forwardAccel > 3) {
					rapidAccelCount++;
					events = [
						{
							timestamp: new Date(),
							type: 'rapid-accel',
							description: 'Rapid acceleration detected (motion sensor)'
						},
						...events
					];
				}
			}
		}
	}

	// --- Start/Stop ---
	function startTracking() {
		isTracking = true;
		startTime = new Date();
		elapsedSeconds = 0;
		distance = 0;
		currentSpeed = 0;
		maxSpeed = 0;
		avgSpeed = 0;
		hardBrakingCount = 0;
		rapidAccelCount = 0;
		idleSeconds = 0;
		speedReadings = [];
		lastPosition = null;
		previousSpeed = 0;
		events = [];
		accelX = 0;
		accelY = 0;
		accelZ = 0;
		aiAlerts = [];
		aiScore = null;
		aiEfficiency = null;
		aiFuelTip = null;
		aiLastFetched = 0;
		saveMessage = null;

		// Start elapsed timer
		timerInterval = setInterval(() => {
			elapsedSeconds++;
			// Fetch AI alerts every 15 seconds via the timer
			if (elapsedSeconds % 15 === 0) {
				fetchAiAlerts();
			}
		}, 1000);

		// Start GPS
		if (gpsEnabled && 'geolocation' in navigator) {
			geoWatchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
				enableHighAccuracy: true,
				maximumAge: 1000,
				timeout: 10000
			});
		}

		// Start Motion
		if (motionEnabled && 'DeviceMotionEvent' in window) {
			window.addEventListener('devicemotion', handleDeviceMotion);
		}
	}

	function stopTracking() {
		isTracking = false;

		// Clear timer
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		// Clear GPS
		if (geoWatchId !== null) {
			navigator.geolocation.clearWatch(geoWatchId);
			geoWatchId = null;
		}

		// Clear Motion
		window.removeEventListener('devicemotion', handleDeviceMotion);

		// Final AI analysis
		fetchAiAlerts();

		// Auto-save trip if meaningful data was recorded
		if (distance > 0.01 && selectedVehicleId) {
			saveTrip();
		}
	}

	function toggleTracking() {
		if (isTracking) {
			stopTracking();
		} else {
			startTracking();
		}
	}

	// --- Save Trip ---
	async function saveTrip() {
		if (!selectedVehicleId || distance < 0.01) {
			saveMessage = 'Cannot save: no vehicle selected or no distance recorded.';
			return;
		}

		isSaving = true;
		saveMessage = null;

		try {
			await tripLogsApi.create({
				vehicleId: selectedVehicleId,
				date: new Date().toISOString().split('T')[0],
				distanceKm: Math.round(distance * 100) / 100,
				durationMinutes: Math.round(elapsedSeconds / 60 * 10) / 10,
				avgSpeedKmh: Math.round(avgSpeed * 100) / 100,
				maxSpeedKmh: Math.round(maxSpeed * 100) / 100,
				hardBrakingCount,
				rapidAccelCount,
				idleMinutes,
				tripType: avgSpeed > 60 ? 'highway' : avgSpeed < 30 ? 'city' : 'mixed',
				notes: `Live tracked trip — Score: ${qualityScore}/100`
			});
			saveMessage = 'Trip saved successfully!';
		} catch (err) {
			saveMessage = `Failed to save trip: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			isSaving = false;
		}
	}

	// --- Cleanup on unmount ---
	$effect(() => {
		return () => {
			if (timerInterval) clearInterval(timerInterval);
			if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
			window.removeEventListener('devicemotion', handleDeviceMotion);
		};
	});

	// --- Helpers ---
	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function alertColor(level: string): string {
		if (level === 'critical') return 'bg-red-500';
		if (level === 'warning') return 'bg-amber-500';
		return 'bg-blue-500';
	}

	function alertBorder(level: string): string {
		if (level === 'critical') return 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950';
		if (level === 'warning') return 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
		return 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Live Tracking</h1>
		<p class="text-muted-foreground">Real-time motion sensors, GPS tracking & AI driving analysis</p>
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap items-center gap-3">
		<Button
			class={isTracking
				? 'bg-red-500 hover:bg-red-600 text-white'
				: 'bg-emerald-500 hover:bg-emerald-600 text-white'}
			onclick={toggleTracking}
		>
			{#snippet children()}
				{#if isTracking}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="6" y="6" width="12" height="12" rx="2" />
					</svg>
					Stop Tracking
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polygon points="5 3 19 12 5 21 5 3" />
					</svg>
					Start Tracking
				{/if}
			{/snippet}
		</Button>

		<!-- Vehicle Selector -->
		<select
			class="rounded-md border bg-background px-3 py-2 text-sm"
			bind:value={selectedVehicleId}
			disabled={isTracking}
		>
			{#if vehicles.length === 0}
				<option value="">No vehicles — add one first</option>
			{:else}
				{#each vehicles as v}
					<option value={v.id}>{v.name} ({v.fuelType})</option>
				{/each}
			{/if}
		</select>

		<div class="flex items-center rounded-md border">
			<button
				class="px-3 py-2 text-sm font-medium transition-colors {gpsEnabled
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
				onclick={() => (gpsEnabled = !gpsEnabled)}
				disabled={isTracking}
			>
				GPS
			</button>
			<button
				class="px-3 py-2 text-sm font-medium transition-colors border-l {motionEnabled
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
				onclick={() => (motionEnabled = !motionEnabled)}
				disabled={isTracking}
			>
				Motion
			</button>
		</div>

		<!-- Save Trip Button (visible when stopped and has data) -->
		{#if !isTracking && distance > 0.01}
			<Button
				class="bg-blue-500 hover:bg-blue-600 text-white"
				onclick={saveTrip}
				disabled={isSaving || !selectedVehicleId}
			>
				{#snippet children()}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
						<polyline points="17 21 17 13 7 13 7 21" />
						<polyline points="7 3 7 8 15 8" />
					</svg>
					{isSaving ? 'Saving...' : 'Save Trip'}
				{/snippet}
			</Button>
		{/if}
	</div>

	<!-- Save Message -->
	{#if saveMessage}
		<div class="rounded-md border px-4 py-2 text-sm {saveMessage.includes('success')
			? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
			: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}">
			{saveMessage}
		</div>
	{/if}

	<!-- AI Fuel Saving Tip Banner -->
	{#if aiFuelTip && isTracking}
		<div class="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-950">
			<div class="flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4" />
					<path d="M12 8h.01" />
				</svg>
				<span class="text-sm font-medium text-blue-800 dark:text-blue-200">
					AI Tip: {aiFuelTip}
				</span>
			</div>
		</div>
	{/if}

	<!-- Stat Cards -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
		<!-- Current Speed -->
		<div class="rounded-xl bg-blue-500 p-4 text-white">
			<div class="flex items-center gap-2 text-sm font-medium opacity-90">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0" />
					<path d="M12 12l4 -4" />
					<path d="M12 7v1" />
					<path d="M7 12h1" />
					<path d="M17 12h-1" />
				</svg>
				Current Speed
			</div>
			<div class="mt-2 text-3xl font-bold">{currentSpeed.toFixed(1)}</div>
			<div class="text-sm opacity-75">km/h</div>
		</div>

		<!-- Distance -->
		<div class="rounded-xl bg-orange-500 p-4 text-white">
			<div class="flex items-center gap-2 text-sm font-medium opacity-90">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 21h18" />
					<path d="M3 21v-18" />
					<path d="M7 21v-4" />
					<path d="M11 21v-8" />
					<path d="M15 21v-12" />
					<path d="M19 21v-16" />
				</svg>
				Distance
			</div>
			<div class="mt-2 text-3xl font-bold">{distance.toFixed(2)}</div>
			<div class="text-sm opacity-75">km</div>
		</div>

		<!-- AI Driving Score -->
		<div class="rounded-xl {qualityScore >= 60 ? 'bg-emerald-500' : qualityScore >= 40 ? 'bg-amber-500' : 'bg-red-500'} p-4 text-white">
			<div class="flex items-center gap-2 text-sm font-medium opacity-90">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
					/>
				</svg>
				Driving Score
			</div>
			<div class="mt-2 text-3xl font-bold">{qualityScore}<span class="text-lg">/100</span></div>
			<div class="text-sm opacity-75">{drivingQuality}</div>
		</div>

		<!-- Est. Fuel Efficiency -->
		<div class="rounded-xl bg-cyan-500 p-4 text-white">
			<div class="flex items-center gap-2 text-sm font-medium opacity-90">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
					<path d="M12 12l3 -3" />
					<path d="M12 3v2" />
					<path d="M3 12h2" />
					<path d="M21 12h-2" />
					<path d="M12 21v-2" />
				</svg>
				Est. Efficiency
			</div>
			<div class="mt-2 text-3xl font-bold">{estFuelEfficiency}</div>
			<div class="text-sm opacity-75">km/L</div>
		</div>

		<!-- Est. Fuel Cost -->
		<div class="rounded-xl bg-violet-500 p-4 text-white">
			<div class="flex items-center gap-2 text-sm font-medium opacity-90">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
				</svg>
				Est. Fuel Cost
			</div>
			<div class="mt-2 text-3xl font-bold">
				{#if estFuelCost !== null}
					{estFuelCost.toFixed(0)}
				{:else}
					--
				{/if}
			</div>
			<div class="text-sm opacity-75">PHP</div>
		</div>
	</div>

	<!-- AI Alerts Section -->
	{#if aiAlerts.length > 0}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-amber-500"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 16v-4" />
						<path d="M12 8h.01" />
					</svg>
					AI Driving Alerts
				</Card.Title>
				<Card.Description>Real-time analysis of your driving behavior</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2">
					{#each aiAlerts as alert}
						<div class="flex items-start gap-3 rounded-md border p-3 text-sm {alertBorder(alert.level)}">
							<span class="mt-0.5 inline-block h-2.5 w-2.5 rounded-full shrink-0 {alertColor(alert.level)}"></span>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<Badge variant={alert.level === 'critical' ? 'destructive' : alert.level === 'warning' ? 'outline' : 'secondary'}>
										{alert.category}
									</Badge>
								</div>
								<p class="mt-1">{alert.message}</p>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Two-column section -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Live Acceleration Data -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Live Acceleration Data</Card.Title>
				<Card.Description>Real-time accelerometer readings</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left">
								<th class="pb-2 font-medium">Axis</th>
								<th class="pb-2 text-right font-medium">Value (m/s&sup2;)</th>
							</tr>
						</thead>
						<tbody>
							<tr class="border-b">
								<td class="py-3">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-3 w-3 rounded-full bg-red-500"
										></span>
										X-Axis (Lateral)
									</div>
								</td>
								<td class="py-3 text-right font-mono">{accelX.toFixed(2)}</td>
							</tr>
							<tr class="border-b">
								<td class="py-3">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-3 w-3 rounded-full bg-green-500"
										></span>
										Y-Axis (Forward/Back)
									</div>
								</td>
								<td class="py-3 text-right font-mono">{accelY.toFixed(2)}</td>
							</tr>
							<tr>
								<td class="py-3">
									<div class="flex items-center gap-2">
										<span
											class="inline-block h-3 w-3 rounded-full bg-blue-500"
										></span>
										Z-Axis (Vertical)
									</div>
								</td>
								<td class="py-3 text-right font-mono">{accelZ.toFixed(2)}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Current Trip Summary -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Current Trip Summary</Card.Title>
				<Card.Description>Overview of the current tracking session</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<tbody>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Duration</td>
								<td class="py-3 text-right font-medium">{elapsedMinutes} min</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Distance Traveled</td>
								<td class="py-3 text-right font-medium">{distance.toFixed(2)} km</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Max Speed</td>
								<td class="py-3 text-right font-medium">{maxSpeed.toFixed(1)} km/h</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Avg Speed</td>
								<td class="py-3 text-right font-medium">{avgSpeed.toFixed(1)} km/h</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Hard Braking Events</td>
								<td
									class="py-3 text-right font-medium {hardBrakingCount > 0
										? 'text-red-500'
										: ''}"
								>
									{hardBrakingCount}
								</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Rapid Acceleration</td>
								<td class="py-3 text-right font-medium">{rapidAccelCount}</td>
							</tr>
							<tr class="border-b">
								<td class="py-3 text-muted-foreground">Idle Time</td>
								<td class="py-3 text-right font-medium">{idleMinutes} min</td>
							</tr>
							<tr>
								<td class="py-3 text-muted-foreground">Est. Fuel Efficiency</td>
								<td class="py-3 text-right font-medium">{estFuelEfficiency} km/L</td>
							</tr>
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Recent Driving Events -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Recent Driving Events</Card.Title>
			<Card.Description>Real-time driving event detection</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if events.length === 0}
				<div class="py-8 text-center">
					<p class="text-muted-foreground">No events detected yet</p>
					<p class="text-sm text-muted-foreground mt-1">
						Start tracking to see real-time driving events
					</p>
				</div>
			{:else}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each events as event}
						<div
							class="flex items-center gap-3 rounded-md border p-3 text-sm"
						>
							<span
								class="inline-block h-2 w-2 rounded-full {event.type === 'hard-braking'
									? 'bg-red-500'
									: event.type === 'rapid-accel'
										? 'bg-orange-500'
										: 'bg-yellow-500'}"
							></span>
							<span class="flex-1">{event.description}</span>
							<span class="text-xs text-muted-foreground">
								{formatTime(event.timestamp)}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Warning Banner -->
	{#if !isTracking && distance <= 0.01}
		<div class="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
			<div class="flex items-start gap-3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0"
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
				<div>
					<h3 class="font-semibold text-amber-800 dark:text-amber-200">
						Sensor Permissions Required
					</h3>
					<p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
						This feature requires access to your device's motion sensors and GPS location. Click
						'Start Tracking' to grant permissions.
					</p>
					<ul class="mt-2 list-disc pl-5 text-sm text-amber-700 dark:text-amber-300 space-y-1">
						<li>Select your vehicle before starting a tracking session</li>
						<li>Mount your device securely in a fixed position for accurate readings</li>
						<li>GPS tracking requires location permissions and works best outdoors</li>
						<li>AI alerts analyze your driving every 15 seconds during tracking</li>
						<li>Save your trip when done to build your driving history</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>
