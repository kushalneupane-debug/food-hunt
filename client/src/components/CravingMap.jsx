import { useEffect, useRef } from 'react';
import L from '../leaflet-global';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { categoryById, placeKind, splitSample } from '../categories';

// Free OpenStreetMap tiles. Their usage policy requires this credit to stay visible, and
// requires each request to say which site it comes from (see referrerPolicy in server/src/app.js).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Nearby pins merge into one bubble showing how many places are inside.
function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 40 : n < 30 ? 48 : 56;
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="cluster" style="width:${size}px;height:${size}px">${n}</span>`,
    iconSize: [size, size],
  });
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pinIcon(place, number, nearest) {
  const tone = categoryById(place.category || 'eat').color;
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin${nearest ? ' pin--nearest' : ''}" style="--tone:${tone}">
             <span class="pin__emoji">${placeKind(place).emoji}</span><span class="pin__n">${number}</span>
           </span>`,
    iconSize: nearest ? [52, 52] : [40, 40],
    iconAnchor: nearest ? [26, 52] : [20, 40],
  });
}

const youIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<span class="you-dot" aria-hidden="true"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/**
 * places: results in list order (pin numbers match the list).
 * origin: where the person is. focusId: the place to highlight. onSelect(id): pin tapped.
 */
export default function CravingMap({ places, origin, nearestId, focusId, onSelect }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const youLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const selectRef = useRef(onSelect);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    const map = L.map(boxRef.current, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layerRef.current = L.markerClusterGroup({
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      maxClusterRadius: 44,
      spiderfyOnMaxZoom: true,
    }).addTo(map);
    // "You are here" stays outside the clusters.
    youLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The box can change size with the layout (list/map switch on phones).
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(boxRef.current);
    return () => {
      resize.disconnect();
      map.remove();
    };
  }, []);

  // Redraw pins when the results or the location change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    layer.clearLayers();
    youLayerRef.current.clearLayers();
    markersRef.current.clear();

    const you = L.marker([origin.lat, origin.lng], { icon: youIcon, keyboard: false, zIndexOffset: -100 })
      .bindTooltip('You are here')
      .addTo(youLayerRef.current);

    places.forEach((p, i) => {
      const nearest = p.id === nearestId;
      const marker = L.marker([p.lat, p.lng], {
        icon: pinIcon(p, i + 1, nearest),
        title: splitSample(p.name).name,
        riseOnHover: true,
        zIndexOffset: nearest ? 500 : 0,
      })
        .bindTooltip(escapeHtml(splitSample(p.name).name), { direction: 'top', offset: [0, nearest ? -50 : -38] })
        .on('click', () => selectRef.current?.(p.id));
      markersRef.current.set(p.id, marker);
    });
    layer.addLayers([...markersRef.current.values()]);

    const points = [you.getLatLng(), ...places.map((p) => [p.lat, p.lng])];
    if (places.length === 0) map.setView(you.getLatLng(), 12);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [places, origin, nearestId]);

  // Highlight the focused place without moving the map on every hover.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement();
      if (el) el.classList.toggle('pin-wrap--focus', id === focusId);
      marker.setZIndexOffset(id === focusId ? 1000 : id === nearestId ? 500 : 0);
    }
    // Pan only to a pin that is actually drawn (not hidden inside a cluster bubble).
    const marker = markersRef.current.get(focusId);
    if (marker?.getElement() && !mapRef.current.getBounds().pad(-0.1).contains(marker.getLatLng())) {
      mapRef.current.panTo(marker.getLatLng());
    }
  }, [focusId, nearestId, places]);

  return <div ref={boxRef} className="map" role="region" aria-label="Map of matching places" />;
}
