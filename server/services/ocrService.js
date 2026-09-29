const path = require('path');
const { createWorker, OEM, PSM } = require('tesseract.js');
const logger = require('../utils/logger');

/**
 * OCR for page images (scanned PDF pages), via Tesseract.
 *
 * One worker is created on first use and reused: loading the engine and the
 * language model is the slow part, so later pages only pay for recognition.
 * A worker runs one job at a time, which also keeps memory bounded.
 *
 * The English LSTM "best" model ships inside @tesseract.js-data/eng, so
 * nothing is downloaded at runtime and nothing is written to disk.
 */

const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/eng')), '4.0.0_best_int');

/** Pages are rendered at roughly this resolution; telling Tesseract saves it guessing. */
const RENDER_DPI = 300;

let workerPromise = null;
// Jobs are chained so they never overlap on the single worker.
let queue = Promise.resolve();

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        langPath: LANG_PATH,
        gzip: true,
        cacheMethod: 'none',
        errorHandler: (error) => logger.warn('OCR worker error', error),
      });
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
        user_defined_dpi: String(RENDER_DPI),
      });
      return worker;
    })().catch((error) => {
      workerPromise = null; // let the next upload try again
      throw error;
    });
  }
  return workerPromise;
}

/** Recognise the text in one page image (PNG buffer). Returns { text, confidence 0-100 }. */
function recognizePage(image) {
  const job = queue.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(Buffer.from(image));
    return { text: (data.text || '').trim(), confidence: Number(data.confidence) || 0 };
  });
  queue = job.catch(() => {});
  return job;
}

/** Stop the worker (graceful shutdown). Safe to call when OCR was never used. */
async function terminateOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    await (await pending).terminate();
  } catch (error) {
    logger.warn('Could not stop the OCR worker', error);
  }
}

module.exports = { recognizePage, terminateOcr, RENDER_DPI };
