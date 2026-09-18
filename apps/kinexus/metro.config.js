const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch only app-imported workspace sources. Watching the monorepo root also
// crawls root node_modules (Windows pnpm hardlinks throw EINVAL on readlink)
// and the multi-MB catalog SQL/JSON dumps.
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/db/src'),
  path.resolve(workspaceRoot, 'packages/domain'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const extraBlockList = [
  /packages[\\/]db[\\/]supabase[\\/].*/,
  /packages[\\/]db[\\/]seeds[\\/].*/,
  /packages[\\/]db[\\/]scripts[\\/].*/,
];

const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  ...extraBlockList,
];

module.exports = config;
