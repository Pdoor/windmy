export interface RadarFrame {
  time: number;
  path: string;
}

export interface RadarMetadata {
  host: string;
  past: RadarFrame[];
  nowcast: RadarFrame[];
}

export interface WeatherModelData {
  time: string[];
  temperature: number[];
  windSpeed: number[];
  precipitation: number[];
}

export interface MultiModelForecast {
  current: {
    time: string;
    temperature: number;
    humidity: number;
    apparentTemperature: number;
    isDay: boolean;
    precipitation: number;
    weatherCode: number;
    cloudCover: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
    precipitation: number[];
    precipitationProbability: number[];
    windSpeed: number[];
    windDirection: number[];
    weatherCode: number[];
    cloudCover: number[];
    pressure: number[];
  };
  daily: {
    time: string[];
    weatherCode: number[];
    tempMax: number[];
    tempMin: number[];
    precipitationSum: number[];
  };
  models: {
    ecmwf: WeatherModelData;
    gfs: WeatherModelData;
    icon: WeatherModelData;
    gem: WeatherModelData;
  };
}

export interface MapGridPoint {
  lat: number;
  lon: number;
  windSpeed: number;
  windDirection: number;
  temperature: number;
  cloudCover: number;
}

// Fetch RainViewer radar metadata
export async function fetchRadarMetadata(): Promise<RadarMetadata> {
  const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!response.ok) {
    throw new Error('Failed to fetch radar metadata');
  }
  const data = await response.json();
  return {
    host: data.host,
    past: data.radar.past || [],
    nowcast: data.radar.nowcast || [],
  };
}

// Fetch detailed weather forecast with multiple models for comparison
export async function fetchForecast(lat: number, lon: number): Promise<MultiModelForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,pressure_msl,temperature_2m_ecmwf_ifs,precipitation_ecmwf_ifs,wind_speed_10m_ecmwf_ifs,temperature_2m_gfs_seamless,precipitation_gfs_seamless,wind_speed_10m_gfs_seamless,temperature_2m_icon_seamless,precipitation_icon_seamless,wind_speed_10m_icon_seamless,temperature_2m_gem_seamless,precipitation_gem_seamless,wind_speed_10m_gem_seamless&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&models=ecmwf_ifs,gfs_seamless,icon_seamless,gem_seamless&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch weather forecast');
  }
  const data = await response.json();

  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;

  return {
    current: {
      time: current.time,
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      apparentTemperature: current.apparent_temperature,
      isDay: current.is_day === 1,
      precipitation: current.precipitation,
      weatherCode: current.weather_code,
      cloudCover: current.cloud_cover,
      pressure: current.pressure_msl,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
    },
    hourly: {
      time: hourly.time,
      temperature: hourly.temperature_2m,
      precipitation: hourly.precipitation,
      precipitationProbability: hourly.precipitation_probability,
      windSpeed: hourly.wind_speed_10m,
      windDirection: hourly.wind_direction_10m,
      weatherCode: hourly.weather_code,
      cloudCover: hourly.cloud_cover,
      pressure: hourly.pressure_msl,
    },
    daily: {
      time: daily.time,
      weatherCode: daily.weather_code,
      tempMax: daily.temperature_2m_max,
      tempMin: daily.temperature_2m_min,
      precipitationSum: daily.precipitation_sum,
    },
    models: {
      ecmwf: {
        time: hourly.time,
        temperature: hourly.temperature_2m_ecmwf_ifs,
        precipitation: hourly.precipitation_ecmwf_ifs,
        windSpeed: hourly.wind_speed_10m_ecmwf_ifs,
      },
      gfs: {
        time: hourly.time,
        temperature: hourly.temperature_2m_gfs_seamless,
        precipitation: hourly.precipitation_gfs_seamless,
        windSpeed: hourly.wind_speed_10m_gfs_seamless,
      },
      icon: {
        time: hourly.time,
        temperature: hourly.temperature_2m_icon_seamless,
        precipitation: hourly.precipitation_icon_seamless,
        windSpeed: hourly.wind_speed_10m_icon_seamless,
      },
      gem: {
        time: hourly.time,
        temperature: hourly.temperature_2m_gem_seamless,
        precipitation: hourly.precipitation_gem_seamless,
        windSpeed: hourly.wind_speed_10m_gem_seamless,
      },
    },
  };
}

// Fetch grid data for particle animation and heatmap overlays
export async function fetchMapGrid(
  west: number,
  south: number,
  east: number,
  north: number,
  gridSize: number = 8
): Promise<MapGridPoint[]> {
  const lats: number[] = [];
  const lons: number[] = [];

  // Generate grid coordinates
  const latStep = (north - south) / (gridSize - 1);
  const lonStep = (east - west) / (gridSize - 1);

  for (let i = 0; i < gridSize; i++) {
    const lat = south + i * latStep;
    for (let j = 0; j < gridSize; j++) {
      const lon = west + j * lonStep;
      lats.push(Number(lat.toFixed(4)));
      lons.push(Number(lon.toFixed(4)));
    }
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m,temperature_2m,cloud_cover`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch map grid');
  }
  const data = await response.json();

  const results = Array.isArray(data) ? data : [data];

  return results.map((result: any, idx: number) => {
    return {
      lat: lats[idx],
      lon: lons[idx],
      windSpeed: result.current?.wind_speed_10m || 0,
      windDirection: result.current?.wind_direction_10m || 0,
      temperature: result.current?.temperature_2m || 0,
      cloudCover: result.current?.cloud_cover || 0,
    };
  });
}

// Translate WMO Weather Code to human readable description and icon name
export function getWeatherDesc(code: number): { text: string; icon: string } {
  switch (code) {
    case 0: return { text: 'Sereno', icon: 'Sun' };
    case 1: return { text: 'Prevalentemente sereno', icon: 'SunDim' };
    case 2: return { text: 'Parzialmente nuvoloso', icon: 'CloudSun' };
    case 3: return { text: 'Nuvoloso', icon: 'Cloud' };
    case 45: case 48: return { text: 'Nebbia', icon: 'CloudFog' };
    case 51: case 53: case 55: return { text: 'Pioggerella', icon: 'CloudDrizzle' };
    case 56: case 57: return { text: 'Pioggerella gelata', icon: 'CloudSnow' };
    case 61: return { text: 'Pioggia debole', icon: 'CloudRain' };
    case 63: return { text: 'Pioggia moderata', icon: 'CloudRain' };
    case 65: return { text: 'Pioggia forte', icon: 'CloudRainWind' };
    case 66: case 67: return { text: 'Pioggia gelata', icon: 'CloudSnow' };
    case 71: return { text: 'Neve debole', icon: 'Snowflake' };
    case 73: return { text: 'Neve moderata', icon: 'Snowflake' };
    case 75: return { text: 'Neve forte', icon: 'Snowflake' };
    case 77: return { text: 'Granelli di neve', icon: 'Snowflake' };
    case 80: case 81: case 82: return { text: 'Rovesci di pioggia', icon: 'CloudRain' };
    case 85: case 86: return { text: 'Rovesci di neve', icon: 'Snowflake' };
    case 95: return { text: 'Temporale', icon: 'CloudLightning' };
    case 96: case 99: return { text: 'Temporale con grandine', icon: 'CloudLightning' };
    default: return { text: 'Sconosciuto', icon: 'HelpCircle' };
  }
}
