import Dexie, { type EntityTable } from 'dexie';

// Types
export interface Vehicle {
	id: string;
	name: string;
	make?: string;
	model?: string;
	year?: number;
	fuelType: 'gasoline' | 'diesel' | 'ev' | 'hybrid';
	tankCapacityLiters?: number;
	batteryCapacityKwh?: number;
	weightKg?: number;
	odometerKm: number;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface FuelLog {
	id: string;
	vehicleId: string;
	date: string;
	odometerKm?: number;
	liters?: number;
	kwh?: number;
	pricePerUnit: number;
	totalCost: number;
	isFullTank: boolean;
	fuelBrand?: string;
	stationName?: string;
	notes?: string;
	createdAt: Date;
}

export interface TripLog {
	id: string;
	vehicleId: string;
	date: string;
	distanceKm: number;
	durationMinutes?: number;
	avgSpeedKmh?: number;
	maxSpeedKmh?: number;
	hardBrakingCount: number;
	rapidAccelCount: number;
	idleMinutes: number;
	fuelConsumedLiters?: number;
	kwhConsumed?: number;
	tripType: 'city' | 'highway' | 'mixed' | 'manual';
	notes?: string;
	createdAt: Date;
}

export interface AiInsight {
	id: string;
	vehicleId: string;
	insightType: 'efficiency_prediction' | 'cost_forecast' | 'driving_analysis' | 'recommendation';
	title: string;
	description?: string;
	data?: unknown;
	confidence?: number;
	isRead: boolean;
	expiresAt?: Date;
	createdAt: Date;
}

export interface FuelPrice {
	id: string;
	region: string;
	fuelType: string;
	pricePerLiter: number;
	effectiveDate: string;
	source: string;
	createdAt: Date;
}

// Database
const db = new Dexie('DriveFuelDB') as Dexie & {
	vehicles: EntityTable<Vehicle, 'id'>;
	fuelLogs: EntityTable<FuelLog, 'id'>;
	tripLogs: EntityTable<TripLog, 'id'>;
	aiInsights: EntityTable<AiInsight, 'id'>;
	fuelPrices: EntityTable<FuelPrice, 'id'>;
};

db.version(1).stores({
	vehicles: 'id, name, fuelType, createdAt',
	fuelLogs: 'id, vehicleId, date, odometerKm, createdAt',
	tripLogs: 'id, vehicleId, date, createdAt',
	aiInsights: 'id, vehicleId, insightType, isRead, createdAt',
	fuelPrices: 'id, region, fuelType, effectiveDate'
});

export { db };
