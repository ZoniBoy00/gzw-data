const API_VERSION = 'v1';
const IMPLEMENTATION_VERSION = '4.3.0';

function versionInfo(dataVersion = null) {
  return {
    apiVersion: API_VERSION,
    implementationVersion: IMPLEMENTATION_VERSION,
    dataVersion,
  };
}

module.exports = { API_VERSION, IMPLEMENTATION_VERSION, versionInfo };
