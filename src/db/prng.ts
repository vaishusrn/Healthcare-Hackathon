// Deterministic PRNG (mulberry32). Given the same seed, `mulberry32` always
// produces the same sequence of pseudo-random numbers in [0, 1). This is what
// lets `generateStructure()` in `seed-data.ts` be fully reproducible across
// runs and machines: no `Math.random()`, no wall-clock, just index-derived
// state plus this seeded generator.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
