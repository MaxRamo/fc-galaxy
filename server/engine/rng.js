'use strict';

class Rng {
  constructor(seed) {
    this.seed = seed != null ? seed >>> 0 : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this._a = this.seed;
  }

  float() {
    let a = (this._a = (this._a + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + this.float() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[Math.floor(this.float() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  gauss(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = this.float();
    while (v === 0) v = this.float();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  id(prefix) {
    return prefix + '-' + Math.floor(this.float() * 0xffffffff).toString(36) + Math.floor(this.float() * 0xffff).toString(36);
  }
  toJSON() { return { _rngState: this._a, seed: this.seed }; }
  static fromJSON(data) {
    const r = new Rng(data.seed);
    if (data && typeof data._rngState === 'number') r._a = data._rngState;
    return r;
  }
}

module.exports = { Rng };
