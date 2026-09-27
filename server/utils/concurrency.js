/**
 * Map over items with at most `limit` calls in flight, keeping results in
 * input order. Used for batches of external lookups (YouTube searches), which
 * were either fully sequential (slow) or all fired at once (rate-limited).
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index); // eslint-disable-line no-await-in-loop
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

module.exports = { mapWithConcurrency };
