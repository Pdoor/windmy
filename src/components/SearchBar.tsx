import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface SearchBarProps {
  onSelectLocation: (lat: number, lon: number, name: string) => void;
}

export default function SearchBar({ onSelectLocation }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Error fetching search suggestions:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: Suggestion) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    
    // Extract a shorter city name for display
    const nameParts = item.display_name.split(',');
    const shortName = nameParts[0] + (nameParts[1] ? `, ${nameParts[1].trim()}` : '');

    onSelectLocation(lat, lon, shortName);
    setQuery(shortName);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="search-container" ref={dropdownRef}>
      <div className="search-input-wrapper">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Cerca città o luogo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {isLoading ? (
          <Loader2 className="search-loading-icon" size={18} />
        ) : query ? (
          <button className="search-clear-btn" onClick={handleClear}>
            <X size={18} />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="search-dropdown">
          {suggestions.map((item) => (
            <div
              key={item.place_id}
              className="search-dropdown-item"
              onClick={() => handleSelect(item)}
            >
              <MapPin className="item-icon" size={16} />
              <span className="item-text">{item.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
