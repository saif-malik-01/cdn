export class LRUCache<K, V> {
  private max: number;
  private map: Map<K, V>;

  constructor(max: number) {
    this.max = max;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, val: V) {
    if (this.map.size >= this.max) {
      const firstKey = this.map.keys().next().value!;
      this.map.delete(firstKey);
    }
    this.map.set(key, val);
  }

  delete(key: K) {
    this.map.delete(key);
  }
}
