import * as L from 'leaflet';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

interface GrowiNode extends Node {
  name: string;
  type: string;
  attributes: {[key: string]: string}
  children: GrowiNode[];
  value: string;
}

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface GeoPoint {
  longitude: string;
  latitude: string;
}

const getGeoPoint = async(address: string): Promise<GeoPoint | null> => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.length > 0) {
    return {
      longitude: json[0].lon,
      latitude: json[0].lat,
    };
  }
  const res2 = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`);
  const json2 = await res2.json();
  if (json2.length > 0) {
    return {
      longitude: json2[0].geometry.coordinates[0],
      latitude: json2[0].geometry.coordinates[1],
    };
  }
  return null;
};

export const plugin: Plugin = function() {
  return (tree) => {
    visit(tree, 'leafGrowiPluginDirective', (node) => {
      const n = node as unknown as GrowiNode;
      let map: null | L.Map = null;
      try {
        const domId = `map-${Math.random().toString(36).slice(-8)}`;
        const address = Object.keys(n.attributes)[0];
        let { latitude, longitude } = n.attributes;
        n.type = 'html';
        n.value = `<div id="${domId}" style="height: 400px; width: 100%"></div>`;
        const id = setInterval(async() => {
          const mapDom = document.querySelector(`#${domId}`);
          if (mapDom == null) {
            return;
          }
          clearInterval(id);
          if (latitude == null || longitude == null) {
            const geoPoint = await getGeoPoint(address);
            if (geoPoint === null) {
              clearInterval(id);
              throw new Error(`Failed to get geo point ${address}`);
            }
            latitude = geoPoint.latitude;
            longitude = geoPoint.longitude;
          }
          if (map === null) {
            map = L.map(domId);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            }).addTo(map);
          }
          map.setView([parseFloat(latitude), parseFloat(longitude)], 13);
          const marker = L.marker([parseFloat(latitude), parseFloat(longitude)]);
          marker.bindPopup(address).openPopup();
          marker.addTo(map);
        }, 1000);
      }
      catch (e) {
        n.type = 'html';
        n.value = `<div style="color: red;">Error: ${(e as Error).message}</div>`;
      }
    });
  };
};
