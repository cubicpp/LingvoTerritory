export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length, mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return num / Math.sqrt(dx2 * dy2);
}

export function mdsClassic(distMatrix: number[][]): number[][] {
  const n = distMatrix.length;
  const D2 = distMatrix.map((row) => row.map((v) => v * v));
  const J = Array.from({ length: n }, () => Array(n).fill(-1 / n));
  for (let i = 0; i < n; i++) J[i][i] += 1;
  const B: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) B[i][j] += J[i][k] * D2[k][j];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += B[i][k] * J[k][j];
      B[i][j] = -0.5 * sum;
    }

  function powerIteration(mat: number[][], k: number) {
    const dim = mat.length;
    const vecs: { vec: number[]; val: number }[] = [];
    for (let v = 0; v < k; v++) {
      let b = Array.from({ length: dim }, () => Math.random() * 2 - 1);
      let bNorm = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
      if (bNorm < 1e-10) { vecs.push({ vec: Array(dim).fill(0), val: 0 }); continue; }
      b = b.map((x) => x / bNorm);
      for (let iter = 0; iter < 200; iter++) {
        const bNew = Array(dim).fill(0);
        for (let i = 0; i < dim; i++)
          for (let j = 0; j < dim; j++) bNew[i] += mat[i][j] * b[j];
        for (const prev of vecs) {
          let dot = 0;
          for (let i = 0; i < dim; i++) dot += bNew[i] * prev.vec[i];
          for (let i = 0; i < dim; i++) bNew[i] -= dot * prev.vec[i];
        }
        bNorm = Math.sqrt(bNew.reduce((s, x) => s + x * x, 0));
        if (bNorm < 1e-12) break;
        b = bNew.map((x) => x / bNorm);
      }
      let lambda = 0;
      const mb = Array(dim).fill(0);
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) mb[i] += mat[i][j] * b[j];
        lambda += b[i] * mb[i];
      }
      vecs.push({ vec: b, val: Math.max(0, lambda) });
    }
    return vecs;
  }

  const eig = powerIteration(B, 2);
  const coords: number[][] = Array.from({ length: n }, () => [0, 0]);
  for (let v = 0; v < Math.min(2, eig.length); v++) {
    const sqrtLambda = Math.sqrt(Math.max(0, eig[v].val));
    for (let i = 0; i < n; i++) coords[i][v] = eig[v].vec[i] * sqrtLambda;
  }
  return coords;
}
