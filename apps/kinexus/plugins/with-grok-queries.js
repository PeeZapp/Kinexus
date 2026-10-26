const { withAndroidManifest } = require('@expo/config-plugins');

/** Lets a store build see the Grok app before opening it. */
function withGrokQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const queries = Array.isArray(manifest.queries) ? manifest.queries : [];
    const already = queries.some((entry) =>
      JSON.stringify(entry).includes('android:scheme":"grok"') || JSON.stringify(entry).includes('android:scheme\':\'grok\''),
    );
    if (!already) {
      queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            data: [{ $: { 'android:scheme': 'grok' } }],
          },
        ],
      });
    }
    manifest.queries = queries;
    return config;
  });
}

module.exports = withGrokQueries;
