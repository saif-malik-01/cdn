export class LRUCache<K, V> {
  private max: number;
  private map: Map<K, V>;

  constructor(max: number) {
    this.max = max;
    this.map = new Map();
  }

  values(): MapIterator<V> {
    return this.map.values();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, val: V): V | undefined {
    let envictedEntry;
    const existValue = this.get(key);
    if (!existValue && this.map.size >= this.max) {
      const [firstKey, firstValue] = this.map.entries().next().value as [K, V];
      envictedEntry = firstValue;
      this.map.delete(firstKey);
    }
    this.map.set(key, val);
    return envictedEntry;
  }

  delete(key: K) {
    this.map.delete(key);
  }
}
