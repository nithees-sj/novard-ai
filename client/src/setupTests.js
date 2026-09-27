// Loaded by react-scripts before every test file.
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom (used by react-scripts' Jest) does not provide these.
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

beforeEach(() => localStorage.clear());

// jsdom does not implement layout; chat panels scroll their newest message into view.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
