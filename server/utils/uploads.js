const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');
const logger = require('./logger');

/**
 * Where uploaded files live, and how their paths are stored.
 *
 * Paths used to be relative to the process's working directory, so starting
 * the server from the repo root wrote files to ./uploads and could not find
 * (or delete) them afterwards. They are now anchored to UPLOAD_DIR, and stored
 * on documents relative to the server root so they survive a move.
 */

const LEGACY_UPLOAD_ROOT = path.join(env.serverRoot, 'uploads');

function uploadDir(name) {
  const dir = path.join(env.uploadDir, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function toStoredPath(absolutePath) {
  const relative = path.relative(env.serverRoot, absolutePath);
  return relative.startsWith('..') || path.isAbsolute(relative) ? absolutePath : relative;
}

const resolveStoredPath = (stored) => (path.isAbsolute(stored) ? stored : path.resolve(env.serverRoot, stored));

function isInside(dir, file) {
  const relative = path.relative(dir, file);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Delete an uploaded file. Refuses anything outside the upload directories and never throws. */
async function removeUpload(stored) {
  if (!stored) return;
  const file = resolveStoredPath(stored);
  if (!isInside(env.uploadDir, file) && !isInside(LEGACY_UPLOAD_ROOT, file)) {
    logger.warn('Refused to delete a file outside the upload directory', { file });
    return;
  }
  await fs.promises.unlink(file).catch((error) => {
    if (error.code !== 'ENOENT') logger.warn('Could not delete an uploaded file', { file, error });
  });
}

/** True when the file starts with the given bytes (e.g. "%PDF-"). */
async function hasSignature(file, signature) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(signature.length);
    await handle.read(buffer, 0, signature.length, 0);
    return buffer.toString('latin1') === signature;
  } finally {
    await handle.close();
  }
}

module.exports = { uploadDir, toStoredPath, resolveStoredPath, removeUpload, hasSignature };
