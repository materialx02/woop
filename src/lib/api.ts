import { db, type Vehicle, type FuelLog, type TripLog, type AiInsight } from '$lib/db.js';
import type { VehicleInput, FuelLogInput, TripLogInput } from '$lib/validators.js';

export type { Vehicle, FuelLog, TripLog, AiInsight };

// Vehicles
export const vehiclesApi = {
	list: async (): Promise<Vehicle[]> => {
		return db.vehicles.orderBy('createdAt').toArray();
	},

	get: async (id: string): Promise<Vehicle> => {
		const vehicle = await db.vehicles.get(id);
		if (!vehicle) throw new Error('Vehicle not found');
		return vehicle;
	},

	create: async (data: VehicleInput): Promise<Vehicle> => {
		const vehicle: Vehicle = {
			id: crypto.randomUUID(),
			name: data.name,
			make: data.make,
			model: data.model,
			year: data.year,
			fuelType: data.fuelType ?? 'gasoline',
			tankCapacityLiters: data.tankCapacityLiters,
			batteryCapacityKwh: data.batteryCapacityKwh,
			odometerKm: data.odometerKm ?? 0,
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		await db.vehicles.add(vehicle);
		return vehicle;
	},

	update: async (id: string, data: Partial<VehicleInput>): Promise<Vehicle> => {
		await db.vehicles.update(id, { ...data, updatedAt: new Date() });
		const vehicle = await db.vehicles.get(id);
		if (!vehicle) throw new Error('Vehicle not found');
		return vehicle;
	},

	delete: async (id: string): Promise<{ success: boolean }> => {
		await db.fuelLogs.where('vehicleId').equals(id).delete();
		await db.tripLogs.where('vehicleId').equals(id).delete();
		await db.aiInsights.where('vehicleId').equals(id).delete();
		await db.vehicles.delete(id);
		return { success: true };
	}
};

// Fuel Logs
export interface FuelStats {
	totalLogs: number;
	totalCost: number;
	totalLiters: number;
	totalDistance: number;
	avgKmPerLiter: number | null;
	efficiencyData: { date: string; kmPerLiter: number; distance: number; liters: number }[];
}

export const fuelLogsApi = {
	list: async (vehicleId?: string): Promise<FuelLog[]> => {
		let collection = vehicleId
			? db.fuelLogs.where('vehicleId').equals(vehicleId)
			: db.fuelLogs.orderBy('date');

		const logs = await collection.toArray();
		return logs.sort((a, b) => b.date.localeCompare(a.date));
	},

	create: async (data: FuelLogInput): Promise<FuelLog> => {
		const log: FuelLog = {
			id: crypto.randomUUID(),
			vehicleId: data.vehicleId,
			date: data.date,
			odometerKm: data.odometerKm,
			liters: data.liters,
			kwh: data.kwh,
			pricePerUnit: data.pricePerUnit,
			totalCost: data.totalCost,
			isFullTank: data.isFullTank ?? true,
			fuelBrand: data.fuelBrand,
			stationName: data.stationName,
			notes: data.notes,
			createdAt: new Date()
		};
		await db.fuelLogs.add(log);

		// Update vehicle odometer
		await db.vehicles.update(data.vehicleId, {
			odometerKm: data.odometerKm,
			updatedAt: new Date()
		});

		return log;
	},

	delete: async (id: string): Promise<{ success: boolean }> => {
		await db.fuelLogs.delete(id);
		return { success: true };
	},

	stats: async (vehicleId: string): Promise<FuelStats> => {
		const logs = await db.fuelLogs
			.where('vehicleId')
			.equals(vehicleId)
			.toArray();

		logs.sort((a, b) => a.odometerKm - b.odometerKm);

		const efficiencyData: FuelStats['efficiencyData'] = [];
		let totalCost = 0;
		let totalLiters = 0;
		let totalDistance = 0;

		for (let i = 1; i < logs.length; i++) {
			const prev = logs[i - 1];
			const curr = logs[i];
			totalCost += curr.totalCost;

			if (curr.isFullTank && prev.isFullTank && curr.liters) {
				const distance = curr.odometerKm - prev.odometerKm;
				const liters = curr.liters;

				if (distance > 0 && liters > 0) {
					totalLiters += liters;
					totalDistance += distance;
					efficiencyData.push({
						date: curr.date,
						kmPerLiter: distance / liters,
						distance,
						liters
					});
				}
			}
		}

		if (logs.length > 0) {
			totalCost += logs[0].totalCost;
		}

		return {
			totalLogs: logs.length,
			totalCost,
			totalLiters,
			totalDistance,
			avgKmPerLiter: totalDistance > 0 && totalLiters > 0 ? totalDistance / totalLiters : null,
			efficiencyData
		};
	}
};

// Trip Logs
export interface DrivingScore {
	score: number | null;
	totalTrips: number;
	breakdown: { braking: number; acceleration: number; idling: number; speed: number } | null;
	tips: string[];
}

export const tripLogsApi = {
	list: async (vehicleId?: string): Promise<TripLog[]> => {
		let logs: TripLog[];
		if (vehicleId) {
			logs = await db.tripLogs.where('vehicleId').equals(vehicleId).toArray();
		} else {
			logs = await db.tripLogs.toArray();
		}
		return logs.sort((a, b) => b.date.localeCompare(a.date));
	},

	create: async (data: TripLogInput): Promise<TripLog> => {
		const trip: TripLog = {
			id: crypto.randomUUID(),
			vehicleId: data.vehicleId,
			date: data.date,
			distanceKm: data.distanceKm,
			durationMinutes: data.durationMinutes,
			avgSpeedKmh: data.avgSpeedKmh,
			maxSpeedKmh: data.maxSpeedKmh,
			hardBrakingCount: data.hardBrakingCount ?? 0,
			rapidAccelCount: data.rapidAccelCount ?? 0,
			idleMinutes: data.idleMinutes ?? 0,
			fuelConsumedLiters: data.fuelConsumedLiters,
			kwhConsumed: data.kwhConsumed,
			tripType: data.tripType ?? 'mixed',
			notes: data.notes,
			createdAt: new Date()
		};
		await db.tripLogs.add(trip);
		return trip;
	},

	delete: async (id: string): Promise<{ success: boolean }> => {
		await db.tripLogs.delete(id);
		return { success: true };
	},

	drivingScore: async (vehicleId: string): Promise<DrivingScore> => {
		const trips = await db.tripLogs
			.where('vehicleId')
			.equals(vehicleId)
			.toArray();

		const recent = trips
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 20);

		if (recent.length === 0) {
			return { score: null, totalTrips: 0, breakdown: null, tips: [] };
		}

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

		const score = Math.round(brakingScore + accelScore + idleScore + speedScore);

		const tips: string[] = [];
		if (avgBraking > 2) tips.push('Reduce hard braking — anticipate stops earlier to save ~3% fuel/month');
		if (avgAccel > 2) tips.push('Ease off rapid acceleration — smooth starts save fuel');
		if (idleRatio > 0.15) tips.push('Reduce idling time — turn off engine when stopped for more than 1 minute');
		if (highSpeedRatio > 0.3) tips.push('Drive at 70-80 km/h on highways for optimal fuel efficiency');
		if (tips.length === 0) tips.push('Great driving habits! Keep it up.');

		return {
			score,
			totalTrips: n,
			breakdown: {
				braking: Math.round(brakingScore),
				acceleration: Math.round(accelScore),
				idling: Math.round(idleScore),
				speed: Math.round(speedScore)
			},
			tips
		};
	}
};

// AI Insights
export interface InsightTriggerResult {
	generated: number;
	insights: Array<{
		type: string;
		title: string;
		description: string;
		data: unknown;
		confidence: number;
	}>;
}

export const insightsApi = {
	list: async (vehicleId: string): Promise<AiInsight[]> => {
		const insights = await db.aiInsights
			.where('vehicleId')
			.equals(vehicleId)
			.toArray();
		return insights.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);
	},

	trigger: async (vehicleId: string): Promise<InsightTriggerResult> => {
		const {
			predictEfficiency,
			predictCost,
			analyzeDriving,
			trainEfficiencyModel,
			getConfiguredAiUrl
		} = await import('$lib/ai-service.js');

		if (!getConfiguredAiUrl()) {
			throw new Error('AI service not configured. Set the AI Service URL in Settings.');
		}

		const vehicle = await db.vehicles.get(vehicleId);
		if (!vehicle) throw new Error('Vehicle not found');

		const tripLogs = await db.tripLogs
			.where('vehicleId')
			.equals(vehicleId)
			.toArray();
		const recentTrips = tripLogs
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 20);

		const fuelLogsList = await db.fuelLogs
			.where('vehicleId')
			.equals(vehicleId)
			.toArray();
		const recentFuel = fuelLogsList
			.sort((a, b) => b.date.localeCompare(a.date))
			.slice(0, 20);

		const trips = recentTrips.map((t) => ({
			distance_km: t.distanceKm,
			duration_minutes: t.durationMinutes,
			avg_speed_kmh: t.avgSpeedKmh,
			max_speed_kmh: t.maxSpeedKmh,
			hard_braking_count: t.hardBrakingCount,
			rapid_accel_count: t.rapidAccelCount,
			idle_minutes: t.idleMinutes,
			trip_type: t.tripType,
			fuel_consumed_liters: t.fuelConsumedLiters
		}));

		const results: InsightTriggerResult['insights'] = [];

		// Auto-train if enough trips have fuel data
		const tripsWithFuel = trips.filter(
			(t) => t.fuel_consumed_liters && t.fuel_consumed_liters > 0 && t.distance_km > 0
		);
		if (tripsWithFuel.length >= 5) {
			const efficiencies = tripsWithFuel.map((t) => t.distance_km / t.fuel_consumed_liters!);
			const trainResult = await trainEfficiencyModel(
				vehicleId,
				vehicle.fuelType,
				tripsWithFuel,
				efficiencies
			);
			if (trainResult) {
				results.push({
					type: 'recommendation',
					title: `AI Model Trained (${trainResult.samples_used} trips)`,
					description: trainResult.message,
					data: trainResult,
					confidence: trainResult.confidence
				});
			}
		}

		// Efficiency prediction
		if (trips.length >= 3) {
			const effResult = await predictEfficiency(vehicleId, vehicle.fuelType, trips);
			if (effResult) {
				results.push({
					type: 'efficiency_prediction',
					title: `Predicted Efficiency: ${effResult.predicted_km_per_liter} km/L`,
					description: effResult.tips.join(' '),
					data: effResult,
					confidence: effResult.confidence
				});
			}
		}

		// Cost forecast
		const priceData = recentFuel
			.filter((f) => f.liters && f.pricePerUnit)
			.map((f) => ({ date: f.date, price_per_liter: f.pricePerUnit }));
		if (priceData.length >= 3) {
			const avgLiters =
				recentFuel.reduce((sum, f) => sum + (f.liters ?? 0), 0) /
				Math.max(recentFuel.length, 1);
			const costResult = await predictCost(priceData, avgLiters || 30);
			if (costResult) {
				results.push({
					type: 'cost_forecast',
					title: `Best refuel day: ${costResult.recommended_day}`,
					description: `Fuel prices are ${costResult.trend}. Estimated cost: ₱${costResult.projected_cost.toFixed(2)}`,
					data: costResult,
					confidence: costResult.confidence
				});
			}
		}

		// Driving analysis
		if (trips.length >= 3) {
			const drivingResult = await analyzeDriving(vehicleId, trips);
			if (drivingResult) {
				results.push({
					type: 'driving_analysis',
					title: `Driving Score: ${drivingResult.score}/100 (${drivingResult.category})`,
					description: drivingResult.tips.join(' '),
					data: drivingResult,
					confidence: drivingResult.score / 100
				});
			}
		}

		// Store insights locally in IndexedDB
		const now = new Date();
		for (const insight of results) {
			await db.aiInsights.add({
				id: crypto.randomUUID(),
				vehicleId,
				insightType: insight.type as AiInsight['insightType'],
				title: insight.title,
				description: insight.description,
				data: insight.data,
				confidence: insight.confidence,
				isRead: false,
				expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
				createdAt: now
			});
		}

		return { generated: results.length, insights: results };
	},

	markRead: async (id: string): Promise<AiInsight> => {
		await db.aiInsights.update(id, { isRead: true });
		const insight = await db.aiInsights.get(id);
		if (!insight) throw new Error('Insight not found');
		return insight;
	}
};
