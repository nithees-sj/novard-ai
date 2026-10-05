// Loaded by react-scripts before every test file.
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom (used by react-scripts' Jest) does not provide these.
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

beforeEach(() => localStorage.clear());

// jsdom does not implement layout; chat panels scroll their newest message into view.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// jsdom has no ResizeObserver; the hand-built SVG charts measure their width with it.
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

// jsdom has no matchMedia; the theme follows the device's light/dark setting with it.
// A test can replace it to simulate the device switching.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}
