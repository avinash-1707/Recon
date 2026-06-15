/**
 * Fixed-capacity object pool. Pre-allocates all slots up front so the hot loop
 * never allocates. Callers acquire a free slot index, drive it, then release it.
 * Iterate active slots with `forEachActive`.
 */
export class FixedPool<T> {
  private readonly busy: boolean[];

  private constructor(public readonly items: readonly T[]) {
    this.busy = new Array(items.length).fill(false);
  }

  static create<T>(size: number, factory: (index: number) => T): FixedPool<T> {
    const items: T[] = new Array(size);
    for (let i = 0; i < size; i++) items[i] = factory(i);
    return new FixedPool(items);
  }

  /** First free slot index, or -1 if exhausted (caller decides to skip/recycle). */
  acquire(): number {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.busy[i]) {
        this.busy[i] = true;
        return i;
      }
    }
    return -1;
  }

  release(index: number): void {
    if (index >= 0 && index < this.busy.length) this.busy[index] = false;
  }

  isActive(index: number): boolean {
    return this.busy[index];
  }

  get size(): number {
    return this.items.length;
  }

  forEachActive(cb: (item: T, index: number) => void): void {
    for (let i = 0; i < this.items.length; i++) {
      if (this.busy[i]) cb(this.items[i], i);
    }
  }
}
