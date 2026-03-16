// simple seeded PRNG utilities for deterministic testing
// Usage: call seedRandom(seed) at game start, then use rand(), randint(a,b), shuffle(array)
let _seed = 1;

export function seedRandom(seed) {
  _seed = typeof seed === 'number' ? seed >>> 0 : hashString(String(seed));
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// mulberry32
function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _rng = mulberry32(_seed);

export function rand() {
  return _rng();
}

export function randint(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function reseed(seed) {
  seedRandom(seed);
  _rng = mulberry32(_seed);
}
