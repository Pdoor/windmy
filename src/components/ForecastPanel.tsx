import { useState } from 'react';
import { getWeatherDesc, type MultiModelForecast } from '../utils/weatherApi';
import ModelComparison from './ModelComparison';
import * as Icons from 'lucide-react';
import { 
  Thermometer, 
  Wind, 
  Droplets, 
  Gauge, 
  Cloud, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Clock, 
  BarChart2 
} from 'lucide-react';

interface ForecastPanelProps {
  forecastData: MultiModelForecast | null;
  cityName: string;
  isLoading: boolean;
}

type PanelTab = 'meteogram' | 'compare';

export default function ForecastPanel({ forecastData, cityName, isLoading }: ForecastPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<PanelTab>('meteogram');

  if (isLoading) {
    return (
      <div className="forecast-panel-loading glass-panel">
        <Icons.Loader2 className="spinner" size={24} />
        <span>Caricamento previsioni per {cityName}...</span>
      </div>
    );
  }

  if (!forecastData) return null;

  const { current, hourly, daily } = forecastData;
  const currentDesc = getWeatherDesc(current.weatherCode);

  // Dynamic Lucide icon helper
  const WeatherIcon = ({ iconName, size = 24, className = "" }: { iconName: string; size?: number; className?: string }) => {
    const IconComponent = (Icons as any)[iconName] || Icons.HelpCircle;
    return <IconComponent size={size} className={className} />;
  };

  // Format date to local readable format
  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  };

  return (
    <div className={`forecast-panel glass-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Toggle Button */}
      <button className="panel-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        <span className="panel-toggle-text">
          {isExpanded ? 'Nascondi Dettagli' : `Mostra Previsioni per ${cityName} (${current.temperature.toFixed(1)}°C)`}
        </span>
      </button>

      {isExpanded && (
        <div className="panel-content">
          {/* Current Weather Overview */}
          <div className="current-weather-section">
            <div className="current-main">
              <div className="city-info">
                <h2>{cityName}</h2>
                <div className="weather-badge">
                  <WeatherIcon iconName={currentDesc.icon} size={28} className="weather-badge-icon" />
                  <span>{currentDesc.text}</span>
                </div>
              </div>
              <div className="current-temp">
                <span className="temp-num">{current.temperature.toFixed(1)}</span>
                <span className="temp-unit">°C</span>
              </div>
            </div>

            <div className="current-stats-grid">
              <div className="stat-card">
                <Thermometer size={18} className="stat-icon temp-icon" />
                <div className="stat-info">
                  <span className="stat-label">Percepita</span>
                  <span className="stat-value">{current.apparentTemperature.toFixed(1)}°C</span>
                </div>
              </div>

              <div className="stat-card">
                <Wind size={18} className="stat-icon wind-icon" />
                <div className="stat-info">
                  <span className="stat-label">Vento</span>
                  <div className="stat-value-with-icon">
                    <span className="stat-value">{current.windSpeed.toFixed(1)} km/h</span>
                    <Compass 
                      size={14} 
                      className="wind-dir-arrow" 
                      style={{ transform: `rotate(${current.windDirection}deg)` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <Droplets size={18} className="stat-icon humidity-icon" />
                <div className="stat-info">
                  <span className="stat-label">Umidità</span>
                  <span className="stat-value">{current.humidity}%</span>
                </div>
              </div>

              <div className="stat-card">
                <Gauge size={18} className="stat-icon pressure-icon" />
                <div className="stat-info">
                  <span className="stat-label">Pressione</span>
                  <span className="stat-value">{current.pressure.toFixed(0)} hPa</span>
                </div>
              </div>

              <div className="stat-card">
                <Cloud size={18} className="stat-icon cloud-icon" />
                <div className="stat-info">
                  <span className="stat-label">Nubi</span>
                  <span className="stat-value">{current.cloudCover}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast Overview */}
          <div className="daily-forecast-section">
            <h3 className="section-title">
              <Calendar size={16} />
              <span>Prossimi Giorni</span>
            </h3>
            <div className="daily-list">
              {daily.time.map((timeStr, idx) => {
                const desc = getWeatherDesc(daily.weatherCode[idx]);
                return (
                  <div key={timeStr} className="daily-card">
                    <span className="daily-date">{formatDay(timeStr)}</span>
                    <WeatherIcon iconName={desc.icon} size={20} className="daily-icon" />
                    <div className="daily-temps">
                      <span className="temp-max">{daily.tempMax[idx].toFixed(0)}°</span>
                      <span className="temp-min">{daily.tempMin[idx].toFixed(0)}°</span>
                    </div>
                    {daily.precipitationSum[idx] > 0.1 && (
                      <span className="daily-rain-tag">
                        {daily.precipitationSum[idx].toFixed(1)}mm
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Section (Meteogram vs Model Comparison) */}
          <div className="details-section">
            <div className="details-tabs">
              <button 
                className={`details-tab-btn ${activeTab === 'meteogram' ? 'active' : ''}`}
                onClick={() => setActiveTab('meteogram')}
              >
                <Clock size={16} />
                <span>Meteogramma Orario</span>
              </button>
              <button 
                className={`details-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                onClick={() => setActiveTab('compare')}
              >
                <BarChart2 size={16} />
                <span>Compara Modelli</span>
              </button>
            </div>

            <div className="details-tab-content">
              {activeTab === 'meteogram' ? (
                /* Meteogram */
                <div className="meteogram-wrapper">
                  <div className="meteogram-timeline">
                    {hourly.time.slice(0, 24).map((timeStr, idx) => {
                      const date = new Date(timeStr);
                      const hour = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                      const desc = getWeatherDesc(hourly.weatherCode[idx]);
                      
                      return (
                        <div key={timeStr} className="meteogram-col">
                          <span className="met-time">{hour}</span>
                          <span className="met-temp">{hourly.temperature[idx].toFixed(0)}°</span>
                          
                          <div className="met-icon-container">
                            <WeatherIcon iconName={desc.icon} size={18} className="met-icon" />
                          </div>

                          {/* Precipitation probability */}
                          <div className="met-rain-chance">
                            {hourly.precipitationProbability[idx] > 0 ? (
                              <span className="rain-chance-pct">{hourly.precipitationProbability[idx]}%</span>
                            ) : (
                              <span className="rain-chance-empty">-</span>
                            )}
                          </div>

                          {/* Wind bar */}
                          <div className="met-wind-row">
                            <Compass 
                              size={10} 
                              className="met-wind-dir" 
                              style={{ transform: `rotate(${hourly.windDirection[idx]}deg)` }} 
                            />
                            <span className="met-wind-speed">{hourly.windSpeed[idx].toFixed(0)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="meteogram-legend">
                    <span>* Dati orari per le prossime 24 ore. Indica: Ora, Temp, Meteo, Prob. Pioggia, Dir/Vel Vento (km/h).</span>
                  </div>
                </div>
              ) : (
                /* Model Comparison Charts */
                <ModelComparison forecastData={forecastData} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
