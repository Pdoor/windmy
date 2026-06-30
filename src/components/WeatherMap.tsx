import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchMapGrid, type RadarFrame, type RadarMetadata, type MapGridPoint } from '../utils/weatherApi';
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
  activeLayer: 'radar' | 'wind' | 'temperature' | 'clouds' | 'none';
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

  // Map Grid state (Wind, Temp, Clouds)
  const [windGrid, setWindGrid] = useState<MapGridPoint[]>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [isGridLoading, setIsGridLoading] = useState(false);

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

  // Fetch Map Grid when bounds change and a grid-based layer is active
  useEffect(() => {
    const isGridLayer = activeLayer === 'wind' || activeLayer === 'temperature' || activeLayer === 'clouds';
    if (!map || !mapBounds || !isGridLayer) {
      setWindGrid([]);
      return;
    }

    let isMounted = true;
    const fetchGrid = async () => {
      setIsGridLoading(true);
      try {
        const west = mapBounds.getWest();
        const south = mapBounds.getSouth();
        const east = mapBounds.getEast();
        const north = mapBounds.getNorth();

        const grid = await fetchMapGrid(west, south, east, north, 8);
        if (isMounted) {
          setWindGrid(grid);
        }
      } catch (err) {
        console.error('Error fetching map grid:', err);
      } finally {
        if (isMounted) {
          setIsGridLoading(false);
        }
      }
    };

    // Debounce grid fetch slightly
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
    const tileUrl = `${radarMetadata.host}${currentFrame.path}/256/{z}/{x}/{y}/1/1_1.png`;

    // Double buffering logic:
    // Create new layer, load it, then swap opacities to prevent flashing.
    const newLayer = L.tileLayer(tileUrl, {
      opacity: 0,
      maxZoom: 19,
      maxNativeZoom: 7, // RainViewer max native zoom is 7 as of 2026; Leaflet will upscale them above this
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

  // Effect to draw static overlays (temperature heatmap or cloud cover)
  useEffect(() => {
    if (!canvasRef.current || !map || windGrid.length === 0 || !mapBounds) return;
    if (activeLayer !== 'temperature' && activeLayer !== 'clouds') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create 8x8 offscreen canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 8;
    offscreenCanvas.height = 8;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) return;

    const imgData = offscreenCtx.createImageData(8, 8);

    // Temperature color scale helper (maps temperature to rgb)
    const getTempColor = (t: number): [number, number, number] => {
      if (t <= -10) return [147, 51, 234]; // Purple
      if (t <= 0) {
        const pct = (t - (-10)) / 10;
        return [Math.round(147 - pct * 117), Math.round(51 + pct * 7), Math.round(234 - pct * 96)];
      }
      if (t <= 10) {
        const pct = t / 10;
        return [Math.round(30 - pct * 24), Math.round(58 + pct * 124), Math.round(138 + pct * 74)];
      }
      if (t <= 20) {
        const pct = (t - 10) / 10;
        return [Math.round(6 - pct * 10), Math.round(182 + pct * 3), Math.round(212 - pct * 83)];
      }
      if (t <= 30) {
        const pct = (t - 20) / 10;
        return [Math.round(16 + pct * 229), Math.round(185 - pct * 27), Math.round(129 - pct * 118)];
      }
      const pct = Math.min(1, (t - 30) / 10);
      return [Math.round(245 - pct * 25), Math.round(158 - pct * 120), Math.round(11 + pct * 27)];
    };

    for (let y = 0; y < 8; y++) {
      const latIdx = 7 - y; // flip y because canvas y goes down, lat goes up
      for (let x = 0; x < 8; x++) {
        const lonIdx = x;
        const gridIdx = latIdx * 8 + lonIdx;
        const pt = windGrid[gridIdx];
        const pixelIdx = (y * 8 + x) * 4;

        if (pt) {
          if (activeLayer === 'temperature') {
            const rgb = getTempColor(pt.temperature);
            imgData.data[pixelIdx] = rgb[0];
            imgData.data[pixelIdx + 1] = rgb[1];
            imgData.data[pixelIdx + 2] = rgb[2];
            imgData.data[pixelIdx + 3] = 135; // Alpha (semi-transparent heatmap, 135/255 = 53%)
          } else if (activeLayer === 'clouds') {
            imgData.data[pixelIdx] = 255;
            imgData.data[pixelIdx + 1] = 255;
            imgData.data[pixelIdx + 2] = 255;
            // Scale opacity of clouds (max 180/255 = 70% opacity)
            imgData.data[pixelIdx + 3] = Math.round((pt.cloudCover / 100) * 180);
          }
        } else {
          imgData.data[pixelIdx + 3] = 0;
        }
      }
    }

    offscreenCtx.putImageData(imgData, 0, 0);

    // Clear main canvas and draw the stretched offscreen canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);

    // Cleanup: clear canvas when layer changes
    return () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [activeLayer, windGrid, map, mapBounds]);

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

      {/* Loading indicator for grid */}
      {isGridLoading && (activeLayer === 'wind' || activeLayer === 'temperature' || activeLayer === 'clouds') && (
        <div className="map-overlay-loading">
          <div className="spinner" />
          <span>Caricamento dati mappa...</span>
        </div>
      )}
    </div>
  );
}
