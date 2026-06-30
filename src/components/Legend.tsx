interface LegendProps {
  activeLayer: 'radar' | 'wind' | 'temperature' | 'clouds' | 'none';
}

export default function Legend({ activeLayer }: LegendProps) {
  if (activeLayer === 'none') return null;

  return (
    <div className="legend-container">
      {activeLayer === 'radar' && (
        <div className="legend-item">
          <div className="legend-title">Precipitazioni (dBZ)</div>
          <div className="legend-gradient-wrapper">
            <div className="legend-gradient radar-gradient" />
            <div className="legend-labels">
              <span>0</span>
              <span>15</span>
              <span>30</span>
              <span>45</span>
              <span>60+</span>
            </div>
          </div>
        </div>
      )}

      {activeLayer === 'wind' && (
        <div className="legend-item">
          <div className="legend-title">Vento (km/h)</div>
          <div className="legend-gradient-wrapper">
            <div className="legend-gradient wind-gradient" />
            <div className="legend-labels">
              <span>0</span>
              <span>10</span>
              <span>20</span>
              <span>35</span>
              <span>50+</span>
            </div>
          </div>
        </div>
      )}

      {activeLayer === 'temperature' && (
        <div className="legend-item">
          <div className="legend-title">Temperatura (°C)</div>
          <div className="legend-gradient-wrapper">
            <div className="legend-gradient temp-scale-gradient" />
            <div className="legend-labels">
              <span>-10</span>
              <span>0</span>
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40+</span>
            </div>
          </div>
        </div>
      )}

      {activeLayer === 'clouds' && (
        <div className="legend-item">
          <div className="legend-title">Copertura Nubi</div>
          <div className="legend-gradient-wrapper">
            <div className="legend-gradient clouds-gradient" />
            <div className="legend-labels">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
