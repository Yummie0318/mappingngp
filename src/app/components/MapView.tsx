'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import exifr from 'exifr';
import L, { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Menu, X } from 'lucide-react';

// ✅ Dynamic imports
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false });

interface PhotoMarker {
  lat: number;
  lng: number;
  url: string;
  name: string;
}

export default function MapView() {
  const [geoData, setGeoData] = useState<GeoJSON.GeoJsonObject[]>([]);
  const [trackingData, setTrackingData] = useState<GeoJSON.GeoJsonObject[]>([]);
  const [photoMarkers, setPhotoMarkers] = useState<PhotoMarker[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([17.6131, 121.7270]);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [showPanel, setShowPanel] = useState<boolean>(false);

  // 📦 Upload KMZ
  const handleKmzFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const geojsonList: GeoJSON.GeoJsonObject[] = [];

    for (const file of Array.from(files)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
        if (!kmlFile) continue;

        const kmlText = await zip.files[kmlFile].async('text');
        const parser = new DOMParser();
        const kmlDom = parser.parseFromString(kmlText, 'text/xml');
        const geojson = toGeoJSON.kml(kmlDom);
        geojsonList.push(geojson);
      } catch (error) {
        console.error('Error reading KMZ:', error);
      }
    }
    setGeoData(prev => [...prev, ...geojsonList]);
  };

  // 🗺️ Upload KML tracks
  const handleTrackingFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const geojsonList: GeoJSON.GeoJsonObject[] = [];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const kmlDom = parser.parseFromString(text, 'text/xml');
        const geojson = toGeoJSON.kml(kmlDom);
        geojsonList.push(geojson);
      } catch (error) {
        console.error('Error reading KML:', error);
      }
    }
    setTrackingData(prev => [...prev, ...geojsonList]);
  };

  // 📸 Handle Photos
  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const markers: PhotoMarker[] = [];

    for (const file of Array.from(files)) {
      try {
        const exifData = await exifr.gps(file);
        if (exifData?.latitude && exifData?.longitude) {
          markers.push({
            lat: exifData.latitude,
            lng: exifData.longitude,
            url: URL.createObjectURL(file),
            name: file.name,
          });
        }
      } catch {
        console.warn('No GPS data found in', file.name);
      }
    }

    if (!markers.length) return alert('No geotagged photos found!');
    setPhotoMarkers(prev => [...prev, ...markers]);
  };

  // 🧭 Auto center
  useEffect(() => {
    if (!geoData.length && !trackingData.length && !photoMarkers.length) return;

    const bounds = L.latLngBounds([]);
    geoData.forEach(g => bounds.extend(L.geoJSON(g).getBounds()));
    trackingData.forEach(t => bounds.extend(L.geoJSON(t).getBounds()));
    photoMarkers.forEach(p => bounds.extend([p.lat, p.lng]));
    if (bounds.isValid()) setMapCenter(bounds.getCenter());
  }, [geoData, trackingData, photoMarkers]);

  // ♻️ Clear all
  const handleClearAll = () => {
    setGeoData([]);
    setTrackingData([]);
    setPhotoMarkers([]);
    setMapCenter([17.6131, 121.7270]);
  };

  return (
    <div className="relative h-screen w-full">
      {/* Toggle Button (Mobile) */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="absolute top-4 right-4 z-[1100] bg-white shadow-md p-2 rounded-full md:hidden"
      >
        {showPanel ? <X size={22} /> : <Menu size={22} />}
      </button>
  
      {/* Control Panel */}
      <div
        className={`absolute top-5 left-5 z-[1000] flex flex-col md:gap-4 gap-3 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-gray-200 w-[280px]
        transition-all duration-300 md:block ${showPanel ? 'block' : 'hidden'}`}
      >
        <h2 className="text-lg font-bold text-gray-700 mb-3">📁 Map Controls</h2>
  
        <div className="flex flex-col gap-3">
          <label className="upload-btn">
            🌐 Upload Boundaries (.KMZ)
            <input type="file" accept=".kmz" multiple onChange={handleKmzFiles} className="hidden" />
          </label>
  
          <label className="upload-btn">
            🛰️ Upload Tracks (.KML)
            <input type="file" accept=".kml" multiple onChange={handleTrackingFiles} className="hidden" />
          </label>
  
          <label className="upload-btn">
            📸 Upload Geotagged Photos
            <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          </label>
  
          <button
            onClick={handleClearAll}
            className="mt-1 w-full text-sm bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition-all"
          >
            🗑️ Clear Inputs
          </button>
        </div>
  
        <div className="flex items-center justify-between mt-3 bg-gray-100 p-2 rounded-lg">
          <span className="text-sm font-medium text-gray-700">🗺️ View:</span>
          <button
            onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-md transition-all"
          >
            {mapType === 'street' ? 'Satellite' : 'Street'}
          </button>
        </div>
  
        <div className="mt-3 text-xs text-gray-600 border-t border-gray-200 pt-2 leading-relaxed">
          <p>⭐ <strong>Upload tracks</strong> as .KML</p>
          <p>⭐ <strong>Upload photos</strong> with GPS data</p>
          <p className="mt-2 italic text-gray-500">📞 Contact: <strong>Joylyn Madriaga</strong></p>
        </div>
      </div>
  
      {/* Map */}
      <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
        {mapType === 'street' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
  
        {geoData.map((geo, i) => (
          <GeoJSON key={`geo-${i}`} data={geo} pathOptions={{ color: '#007bff', weight: 2, fillOpacity: 0.2 }} />
        ))}
  
        {trackingData.map((track, i) => (
          <GeoJSON key={`track-${i}`} data={track} pathOptions={{ color: 'green', weight: 3 }} />
        ))}
  
        {photoMarkers.map((photo, i) => (
          <CircleMarker
            key={i}
            center={[photo.lat, photo.lng]}
            radius={6}
            pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.85 }}
          >
            <Popup>
              <div className="text-center">
                <strong>{photo.name}</strong>
                <br />
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="mt-2 rounded-md shadow-md"
                  style={{ width: '150px', height: 'auto' }}
                />
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
  
      <style jsx>{`
        .upload-btn {
          display: block;
          background: linear-gradient(to right, #2563eb, #1e3a8a);
          color: white;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 500;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .upload-btn:hover {
          background: linear-gradient(to right, #1d4ed8, #1e40af);
          transform: scale(1.03);
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
        }
      `}</style>
    </div>
  );
  
}
