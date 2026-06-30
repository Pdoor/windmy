import { useState, useEffect, useRef } from 'react';
import WeatherMap from './components/WeatherMap';
import SearchBar from './components/SearchBar';
import ForecastPanel from './components/ForecastPanel';
import Legend from './components/Legend';
import { fetchRadarMetadata, fetchForecast, type RadarMetadata, type MultiModelForecast } from './utils/weatherApi';
import { Play, Pause, CloudLightning, Wind, EyeOff } from 'lucide-react';

export default function App() {
  // Location state (defaults to Rome, Italy)
  const [lat, setLat] = useState(41.8902);
  const [lon, setLon] = useState(12.4922);
  const [cityName, setCityName] = useState('Roma');

  // Forecast state
  const [forecastData, setForecastData] = useState<MultiModelForecast | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);

  // Radar state
  const [radarMetadata, setRadarMetadata] = useState<RadarMetadata | null>(null);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [isPlayingRadar, setIsPlayingRadar] = useState(false);
  const playIntervalRef = useRef<number | null>(null);

  // Map layer state
  const [activeLayer, setActiveLayer] = useState<'radar' | 'wind' | 'none'>('radar');

  // Fetch Radar Metadata on mount
  useEffect(() => {
    const getRadarData = async () => {
      try {
        const data = await fetchRadarMetadata();
        setRadarMetadata(data);
        // Start at the last "past" frame, which is the current radar image
        if (data.past.length > 0) {
          setRadarFrameIndex(data.past.length - 1);
        }
      } catch (err) {
        console.error('Error fetching radar metadata:', err);
      }
    };
    getRadarData();
  }, []);

  // Fetch Forecast when location changes
  useEffect(() => {
    let isMounted = true;
    const getForecastData = async () => {
      setIsForecastLoading(true);
      try {
        const data = await fetchForecast(lat, lon);
        if (isMounted) {
          setForecastData(data);
        }
      } catch (err) {
        console.error('Error fetching forecast:', err);
      } finally {
        if (isMounted) {
          setIsForecastLoading(false);
        }
      }
    };
    getForecastData();
    return () => {
      isMounted = false;
    };
  }, [lat, lon]);

  // Radar Playback Interval
  useEffect(() => {
    if (isPlayingRadar && radarMetadata) {
      const totalFrames = radarMetadata.past.length + radarMetadata.nowcast.length;
      playIntervalRef.current = window.setInterval(() => {
        setRadarFrameIndex((prevIndex) => (prevIndex + 1) % totalFrames);
      }, 1500); // 1.5 seconds per frame
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlayingRadar, radarMetadata]);

  // Handle location selection from search bar or map click
  const handleSelectLocation = (newLat: number, newLon: number, newName: string) => {
    setLat(newLat);
    setLon(newLon);
    setCityName(newName);
  };

  // Get active radar frame time formatted
  const getActiveRadarTimeText = () => {
    if (!radarMetadata) return '';
    const frames = [...radarMetadata.past, ...radarMetadata.nowcast];
    const frame = frames[radarFrameIndex];
    if (!frame) return '';

    const date = new Date(frame.time * 1000);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.round(diffMs / 60000);

    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    if (diffMin < 0) {
      // Future projection
      const minsFuture = Math.abs(diffMin);
      return `${timeStr} (Previsione +${minsFuture} min)`;
    } else if (diffMin < 5) {
      return `${timeStr} (Ora)`;
    } else {
      return `${timeStr} (${diffMin} min fa)`;
    }
  };

  const radarFrames = radarMetadata ? [...radarMetadata.past, ...radarMetadata.nowcast] : [];

  return (
    <div className={`app-container ${activeLayer === 'radar' ? 'has-radar' : ''}`}>
      {/* Floating Top Controls */}
      <div className="top-bar">
        {/* Search */}
        <SearchBar onSelectLocation={handleSelectLocation} />

        {/* Layer Selector */}
        <div className="layer-selector">
          <button
            className={`layer-btn ${activeLayer === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveLayer('radar')}
            title="Radar Precipitazioni"
          >
            <CloudLightning size={16} />
            <span>Radar</span>
          </button>
          <button
            className={`layer-btn ${activeLayer === 'wind' ? 'active' : ''}`}
            onClick={() => setActiveLayer('wind')}
            title="Particelle di Vento"
          >
            <Wind size={16} />
            <span>Vento</span>
          </button>
          <button
            className={`layer-btn ${activeLayer === 'none' ? 'active' : ''}`}
            onClick={() => setActiveLayer('none')}
            title="Nessun Layer"
          >
            <EyeOff size={16} />
            <span>Mappa</span>
          </button>
        </div>
      </div>

      {/* Weather Map */}
      <WeatherMap
        lat={lat}
        lon={lon}
        cityName={cityName}
        radarMetadata={radarMetadata}
        radarFrameIndex={radarFrameIndex}
        activeLayer={activeLayer}
        onMapClick={handleSelectLocation}
      />

      {/* Floating Legend */}
      <Legend activeLayer={activeLayer} />

      {/* Radar Timeline Player (Visible only when Radar is active) */}
      {activeLayer === 'radar' && radarMetadata && radarFrames.length > 0 && (
        <div className="timeline-panel glass-panel">
          <button className="play-btn" onClick={() => setIsPlayingRadar(!isPlayingRadar)}>
            {isPlayingRadar ? <Pause size={20} fill="#f8fafc" /> : <Play size={20} fill="#f8fafc" />}
          </button>

          <div className="timeline-slider-wrapper">
            <div className="timeline-info-row">
              <span className="timeline-time-display">{getActiveRadarTimeText()}</span>
              {radarFrameIndex >= radarMetadata.past.length && (
                <div className="radar-live-badge">
                  <span className="radar-live-dot" />
                  <span>Nowcast</span>
                </div>
              )}
            </div>

            <input
              type="range"
              className="timeline-slider"
              min={0}
              max={radarFrames.length - 1}
              value={radarFrameIndex}
              onChange={(e) => {
                setIsPlayingRadar(false);
                setRadarFrameIndex(parseInt(e.target.value));
              }}
            />

            <div className="timeline-labels-row">
              <span>2 ore fa</span>
              <span style={{ color: '#06b6d4' }}>Ora</span>
              <span>+2 ore</span>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Bottom Panel */}
      <ForecastPanel
        forecastData={forecastData}
        cityName={cityName}
        isLoading={isForecastLoading}
      />
    </div>
  );
}
