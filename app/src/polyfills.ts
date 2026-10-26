import { Buffer } from 'buffer';

// Polyfill Node.js globals for browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = (window as any).process || { env: {} };
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).global = globalThis;
}

export { Buffer };
