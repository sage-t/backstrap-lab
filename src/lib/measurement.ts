import type { DisplayUnit } from '$lib/scaling';

export type WeightPreference = 'metric_g' | 'imperial_lb_oz';
export type VolumePreference = 'metric_ml' | 'kitchen_us';

export type MeasurementPreferences = {
  weightPreference: WeightPreference;
  volumePreference: VolumePreference;
};

export const DEFAULT_MEASUREMENT_PREFERENCES: MeasurementPreferences = {
  weightPreference: 'metric_g',
  volumePreference: 'metric_ml'
};

const GRAMS_PER_OUNCE = 28.349523125;
const OUNCES_PER_POUND = 16;
const ML_PER_TSP = 4.92892;
const TSP_PER_TBSP = 3;
const TSP_PER_CUP = 48;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatNumber(value: number, maxFractionDigits = 3): string {
  return Number(value.toFixed(maxFractionDigits)).toString();
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function formatTspFraction(tsp: number): string {
  const rounded = roundTo(tsp, 0.125);
  const whole = Math.floor(rounded + 1e-9);
  const eighths = Math.round((rounded - whole) * 8);
  if (eighths <= 0) return String(whole);
  if (whole <= 0) {
    const divisor = gcd(eighths, 8);
    return `${eighths / divisor}/${8 / divisor}`;
  }
  const divisor = gcd(eighths, 8);
  return `${whole} ${eighths / divisor}/${8 / divisor}`;
}

function compactWeightMetric(grams: number): string {
  const rounded = grams < 50 ? roundTo(grams, 0.1) : roundTo(grams, 1);
  return `${formatNumber(rounded, rounded < 50 ? 1 : 0)} g`;
}

function compactVolumeMetric(ml: number): string {
  return `${formatNumber(roundTo(ml, 1), 0)} ml`;
}

function compactWeightImperial(grams: number): string {
  const sign = grams < 0 ? '-' : '';
  const totalOz = Math.abs(grams) / GRAMS_PER_OUNCE;
  if (totalOz < OUNCES_PER_POUND) {
    const step = totalOz < 1 ? 0.01 : 0.25;
    let roundedOz = roundTo(totalOz, step);
    if (roundedOz <= 0 && totalOz > 0) roundedOz = step;
    return `${sign}${formatNumber(roundedOz, step < 0.1 ? 2 : 2)} oz`;
  }

  let pounds = Math.floor(totalOz / OUNCES_PER_POUND);
  let ounces = roundTo(totalOz - pounds * OUNCES_PER_POUND, 0.25);
  if (ounces >= OUNCES_PER_POUND) {
    pounds += 1;
    ounces = 0;
  }

  if (ounces < 0.125) return `${sign}${pounds} lb`;
  return `${sign}${pounds} lb ${formatNumber(ounces, 2)} oz`;
}

function compactVolumeKitchen(ml: number): string {
  const sign = ml < 0 ? '-' : '';
  let totalTsp = Math.abs(ml) / ML_PER_TSP;

  let cups = Math.floor(totalTsp / TSP_PER_CUP);
  totalTsp -= cups * TSP_PER_CUP;

  let tbsp = Math.floor(totalTsp / TSP_PER_TBSP);
  totalTsp -= tbsp * TSP_PER_TBSP;

  let tsp = roundTo(totalTsp, 0.125);
  if (tsp >= TSP_PER_TBSP) {
    tbsp += Math.floor(tsp / TSP_PER_TBSP);
    tsp = roundTo(tsp % TSP_PER_TBSP, 0.125);
  }
  if (tbsp >= TSP_PER_CUP / TSP_PER_TBSP) {
    cups += Math.floor(tbsp / (TSP_PER_CUP / TSP_PER_TBSP));
    tbsp %= TSP_PER_CUP / TSP_PER_TBSP;
  }

  if (cups === 0 && tbsp === 0 && tsp === 0 && Math.abs(ml) > 0) tsp = 0.125;

  const parts: string[] = [];
  if (cups > 0) parts.push(`${cups} cup${cups === 1 ? '' : 's'}`);
  if (tbsp > 0) parts.push(`${tbsp} tbsp`);
  if (tsp > 0) parts.push(`${formatTspFraction(tsp)} tsp`);

  return `${sign}${parts.length > 0 ? parts.join(' ') : '0 tsp'}`;
}

function volumeToMl(amount: number, unit: 'ml' | 'tsp' | 'tbsp'): number {
  if (unit === 'ml') return amount;
  if (unit === 'tsp') return amount * ML_PER_TSP;
  return amount * ML_PER_TSP * TSP_PER_TBSP;
}

export function isWeightPreference(value: unknown): value is WeightPreference {
  return value === 'metric_g' || value === 'imperial_lb_oz';
}

export function isVolumePreference(value: unknown): value is VolumePreference {
  return value === 'metric_ml' || value === 'kitchen_us';
}

export function normalizeMeasurementPreferences(value: Partial<MeasurementPreferences> | null | undefined): MeasurementPreferences {
  const weight = isWeightPreference(value?.weightPreference)
    ? value.weightPreference
    : DEFAULT_MEASUREMENT_PREFERENCES.weightPreference;
  const volume = isVolumePreference(value?.volumePreference)
    ? value.volumePreference
    : DEFAULT_MEASUREMENT_PREFERENCES.volumePreference;
  return { weightPreference: weight, volumePreference: volume };
}

export function formatWeightFromGrams(grams: number, prefs: MeasurementPreferences): string {
  if (prefs.weightPreference === 'imperial_lb_oz') return compactWeightImperial(grams);
  return compactWeightMetric(grams);
}

export function formatVolumeFromMl(ml: number, prefs: MeasurementPreferences): string {
  if (prefs.volumePreference === 'kitchen_us') return compactVolumeKitchen(ml);
  return compactVolumeMetric(ml);
}

export function formatIngredientAmount(
  amount: number,
  unit: DisplayUnit,
  prefs: MeasurementPreferences
): string {
  if (unit === 'g') return formatWeightFromGrams(amount, prefs);
  return formatVolumeFromMl(volumeToMl(amount, unit), prefs);
}

export function formatRatioPerBase(
  amountGramsPerBase: number | null,
  amountMlPerBase: number | null,
  prefs: MeasurementPreferences
): string {
  if (amountGramsPerBase !== null) return `${formatWeightFromGrams(amountGramsPerBase, prefs)}/base`;
  if (amountMlPerBase !== null) return `${formatVolumeFromMl(amountMlPerBase, prefs)}/base`;
  return '-';
}
