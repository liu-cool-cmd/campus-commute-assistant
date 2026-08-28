import { useRef, useState, type FormEvent } from 'react';
import { searchLocations, type LocationSearchResult } from '../core/locations/geocoding';
import type { AppLanguage, Location } from '../core/types';
import { translate } from '../i18n';

interface HomeLocationSearchProps {
  language: AppLanguage;
  onSelect(location: Location): void;
}

export function HomeLocationSearch({ language, onSelect }: HomeLocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [status, setStatus] = useState<string>();
  const [searching, setSearching] = useState(false);
  const activeRequest = useRef<AbortController | undefined>(undefined);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 3) {
      setResults([]);
      setStatus(translate(language, 'addressTooShort'));
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setSearching(true);
    setStatus(undefined);

    try {
      const matches = await searchLocations(query, controller.signal, language);
      if (controller.signal.aborted) return;
      setResults(matches);
      setStatus(matches.length === 0 ? translate(language, 'addressNotFound') : undefined);
    } catch {
      if (controller.signal.aborted) return;
      setResults([]);
      setStatus(translate(language, 'addressSearchFailed'));
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  };

  const select = (result: LocationSearchResult) => {
    setQuery(result.displayName);
    setResults([]);
    setStatus(translate(language, 'homeUpdated'));
    onSelect({ lat: result.lat, lon: result.lon, label: result.displayName });
  };

  return (
    <div className="location-search">
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="home-address">{translate(language, 'searchHome')}</label>
        <div className="location-search-row">
          <input
            id="home-address"
            type="search"
            autoComplete="street-address"
            placeholder={translate(language, 'searchHomePlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="secondary-button" disabled={searching} type="submit">
            {translate(language, searching ? 'searching' : 'search')}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <ul className="location-results" aria-label={translate(language, 'addressResults')}>
          {results.map((result) => (
            <li key={result.id}>
              <button type="button" onClick={() => select(result)}>
                {result.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {status && <p className="location-status">{status}</p>}
      <p className="location-search-note">
        {translate(language, 'searchPrivacy')}{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {translate(language, 'osmContributors')}
        </a>
        .
      </p>
    </div>
  );
}
