export type DisplayUnit = 'g' | 'ml' | 'tsp' | 'tbsp';

export type ScaleInputRow = {
  ingredientId: number;
  ingredientName: string;
  amountGramsPerBase: number | null;
  amountMlPerBase: number | null;
  defaultDisplayUnit: DisplayUnit;
  displayUnitOverride: DisplayUnit | null;
  gramsPerMl: number | null;
  gramsPerTsp: number | null;
};

export type ScaledIngredient = {
  ingredientId: number;
  ingredientName: string;
  factor: number;
  displayAmount: number;
  displayUnit: DisplayUnit;
  warning: string | null;
  sourceAmountGrams: number | null;
  sourceAmountMl: number | null;
};

const ML_PER_TSP = 4.92892;
const TSP_PER_TBSP = 3;

export function tspToMl(tsp: number): number {
  return tsp * ML_PER_TSP;
}

export function mlToTsp(ml: number): number {
  return ml / ML_PER_TSP;
}

export function tbspToTsp(tbsp: number): number {
  return tbsp * TSP_PER_TBSP;
}

export function tspToTbsp(tsp: number): number {
  return tsp / TSP_PER_TBSP;
}

function resolveGramsPerMl(gramsPerMl: number | null, gramsPerTsp: number | null): number | null {
  if (gramsPerMl && gramsPerMl > 0) return gramsPerMl;
  if (gramsPerTsp && gramsPerTsp > 0) return gramsPerTsp / ML_PER_TSP;
  return null;
}

export function gramsToMl(
  grams: number,
  gramsPerMl: number | null,
  gramsPerTsp: number | null
): number | null {
  const resolved = resolveGramsPerMl(gramsPerMl, gramsPerTsp);
  if (!resolved) return null;
  return grams / resolved;
}

export function mlToGrams(
  ml: number,
  gramsPerMl: number | null,
  gramsPerTsp: number | null
): number | null {
  const resolved = resolveGramsPerMl(gramsPerMl, gramsPerTsp);
  if (!resolved) return null;
  return ml * resolved;
}

function roundNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function roundGrams(value: number): number {
  return value < 50 ? roundNearest(value, 0.1) : roundNearest(value, 1);
}

export function roundMl(value: number): number {
  return roundNearest(value, 1);
}

export function roundTsp(value: number): number {
  return roundNearest(value, 0.125);
}

export function roundTbsp(value: number): number {
  return roundNearest(value, 0.25);
}

export function scaleIngredients(params: {
  baseMeatGrams: number;
  targetMeatGrams: number;
  rows: ScaleInputRow[];
}): ScaledIngredient[] {
  const factor = params.baseMeatGrams > 0 ? params.targetMeatGrams / params.baseMeatGrams : 1;

  return params.rows.map((row) => {
    const scaledGrams = row.amountGramsPerBase !== null ? row.amountGramsPerBase * factor : null;
    const scaledMl = row.amountMlPerBase !== null ? row.amountMlPerBase * factor : null;
    const displayUnit = row.displayUnitOverride ?? row.defaultDisplayUnit;

    const fromGrams = scaledGrams !== null;
    const sourceDisplayUnit: DisplayUnit = fromGrams ? 'g' : 'ml';
    const sourceAmount = fromGrams ? scaledGrams! : scaledMl!;

    const asMl = fromGrams
      ? gramsToMl(scaledGrams!, row.gramsPerMl, row.gramsPerTsp)
      : scaledMl;

    const asGrams = fromGrams
      ? scaledGrams
      : mlToGrams(scaledMl!, row.gramsPerMl, row.gramsPerTsp);

    let amount: number;
    let unit: DisplayUnit = displayUnit;
    let warning: string | null = null;

    if (displayUnit === 'g') {
      if (asGrams === null) {
        amount = sourceAmount;
        unit = sourceDisplayUnit;
        warning = 'no density set';
      } else {
        amount = roundGrams(asGrams);
      }
    } else if (displayUnit === 'ml') {
      if (asMl === null) {
        amount = sourceAmount;
        unit = sourceDisplayUnit;
        warning = 'no density set';
      } else {
        amount = roundMl(asMl);
      }
    } else if (displayUnit === 'tsp') {
      if (asMl === null) {
        amount = sourceAmount;
        unit = sourceDisplayUnit;
        warning = 'no density set';
      } else {
        amount = roundTsp(mlToTsp(asMl));
      }
    } else {
      if (asMl === null) {
        amount = sourceAmount;
        unit = sourceDisplayUnit;
        warning = 'no density set';
      } else {
        amount = roundTbsp(tspToTbsp(mlToTsp(asMl)));
      }
    }

    return {
      ingredientId: row.ingredientId,
      ingredientName: row.ingredientName,
      factor,
      displayAmount: amount,
      displayUnit: unit,
      warning,
      sourceAmountGrams: scaledGrams,
      sourceAmountMl: scaledMl
    };
  });
}
