const { withAndroidManifest } = require('@expo/config-plugins');

/** Lets a store build see the Grok Bot app before opening it. */
function withGrokQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const queries = Array.isArray(manifest.queries) ? manifest.queries : [];
    const already = queries.some((entry) =>
      JSON.stringify(entry).includes('android:scheme":"grokbot"') || JSON.stringify(entry).includes("android:scheme':'grokbot'"),
    );
    if (!already) {
      queries.push({
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            data: [{ $: { 'android:scheme': 'grokbot' } }],
          },
        ],
      });
    }
    manifest.queries = queries;
    return config;
  });
}

module.exports = withGrokQueries;
