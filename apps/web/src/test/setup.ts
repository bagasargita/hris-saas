import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Radix primitives use these browser APIs, which jsdom does not implement.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
for (const [name, impl] of [
  ['hasPointerCapture', () => false],
  ['scrollIntoView', () => undefined],
] as const) {
  if (!(name in Element.prototype))
    Object.defineProperty(Element.prototype, name, { value: impl, configurable: true });
}
