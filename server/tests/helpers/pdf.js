/** Assemble numbered PDF objects into a file with a correct cross-reference table. */
function buildPdf(objects) {
  let body = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/**
 * A minimal, valid one-page PDF containing `text` (Helvetica), so the real PDF
 * parser can read it in tests.
 */
function makePdf(text) {
  const escaped = text.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
}

/** A one-page PDF with no text layer at all, like a scan (OCR is mocked in the tests that use it). */
function makeBlankPdf() {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ]);
}

/**
 * A real "scanned" page: `text` drawn into a grayscale bitmap and embedded as an
 * image, so the PDF has no text layer and only OCR can read it.
 */
function makeScannedPdf(text) {
  // Resolved through pdf-parse, which uses it to render pages.
  const { createCanvas } = require('@napi-rs/canvas');
  const width = 1700;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.font = '48px sans-serif';
  ctx.fillText(text, 40, 120);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = Buffer.alloc(width * height);
  for (let i = 0; i < gray.length; i += 1) gray[i] = rgba[i * 4];

  // Placed 510pt wide on a letter page (about 240 DPI for the bitmap).
  const draw = `q 510 0 0 60 51 700 cm /Im1 Do Q`;
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>',
    `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${gray.length} >>\nstream\n${gray.toString('latin1')}\nendstream`,
  ]);
}

module.exports = { makePdf, makeBlankPdf, makeScannedPdf };
