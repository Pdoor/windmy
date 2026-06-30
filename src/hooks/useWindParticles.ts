import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { WindGridPoint } from '../utils/weatherApi';

interface Particle {
  lat: number;
  lon: number;
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  age: number;
  maxAge: number;
  speed: number; // stored for coloring
}

interface UseWindParticlesProps {
  map: L.Map | null;
  canvas: HTMLCanvasElement | null;
  windGrid: WindGridPoint[];
  bounds: L.LatLngBounds | null;
  active: boolean;
}

export function useWindParticles({
  map,
  canvas,
  windGrid,
  bounds,
  active,
}: UseWindParticlesProps) {
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!map || !canvas || !active || windGrid.length === 0 || !bounds) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      // Clear canvas when inactive
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numParticles = 1200;
    const speedFactor = 0.0004; // scale lat/lon movement per frame
    const fadeOpacity = 0.08; // creates the trail effect

    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();

    const latRange = north - south;
    const lonRange = east - west;

    // Determine grid dimensions (it's an 8x8 grid)
    const gridSize = 8;

    // Map the 1D windGrid array to a 2D grid with u & v components
    // Wind direction is the direction FROM which the wind blows.
    // u (eastward) = -speed * sin(dir)
    // v (northward) = -speed * cos(dir) -> wait, in lat/lon space, north is positive latitude, so:
    // u_latlon = -speed * sin(dir)
    // v_latlon = -speed * cos(dir)
    const grid2D = Array(gridSize)
      .fill(null)
      .map((_, latIdx) => {
        return Array(gridSize)
          .fill(null)
          .map((_, lonIdx) => {
            const pt = windGrid[latIdx * gridSize + lonIdx];
            if (!pt) return { u: 0, v: 0, speed: 0 };
            const rad = (pt.windDirection * Math.PI) / 180;
            // u is eastward, v is northward.
            // Since direction is FROM, a North wind (0 deg) blows SOUTH (negative lat).
            // So v = -speed * cos(0) = -speed.
            // A West wind (270 deg) blows EAST (positive lon).
            // So u = -speed * sin(270) = speed.
            return {
              u: -pt.windSpeed * Math.sin(rad),
              v: -pt.windSpeed * Math.cos(rad),
              speed: pt.windSpeed,
            };
          });
      });

    // Get color based on wind speed (km/h)
    const getWindColor = (speed: number) => {
      if (speed < 10) return 'rgba(165, 243, 252, 0.4)'; // light cyan
      if (speed < 20) return 'rgba(34, 211, 238, 0.6)';  // cyan
      if (speed < 35) return 'rgba(52, 211, 153, 0.7)';  // emerald
      if (speed < 50) return 'rgba(234, 179, 8, 0.8)';  // yellow
      return 'rgba(239, 68, 68, 0.9)';                  // red
    };

    // Get line width based on wind speed
    const getWindLineWidth = (speed: number) => {
      if (speed < 15) return 0.8;
      if (speed < 35) return 1.2;
      return 1.8;
    };

    // Initialize or respawn a single particle
    const initParticle = (p: Partial<Particle> = {}): Particle => {
      const lat = south + Math.random() * latRange;
      const lon = west + Math.random() * lonRange;
      const latLng = L.latLng(lat, lon);
      const screenPoint = map.latLngToContainerPoint(latLng);

      return {
        lat,
        lon,
        x: screenPoint.x,
        y: screenPoint.y,
        oldX: screenPoint.x,
        oldY: screenPoint.y,
        age: 0,
        maxAge: Math.floor(Math.random() * 80) + 40,
        speed: p.speed || 0,
      };
    };

    // Initialize particle array if empty or size changed
    if (particlesRef.current.length !== numParticles) {
      particlesRef.current = Array(numParticles)
        .fill(null)
        .map(() => initParticle());
    }

    // Bilinear interpolation of wind vector (u, v) in lat/lon space
    const interpolateWind = (lat: number, lon: number) => {
      // Clamp to grid bounds
      const latPct = Math.max(0, Math.min(1, (lat - south) / latRange));
      const lonPct = Math.max(0, Math.min(1, (lon - west) / lonRange));

      const latVal = latPct * (gridSize - 1);
      const lonVal = lonPct * (gridSize - 1);

      const latIdx = Math.floor(latVal);
      const lonIdx = Math.floor(lonVal);

      const nextLatIdx = Math.min(gridSize - 1, latIdx + 1);
      const nextLonIdx = Math.min(gridSize - 1, lonIdx + 1);

      const ty = latVal - latIdx;
      const tx = lonVal - lonIdx;

      const p00 = grid2D[latIdx][lonIdx] || { u: 0, v: 0, speed: 0 };
      const p01 = grid2D[latIdx][nextLonIdx] || { u: 0, v: 0, speed: 0 };
      const p10 = grid2D[nextLatIdx][lonIdx] || { u: 0, v: 0, speed: 0 };
      const p11 = grid2D[nextLatIdx][nextLonIdx] || { u: 0, v: 0, speed: 0 };

      // Interpolate u
      const u =
        (1 - tx) * (1 - ty) * p00.u +
        tx * (1 - ty) * p01.u +
        (1 - tx) * ty * p10.u +
        tx * ty * p11.u;

      // Interpolate v
      const v =
        (1 - tx) * (1 - ty) * p00.v +
        tx * (1 - ty) * p01.v +
        (1 - tx) * ty * p10.v +
        tx * ty * p11.v;

      // Interpolate speed
      const speed =
        (1 - tx) * (1 - ty) * p00.speed +
        tx * (1 - ty) * p01.speed +
        (1 - tx) * ty * p10.speed +
        tx * ty * p11.speed;

      return { u, v, speed };
    };

    const updateAndDraw = () => {
      // Fade canvas to create trails
      ctx.fillStyle = `rgba(15, 23, 42, ${fadeOpacity})`; // tailwind slate-900
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particlesRef.current.forEach((p, idx) => {
        p.age++;

        if (p.age >= p.maxAge) {
          particlesRef.current[idx] = initParticle();
          return;
        }

        // Interpolate wind at particle position
        const wind = interpolateWind(p.lat, p.lon);
        p.speed = wind.speed;

        // Move particle in lat/lon space
        // Adjust lon movement by cosine of latitude to account for earth curvature
        const cosLat = Math.cos((p.lat * Math.PI) / 180);
        p.lon += (wind.u * speedFactor) / (cosLat || 0.001);
        p.lat += wind.v * speedFactor;

        // Save old screen position
        p.oldX = p.x;
        p.oldY = p.y;

        // Project new lat/lon to screen coordinates
        const latLng = L.latLng(p.lat, p.lon);
        // Check if map still contains point to avoid out of bounds errors
        try {
          const screenPoint = map.latLngToContainerPoint(latLng);
          p.x = screenPoint.x;
          p.y = screenPoint.y;
        } catch (e) {
          particlesRef.current[idx] = initParticle();
          return;
        }

        // Respawn if particle goes off-screen
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          particlesRef.current[idx] = initParticle();
          return;
        }

        // Draw line from old position to new position
        ctx.beginPath();
        ctx.moveTo(p.oldX, p.oldY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = getWindColor(p.speed);
        ctx.lineWidth = getWindLineWidth(p.speed);
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [map, canvas, windGrid, bounds, active]);
}
