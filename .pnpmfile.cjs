/**
 * pnpm hooks to handle optional native dependencies
 * This allows installation to succeed even when native modules fail to build on Windows
 */

function readPackage(pkg, context) {
  // Make sqlite3 and faiss-node install scripts non-blocking
  if (pkg.name === 'sqlite3' || pkg.name === 'faiss-node') {
    // Remove install scripts to prevent build failures from blocking installation
    if (pkg.scripts && pkg.scripts.install) {
      context.log(`Skipping build script for ${pkg.name} to allow cross-platform development`)
      delete pkg.scripts.install
    }
  }
  
  return pkg
}

module.exports = {
  hooks: {
    readPackage
  }
}
