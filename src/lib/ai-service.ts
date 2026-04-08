/**
 * Client-side AI service client.
 * Calls the FastAPI AI service directly from the browser.
 * The AI service URL is configurable via localStorage.
 * All calls gracefully return null if the service is unavailable.
 */

function getAiUrl(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('drivefuel_ai_url') || null;
}

export function setAiUrl(url: string) {
	localStorage.setItem('drivefuel_ai_url', url);
}

export function getConfiguredAiUrl(): string | null {
	return getAiUrl();
}

async function callAi<T>(path: string, body: unknown): Promise<T | null> {
	const baseUrl = getAiUrl();
	if (!baseUrl) return null;

	try {
		const res = await fetch(`${baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

// --- Types ---

export interface TripFeatures {
	distance_km: number;
	duration_minutes?: number;
	avg_speed_kmh?: number;
	max_speed_kmh?: number;
	hard_braking_count?: number;
	rapid_accel_count?: number;
	idle_minutes?: number;
	trip_type?: string;
}

export interface TripData extends TripFeatures {
	fuel_consumed_liters?: number;
}

export interface EfficiencyPrediction {
	predicted_km_per_liter: number;
	confidence: number;
	comparison: Record<string, number | null>;
	tips: string[];
}

export interface TrainingResult {
	model_key: string;
	confidence: number;
	samples_used: number;
	message: string;
}

export interface CostForecast {
	forecast: { date: string; predicted_price: number }[];
	recommended_day: string;
	recommended_price: number;
	projected_cost: number;
	trend: string;
	confidence: number;
}

export interface DrivingAnalysis {
	score: number;
	breakdown: {
		braking: number;
		acceleration: number;
		idling: number;
		speed: number;
		efficiency: number;
	};
	category: string;
	tips: string[];
	anomalies: string[];
}

export interface RealtimeMetrics {
	current_speed_kmh: number;
	avg_speed_kmh: number;
	max_speed_kmh: number;
	hard_braking_count: number;
	rapid_accel_count: number;
	idle_minutes: number;
	distance_km: number;
	duration_minutes: number;
	trip_type?: string;
}

export interface RealtimeAlert {
	level: 'info' | 'warning' | 'critical';
	message: string;
	category: string;
}

export interface RealtimeAnalysis {
	alerts: RealtimeAlert[];
	current_score: number;
	estimated_efficiency_km_l: number | null;
	fuel_saving_tip: string | null;
}

// --- API Functions ---

export function predictEfficiency(vehicleId: string, fuelType: string, trips: TripFeatures[]) {
	return callAi<EfficiencyPrediction>('/predict/efficiency', {
		vehicle_id: vehicleId,
		fuel_type: fuelType,
		trips
	});
}

export function trainEfficiencyModel(
	vehicleId: string,
	fuelType: string,
	trips: TripFeatures[],
	efficiencies: number[]
) {
	return callAi<TrainingResult>('/predict/efficiency/train', {
		vehicle_id: vehicleId,
		fuel_type: fuelType,
		trips,
		efficiencies
	});
}

export function predictCost(
	priceHistory: { date: string; price_per_liter: number }[],
	avgLitersPerFillup: number,
	region = 'NCR',
	fuelType = 'gasoline'
) {
	return callAi<CostForecast>('/predict/cost', {
		region,
		fuel_type: fuelType,
		price_history: priceHistory,
		avg_liters_per_fillup: avgLitersPerFillup
	});
}

export function analyzeDriving(vehicleId: string, trips: TripData[]) {
	return callAi<DrivingAnalysis>('/analyze/driving', {
		vehicle_id: vehicleId,
		trips
	});
}

export function analyzeRealtime(vehicleId: string, fuelType: string, metrics: RealtimeMetrics) {
	return callAi<RealtimeAnalysis>('/analyze/realtime', {
		vehicle_id: vehicleId,
		fuel_type: fuelType,
		metrics
	});
}

export async function checkAiHealth(): Promise<boolean> {
	const baseUrl = getAiUrl();
	if (!baseUrl) return false;

	try {
		const res = await fetch(`${baseUrl}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
