// Shapes the contract deliberately does not describe.
//
// A handful of antenna_sim parameters carry `x-ref` instead of a schema: the
// structure is validated by a backend module the contract points at. That
// pointer is useful to a developer reading the repository and useless to an
// agent forming a call — it cannot open a Python file, and a property
// published as an untyped `{}` with "see this path" is a parameter it cannot
// fill. v1.8.1's prose string did describe these shapes; the prose lives here,
// beside the contract rather than in place of it, until the contract itself
// carries them.
//
// Keep this map to structures the schemas cannot express. Anything the
// contract can state — a type, a range, an enum, a default — belongs in
// frontend/src/lib/tools/registry.ts and reaches the MCP through the
// generated schema.

export const STRUCTURE_SHAPES: Record<string, Record<string, string>> = {
  antenna_sim: {
    wires:
      'Array of {start:[x,y,z] in metres, end:[x,y,z] in metres, radius in metres, segments}. ' +
      'Each segment must be no longer than λ/10 and no shorter than 8 wire radii',
    feed: 'Object {wire, segment}, both 0-based: which wire the source drives, and which segment of it',
    ground:
      'Object {type: free_space | perfect | finite}, plus epsilonR and conductivity (S/m) when finite. ' +
      'Omit for free space',
    conductor:
      'Object {material: copper | aluminium | perfect | custom}, plus conductivity (S/m) when custom. ' +
      'Omit for copper',
    optimize:
      'Object for the NSGA-II search (pymoo): {populationSize 8-200, generations 1-200, lengthRange, spacingRange, ' +
      'maxBoomLength (m), goals, leadGoal, buildTolerance {mm 0.1-50, trials 10-200}, heightRange [low, high] (m)}. ' +
      'goals: [{figure: peakGain | frontToBack (180°) | frontToRear (worst lobe 90-270° behind the beam) | vswr | elevationGain, ' +
      'role: optimize | threshold | off, min (gains and ratios) or max (vswr) for a threshold, reading: worst | average (vswr), elevationDeg}], at most 3 optimised; ' +
      'elevationGain and heightRange need a ground. Omit goals for gain, F/B and VSWR with the 2:1 rule. ' +
      'Give freqStart/freqStop/freqPoints to read every goal across a band',
  },
};

/** The prose for one parameter's structure, when we carry it. */
export function structureShapeFor(jobType: string, param: string): string | undefined {
  return STRUCTURE_SHAPES[jobType]?.[param];
}
