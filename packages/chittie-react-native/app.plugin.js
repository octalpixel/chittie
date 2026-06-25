// Expo config plugin (pass-through). chittie-react-native is a Nitro native module
// picked up by autolinking on `expo prebuild` / in a dev client — no extra native
// config is required. This exists so it can be listed in app.json `plugins` without
// error if a project prefers to be explicit.
module.exports = (config) => config;
