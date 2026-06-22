// SPIKE: prove the vendored code-page encoder produces correct ESC/POS bytes.
import assert from 'node:assert/strict';
import CodepageEncoder from '../src/index.js';

const hex = (u8) => Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join(' ');

// ASCII in cp437 is 1:1
const hello = CodepageEncoder.encode('Hello', 'cp437');
assert.deepEqual(Array.from(hello), [0x48, 0x65, 0x6c, 0x6c, 0x6f], 'cp437 "Hello"');

// A Latin-1 accented char encodes to a single cp858 byte (not "?")
const accented = CodepageEncoder.encode('é', 'cp858');
assert.equal(accented.length, 1, 'é is one byte in cp858');
assert.notEqual(accented[0], 0x3f, 'é is not "?" in cp858');

// Capability + breadth checks
assert.equal(CodepageEncoder.supports('cp858'), true);
assert.ok(CodepageEncoder.getEncodings().length >= 70, 'has the full code-page set');

// Confirms the research finding: Sinhala has NO code page -> "?" (this is why we raster)
const sinhala = CodepageEncoder.encode('ආයුබෝවන්', 'cp437');
assert.ok(Array.from(sinhala).every((b) => b === 0x3f), 'Sinhala -> all "?" (no codepage)');

console.log('✓ chittie-codepage spike');
console.log('  cp437 "Hello" =', hex(hello));
console.log('  cp858 "é"     =', hex(accented));
console.log('  codepages     =', CodepageEncoder.getEncodings().length);
console.log('  Sinhala       = all 0x3f ("?") — confirms raster-only, as researched');
