const fs = require('fs');
const os = require('os');
const path = require('path');
const { _internal: notes } = require('../../services/notesService');
const { terminateOcr } = require('../../services/ocrService');
const { makePdf, makeScannedPdf } = require('../helpers/pdf');

/**
 * Real Tesseract, end to end: render a scanned page and read it back. It loads
 * the OCR engine (a few seconds), so it runs only with RUN_OCR_TESTS=1.
 */
const describeOcr = process.env.RUN_OCR_TESTS === '1' ? describe : describe.skip;

describeOcr('OCR of scanned PDFs (real Tesseract)', () => {
  let dir;
  const write = (name, buffer) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, buffer);
    return file;
  };

  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-test-')); });
  afterAll(async () => {
    await terminateOcr();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the text of a page that is only an image', async () => {
    const text = await notes.extractPdfText(write('scan.pdf', makeScannedPdf('Mitochondria is the powerhouse of the cell')));
    expect(text).toMatch(/Mitochondria is the powerhouse of the cell/);
  });

  it('still reads typed PDFs from the text layer', async () => {
    const text = await notes.extractPdfText(write('typed.pdf', makePdf('Photosynthesis converts light energy.')));
    expect(text).toBe('Photosynthesis converts light energy.\n\n-- 1 of 1 --');
  });
});
