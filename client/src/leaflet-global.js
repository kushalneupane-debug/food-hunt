// leaflet.markercluster is an older plugin that looks for Leaflet on window.L.
// Importing this file first makes that work with Vite's ES modules.
import L from 'leaflet';

window.L = L;
export default L;
