import React, { useEffect, useRef } from 'react';
import { Coordinates } from '../types';

// Declare L globally as it is loaded via script tag
declare const L: any;

interface MapVisualizationProps {
  coordinates?: Coordinates; // Cargo coordinates
  destinationCoordinates?: Coordinates; // Destination coordinates
  userLocation?: Coordinates | null; // User GPS coordinates
  className?: string;
  loading?: boolean;
}

const MapVisualization: React.FC<MapVisualizationProps> = React.memo(({ coordinates, destinationCoordinates, userLocation, className, loading }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    
    // Check if container has dimensions before init to prevent "grey box"
    if (mapContainerRef.current.clientHeight === 0) return;

    // Create Map with optimization options
    const map = L.map(mapContainerRef.current, {
        center: [-14.2350, -51.9253], // Center of Brazil
        zoom: 4,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true // Performance boost for markers/lines
    });

    // Standard OpenStreetMap (Colorful & Detailed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        className: 'map-tiles'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size after small delay to ensure correct render
    setTimeout(() => {
        map.invalidateSize();
    }, 300);

    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
    };
  }, []);

  // Resize observer to handle container size changes (responsive layout)
  useEffect(() => {
      if (!mapInstanceRef.current || !mapContainerRef.current) return;
      
      const resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize();
          }
      });
      
      resizeObserver.observe(mapContainerRef.current);
      
      return () => resizeObserver.disconnect();
  }, []);

  // Update Markers and Lines
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Clear existing layers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];

    const bounds = L.latLngBounds([]);

    // 1. Add User Marker (Blue)
    if (userLocation) {
        const userIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="relative flex items-center justify-center w-6 h-6">
                     <div class="relative w-3 h-3 bg-blue-600 border-2 border-white rounded-full shadow-lg"></div>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(map)
            .bindPopup("<b>VOCÊ ESTÁ AQUI</b><br>GPS Ativo.");
        
        markersRef.current.push(userMarker);
        bounds.extend([userLocation.lat, userLocation.lng]);
    }

    // 2. Add Destination Marker (Red)
    if (destinationCoordinates && (destinationCoordinates.lat !== 0 || destinationCoordinates.lng !== 0)) {
        const destIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="relative flex items-center justify-center w-6 h-6">
                     <div class="relative w-4 h-4 bg-red-600 border-2 border-white rounded-sm transform rotate-45 shadow-md"></div>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const destMarker = L.marker([destinationCoordinates.lat, destinationCoordinates.lng], { icon: destIcon })
            .addTo(map)
            .bindPopup("<b>DESTINO</b>");

        markersRef.current.push(destMarker);
        bounds.extend([destinationCoordinates.lat, destinationCoordinates.lng]);
    }

    // 3. Add Cargo Marker (Yellow Truck Style)
    if (coordinates) {
        const cargoIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="relative flex items-center justify-center w-10 h-10">
                     <div class="relative w-6 h-6 bg-rodovar-yellow border-2 border-black rounded-full shadow-xl z-10 flex items-center justify-center">
                        <div class="w-2 h-2 bg-black rounded-full"></div>
                     </div>
                     <div class="absolute w-full h-full bg-rodovar-yellow/30 rounded-full animate-ping opacity-75"></div>
                   </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        const cargoMarker = L.marker([coordinates.lat, coordinates.lng], { icon: cargoIcon })
            .addTo(map)
            .bindPopup("<b>CARGA (RODOVAR)</b>");

        markersRef.current.push(cargoMarker);
        bounds.extend([coordinates.lat, coordinates.lng]);
    }

    // 4. Draw Lines
    
    // Line: User -> Cargo (Blue Dotted)
    if (userLocation && coordinates) {
        const latlngs = [
            [userLocation.lat, userLocation.lng],
            [coordinates.lat, coordinates.lng]
        ];

        const line = L.polyline(latlngs, {
            color: '#2563EB', // Blue 600
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(map);
        
        polylinesRef.current.push(line);
    }

    // Line: Cargo -> Destination (Black Dashed for Contrast on Light Map)
    if (coordinates && destinationCoordinates && (destinationCoordinates.lat !== 0 || destinationCoordinates.lng !== 0)) {
         const latlngs = [
            [coordinates.lat, coordinates.lng],
            [destinationCoordinates.lat, destinationCoordinates.lng]
        ];

        const line = L.polyline(latlngs, {
            color: '#000000',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 15'
        }).addTo(map);

        polylinesRef.current.push(line);
    }

    // Fit bounds if we have points
    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
        map.setView([-14.2350, -51.9253], 4);
    }

  }, [coordinates, userLocation, destinationCoordinates]);

  return (
    <div className={`relative bg-gray-100 rounded-xl overflow-hidden border border-gray-700 shadow-2xl ${className}`}>
      {/* Simplified Overlay */}
      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
          <h3 className="text-black bg-rodovar-yellow text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded shadow-md border border-black/20">
            Satélite Online
          </h3>
      </div>
      
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-0 bg-[#e5e5e5]" />

      {loading && (
        <div className="absolute inset-0 z-[500] bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <span className="text-white bg-black px-4 py-2 rounded-full font-bold text-xs animate-pulse">CARREGANDO MAPA...</span>
        </div>
      )}
    </div>
  );
});

export default MapVisualization;