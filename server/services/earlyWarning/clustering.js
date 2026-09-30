/**
 * Topic clustering: a faithful port of EWDI app/ingest/embed.py cluster(),
 * pure and dependency-free.
 *
 *   1. L2-normalise every vector
 *   2. greedy seeding: a vector whose best cosine to the existing centroids
 *      is below tau starts a new cluster (stop at maxCentroids)
 *   3. assign each vector to its nearest centroid
 *   4. refine each centroid to its members' mean once, renormalise, reassign
 *   5. keep clusters with at least minCluster members (or, if none, the largest)
 */

const EPS = 1e-9; // numpy: X /= (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
};

function normalize(v) {
  const norm = Math.sqrt(dot(v, v)) + EPS;
  return v.map((x) => x / norm);
}

/** Index of the largest value (the first one on a tie, like numpy argmax). */
function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) if (values[i] > values[best]) best = i;
  return best;
}

const assignAll = (X, C) => X.map((x) => argmax(C.map((c) => dot(c, x))));

/**
 * @param {number[][]} vectors
 * @returns {{ centroids: number[][], assign: number[], counts: number[], keep: number[] }}
 *   `keep` lists the cluster indexes that survive, ascending.
 */
function greedyCluster(vectors, { tau = 0.75, minCluster = 15, maxCentroids = 300 } = {}) {
  if (!vectors.length) return { centroids: [], assign: [], counts: [], keep: [] };
  const X = vectors.map(normalize);

  const seeds = [];
  for (let i = 0; i < X.length; i += 1) {
    if (!seeds.length) {
      seeds.push([...X[i]]);
    } else {
      const best = Math.max(...seeds.map((c) => dot(c, X[i])));
      if (best < tau) seeds.push([...X[i]]);
      if (seeds.length >= maxCentroids) break;
    }
  }

  let C = seeds;
  let assign = assignAll(X, C);

  // refine once, then drop clusters too small to mean anything
  C = C.map((c, k) => {
    const members = X.filter((_, i) => assign[i] === k);
    if (!members.length) return c;
    return c.map((_, d) => members.reduce((s, m) => s + m[d], 0) / members.length);
  }).map(normalize);
  assign = assignAll(X, C);

  const counts = C.map((_, k) => assign.filter((a) => a === k).length);
  let keep = counts.map((n, k) => (n >= minCluster ? k : -1)).filter((k) => k >= 0);
  if (!keep.length) keep = [argmax(counts)];
  return { centroids: C, assign, counts, keep };
}

/** Cosine similarity of two vectors (not assumed normalised). */
const cosine = (a, b) => dot(a, b) / ((Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b))) || 1);

module.exports = { greedyCluster, normalize, cosine, argmax, dot };
