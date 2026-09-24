/**
 * Deprecated: seed catalog recipes no longer use estimated TheMealDB stand-in photos.
 * They display their emoji instead (see migration 20260924120000_clear_seed_estimated_images.sql).
 * Authentic TheMealDB catalog imports still ship with their own image_url via import-themealdb.
 */
console.error(
  'assign-catalog-images is retired. Seed catalog recipes use emojis, not estimated internet photos.',
);
process.exit(1);
