import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import type { MultiModelForecast } from '../utils/weatherApi';
import { Thermometer, Wind, CloudRain, ShieldAlert } from 'lucide-react';

interface ModelComparisonProps {
  forecastData: MultiModelForecast;
}

type ComparisonTab = 'temp' | 'wind' | 'rain';

export default function ModelComparison({ forecastData }: ModelComparisonProps) {
  const [activeTab, setActiveTab] = useState<ComparisonTab>('temp');
  const { models } = forecastData;

  // Prepare data for the first 72 hours (3 days)
  const forecastHours = 72;
  const chartData = models.ecmwf.time.slice(0, forecastHours).map((timeStr, idx) => {
    const date = new Date(timeStr);
    const dayName = date.toLocaleDateString('it-IT', { weekday: 'short' });
    const hourName = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    
    return {
      formattedTime: `${dayName} ${hourName}`,
      // Temperature
      ECMWF: models.ecmwf.temperature[idx] !== undefined ? Number(models.ecmwf.temperature[idx].toFixed(1)) : null,
      GFS: models.gfs.temperature[idx] !== undefined ? Number(models.gfs.temperature[idx].toFixed(1)) : null,
      ICON: models.icon.temperature[idx] !== undefined ? Number(models.icon.temperature[idx].toFixed(1)) : null,
      GEM: models.gem.temperature[idx] !== undefined ? Number(models.gem.temperature[idx].toFixed(1)) : null,
      // Wind Speed
      ECMWF_Vento: models.ecmwf.windSpeed[idx] !== undefined ? Number(models.ecmwf.windSpeed[idx].toFixed(1)) : null,
      GFS_Vento: models.gfs.windSpeed[idx] !== undefined ? Number(models.gfs.windSpeed[idx].toFixed(1)) : null,
      ICON_Vento: models.icon.windSpeed[idx] !== undefined ? Number(models.icon.windSpeed[idx].toFixed(1)) : null,
      GEM_Vento: models.gem.windSpeed[idx] !== undefined ? Number(models.gem.windSpeed[idx].toFixed(1)) : null,
      // Precipitation
      ECMWF_Pioggia: models.ecmwf.precipitation[idx] !== undefined ? Number(models.ecmwf.precipitation[idx].toFixed(2)) : null,
      GFS_Pioggia: models.gfs.precipitation[idx] !== undefined ? Number(models.gfs.precipitation[idx].toFixed(2)) : null,
      ICON_Pioggia: models.icon.precipitation[idx] !== undefined ? Number(models.icon.precipitation[idx].toFixed(2)) : null,
      GEM_Pioggia: models.gem.precipitation[idx] !== undefined ? Number(models.gem.precipitation[idx].toFixed(2)) : null,
    };
  });

  // Calculate disagreement (spread) among models to show reliability
  const calculateAverageSpread = () => {
    let totalSpread = 0;
    let count = 0;
    
    for (let i = 0; i < Math.min(24, chartData.length); i++) { // look at the first 24h
      const pt = chartData[i];
      if (activeTab === 'temp' && pt.ECMWF && pt.GFS && pt.ICON && pt.GEM) {
        const vals = [pt.ECMWF, pt.GFS, pt.ICON, pt.GEM];
        totalSpread += Math.max(...vals) - Math.min(...vals);
        count++;
      } else if (activeTab === 'wind' && pt.ECMWF_Vento && pt.GFS_Vento && pt.ICON_Vento && pt.GEM_Vento) {
        const vals = [pt.ECMWF_Vento, pt.GFS_Vento, pt.ICON_Vento, pt.GEM_Vento];
        totalSpread += Math.max(...vals) - Math.min(...vals);
        count++;
      }
    }

    if (count === 0) return 'Alta';
    const avgSpread = totalSpread / count;
    
    if (activeTab === 'temp') {
      if (avgSpread < 1.0) return 'Eccellente (Modelli Concordi)';
      if (avgSpread < 2.0) return 'Buona (Scostamento Minimo)';
      return 'Moderata (Scostamento Significativo)';
    } else {
      if (avgSpread < 5.0) return 'Eccellente (Modelli Concordi)';
      if (avgSpread < 10.0) return 'Buona (Scostamento Minimo)';
      return 'Moderata (Scostamento Significativo)';
    }
  };

  const reliability = calculateAverageSpread();

  // Color Palette for Models
  const colors = {
    ECMWF: '#3b82f6', // Bright Blue (Gold standard)
    GFS: '#ef4444',   // Red/Orange (NOAA)
    ICON: '#10b981',  // Emerald (DWD)
    GEM: '#a855f7',   // Purple (Canada)
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-chart-tooltip">
          <p className="tooltip-time">{label}</p>
          <div className="tooltip-values">
            {payload.map((entry: any) => (
              <div key={entry.name} className="tooltip-row" style={{ color: entry.stroke || entry.fill }}>
                <span className="tooltip-model-name">{entry.name}:</span>
                <span className="tooltip-model-value">
                  {entry.value} {activeTab === 'temp' ? '°C' : activeTab === 'wind' ? 'km/h' : 'mm'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="model-comparison-container">
      <div className="comparison-header">
        <div className="comparison-title-wrapper">
          <h3>Confronto Modelli Matematici</h3>
          <span className="model-subtitle">ECMWF (EU) vs GFS (USA) vs ICON (DE) vs GEM (CA)</span>
        </div>

        {/* Reliability indicator */}
        <div className="reliability-indicator">
          <ShieldAlert size={16} className="reliability-icon" />
          <span>Affidabilità Proiezione: <b>{reliability}</b></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="comparison-tabs">
        <button
          className={`tab-btn ${activeTab === 'temp' ? 'active' : ''}`}
          onClick={() => setActiveTab('temp')}
        >
          <Thermometer size={16} />
          <span>Temperatura</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'wind' ? 'active' : ''}`}
          onClick={() => setActiveTab('wind')}
        >
          <Wind size={16} />
          <span>Vento</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'rain' ? 'active' : ''}`}
          onClick={() => setActiveTab('rain')}
        >
          <CloudRain size={16} />
          <span>Precipitazioni</span>
        </button>
      </div>

      {/* Chart Canvas */}
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={260}>
          {activeTab === 'temp' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formattedTime"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                interval={12} // show label every 12 hours
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                domain={['auto', 'auto']}
                unit="°"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="ECMWF"
                stroke={colors.ECMWF}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6 }}
                name="ECMWF (Europe)"
              />
              <Line
                type="monotone"
                dataKey="GFS"
                stroke={colors.GFS}
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                name="GFS (USA)"
              />
              <Line
                type="monotone"
                dataKey="ICON"
                stroke={colors.ICON}
                strokeWidth={1.8}
                dot={false}
                name="ICON (Germany)"
              />
              <Line
                type="monotone"
                dataKey="GEM"
                stroke={colors.GEM}
                strokeWidth={1.8}
                dot={false}
                name="GEM (Canada)"
              />
            </LineChart>
          ) : activeTab === 'wind' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formattedTime"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                interval={12}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                domain={[0, 'auto']}
                unit=" km"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="ECMWF_Vento"
                stroke={colors.ECMWF}
                strokeWidth={2.5}
                dot={false}
                name="ECMWF (Europe)"
              />
              <Line
                type="monotone"
                dataKey="GFS_Vento"
                stroke={colors.GFS}
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                name="GFS (USA)"
              />
              <Line
                type="monotone"
                dataKey="ICON_Vento"
                stroke={colors.ICON}
                strokeWidth={1.8}
                dot={false}
                name="ICON (Germany)"
              />
              <Line
                type="monotone"
                dataKey="GEM_Vento"
                stroke={colors.GEM}
                strokeWidth={1.8}
                dot={false}
                name="GEM (Canada)"
              />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="formattedTime"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                interval={12}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 10 }}
                domain={[0, 'auto']}
                unit=" mm"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ECMWF_Pioggia" fill={colors.ECMWF} opacity={0.8} name="ECMWF (Europe)" />
              <Bar dataKey="GFS_Pioggia" fill={colors.GFS} opacity={0.7} name="GFS (USA)" />
              <Bar dataKey="ICON_Pioggia" fill={colors.ICON} opacity={0.7} name="ICON (Germany)" />
              <Bar dataKey="GEM_Pioggia" fill={colors.GEM} opacity={0.7} name="GEM (Canada)" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
