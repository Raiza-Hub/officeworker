type BillingTestMatchers = {
  toBe(expected: unknown): void;
  toBeCloseTo(expected: number, digits?: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeNull(): void;
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
};

declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: unknown): BillingTestMatchers;
}
