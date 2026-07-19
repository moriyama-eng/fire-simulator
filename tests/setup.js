import { vi } from 'vitest';

// Mock HTMLAnchorElement.prototype.click to suppress navigation errors
if (typeof window !== 'undefined' && HTMLAnchorElement.prototype.click) {
  HTMLAnchorElement.prototype.click = vi.fn();
}

// Also mock other navigation-related methods as needed
if (typeof window !== 'undefined' && window.open) {
  window.open = vi.fn();
}