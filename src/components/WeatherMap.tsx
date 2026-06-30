import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchWindGrid, type RadarFrame, type RadarMetadata, type WindGridPoint } from '../utils/weatherApi';
import { useWindParticles } from '../hooks/useWindParticles';

// Fix Leaflet marker icon issue in Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface WeatherMapProps {
  lat: number;
  lon: number;
  cityName: string;
  radarMetadata: RadarMetadata | null;
  radarFrameIndex: number;
  activeLayer: 'radar' | 'wind' | 'none';
  onMapClick: (lat: number, lon: number, name: string) => void;
}

export default function WeatherMap({
  lat,
  lon,
  cityName,
  radarMetadata,
  radarFrameIndex,
  activeLayer,
  onMapClick,
}: WeatherMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Radar layers (Double-buffering to prevent flickering)
  const radarLayerARef = useRef<L.TileLayer | null>(null);
  const radarLayerBRef = useRef<L.TileLayer | null>(null);
  const activeRadarLayerRef = useRef<'A' | 'B'>('A');

  // Wind Particle state
  const [windGrid, setWindGrid] = useState<WindGridPoint[]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [isWindLoading, setIsWindLoading] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialMap = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 6,
      zoomControl: false, // We'll position it custom or use custom buttons
      attributionControl: false,
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(initialMap);

    // Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(initialMap);

    setMap(initialMap);
    setMapBounds(initialMap.getBounds());

    // Handle click on map to select new location
    initialMap.on('click', async (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      // Reverse geocode to get a name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickLat}&lon=${clickLng}&zoom=10`
        );
        const data = await response.json();
        const name = data.address.city || data.address.town || data.address.village || data.address.county || 'Coordinate selezionate';
        onMapClick(clickLat, clickLng, name);
      } catch (err) {
        onMapClick(clickLat, clickLng, `Lat: ${clickLat.toFixed(2)}, Lon: ${clickLng.toFixed(2)}`);
      }
    });

    // Handle map move end to update wind grid
    initialMap.on('moveend', () => {
      setMapBounds(initialMap.getBounds());
    });

    return () => {
      initialMap.remove();
    };
  }, []);

  // Update map center when lat/lon props change
  useEffect(() => {
    if (!map) return;
    map.setView([lat, lon], map.getZoom());

    // Update marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      markerRef.current = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`<b>${cityName}</b>`)
        .openPopup();
    }
  }, [lat, lon, map, cityName]);

  // Fetch Wind Grid when bounds change and wind layer is active
  useEffect(() => {
    if (!map || !mapBounds || activeLayer !== 'wind') {
      setWindGrid([]);
      return;
    }

    let isMounted = true;
    const fetchGrid = async () => {
      setIsWindLoading(true);
      try {
        const west = mapBounds.getWest();
        const south = mapBounds.getSouth();
        const east = mapBounds.getEast();
        const north = mapBounds.getNorth();

        const grid = await fetchWindGrid(west, south, east, north, 8);
        if (isMounted) {
          setWindGrid(grid);
        }
      } catch (err) {
        console.error('Error fetching wind grid:', err);
      } finally {
        if (isMounted) {
          setIsWindLoading(false);
        }
      }
    };

    // Debounce wind grid fetch slightly
    const timer = setTimeout(fetchGrid, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [mapBounds, activeLayer, map]);

  // Handle Radar Layer Updates
  useEffect(() => {
    if (!map || !radarMetadata) return;

    // Clear radar layers if not active
    if (activeLayer !== 'radar') {
      if (radarLayerARef.current) {
        map.removeLayer(radarLayerARef.current);
        radarLayerARef.current = null;
      }
      if (radarLayerBRef.current) {
        map.removeLayer(radarLayerBRef.current);
        radarLayerBRef.current = null;
      }
      return;
    }

    const frames: RadarFrame[] = [...radarMetadata.past, ...radarMetadata.nowcast];
    const currentFrame = frames[radarFrameIndex];

    if (!currentFrame) return;

    // Tile URL for RainViewer radar
    const tileUrl = `${radarMetadata.host}${currentFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

    // Double buffering logic:
    // Create new layer, load it, then swap opacities to prevent flashing.
    const newLayer = L.tileLayer(tileUrl, {
      opacity: 0,
      maxZoom: 19,
      zIndex: 10,
    });

    newLayer.addTo(map);

    // Swap layers
    if (activeRadarLayerRef.current === 'A') {
      // Fade out A, fade in B (new layer)
      if (radarLayerARef.current) {
        radarLayerARef.current.setOpacity(0);
        // Remove after fade
        const oldLayer = radarLayerARef.current;
        setTimeout(() => {
          if (map.hasLayer(oldLayer)) map.removeLayer(oldLayer);
        }, 200);
      }
      radarLayerBRef.current = newLayer;
      newLayer.setOpacity(0.65);
      activeRadarLayerRef.current = 'B';
    } else {
      // Fade out B, fade in A (new layer)
      if (radarLayerBRef.current) {
        radarLayerBRef.current.setOpacity(0);
        const oldLayer = radarLayerBRef.current;
        setTimeout(() => {
          if (map.hasLayer(oldLayer)) map.removeLayer(oldLayer);
        }, 200);
      }
      radarLayerARef.current = newLayer;
      newLayer.setOpacity(0.65);
      activeRadarLayerRef.current = 'A';
    }
  }, [radarFrameIndex, radarMetadata, activeLayer, map]);

  // Handle Canvas Resize
  useEffect(() => {
    if (!canvasRef.current || !mapContainerRef.current) return;

    const canvas = canvasRef.current;
    const container = mapContainerRef.current;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    // Clear canvas on map move to prevent trailing glitches, particles will redraw instantly
    if (map) {
      map.on('movestart', () => {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [map]);

  // Initialize Wind Particles Animation Loop
  useWindParticles({
    map,
    canvas: canvasRef.current,
    windGrid,
    bounds: mapBounds,
    active: activeLayer === 'wind',
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Canvas Overlay for Wind Particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />

      {/* Loading indicator for wind grid */}
      {isWindLoading && activeLayer === 'wind' && (
        <div className="map-overlay-loading">
          <div className="spinner" />
          <span>Caricamento vento...</span>
        </div>
      )}
    </div>
  );
}
