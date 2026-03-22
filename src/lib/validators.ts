import { z } from 'zod/v4';

export const vehicleSchema = z.object({
	name: z.string().min(1, 'Vehicle name is required'),
	make: z.string().optional(),
	model: z.string().optional(),
	year: z.number().int().min(1900).max(2030).optional(),
	fuelType: z.enum(['gasoline', 'diesel', 'ev', 'hybrid']).default('gasoline'),
	tankCapacityLiters: z.number().positive().optional(),
	batteryCapacityKwh: z.number().positive().optional(),
	weightKg: z.number().positive().optional(),
	odometerKm: z.number().min(0).optional()
});

export const fuelLogSchema = z.object({
	vehicleId: z.string().uuid('Invalid vehicle'),
	date: z.string().min(1, 'Date is required'),
	odometerKm: z.number().positive('Odometer reading must be positive').optional(),
	liters: z.number().positive('Liters must be positive').optional(),
	kwh: z.number().positive('kWh must be positive').optional(),
	pricePerUnit: z.number().positive('Price must be positive'),
	totalCost: z.number().positive('Total cost must be positive'),
	isFullTank: z.boolean().default(true),
	fuelBrand: z.string().optional(),
	stationName: z.string().optional(),
	notes: z.string().optional()
});

export const tripLogSchema = z.object({
	vehicleId: z.string().uuid('Invalid vehicle'),
	date: z.string().min(1, 'Date is required'),
	distanceKm: z.number().positive('Distance must be positive'),
	durationMinutes: z.number().min(0).optional(),
	avgSpeedKmh: z.number().min(0).optional(),
	maxSpeedKmh: z.number().min(0).optional(),
	hardBrakingCount: z.number().int().min(0).default(0),
	rapidAccelCount: z.number().int().min(0).default(0),
	idleMinutes: z.number().min(0).default(0),
	fuelConsumedLiters: z.number().positive().optional(),
	kwhConsumed: z.number().positive().optional(),
	tripType: z.enum(['city', 'highway', 'mixed', 'manual']).default('mixed'),
	notes: z.string().optional()
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type FuelLogInput = z.infer<typeof fuelLogSchema>;
export type TripLogInput = z.infer<typeof tripLogSchema>;
