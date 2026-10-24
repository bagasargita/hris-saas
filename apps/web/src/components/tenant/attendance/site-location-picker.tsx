'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2Icon, MapPinIcon, SearchIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { useDebounced } from '@/components/data-table/use-debounced';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { reverseGeocode, searchPlaces, type PlaceResult } from '@/lib/nominatim';

const SiteLocationMap = dynamic(
  () => import('./site-location-map').then((m) => m.SiteLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Memuat peta…
      </div>
    ),
  },
);

export interface SiteLocationValue {
  latitude: number;
  longitude: number;
  address: string;
  /** Suggested place name from search (optional). */
  suggestedName?: string;
}

export function SiteLocationPicker({
  latitude,
  longitude,
  radiusMeters,
  address,
  onChange,
}: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address: string;
  onChange: (next: SiteLocationValue) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query.trim(), 400);
  const [open, setOpen] = useState(false);

  const search = useQuery({
    queryKey: ['nominatim-search', debouncedQuery],
    queryFn: ({ signal }) => searchPlaces(debouncedQuery, signal),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });

  const results: PlaceResult[] = search.data ?? [];

  const pickPlace = (place: PlaceResult) => {
    setQuery(place.label);
    setOpen(false);
    onChange({
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      suggestedName: place.label.split(',')[0]?.trim(),
    });
  };

  const pickMap = (lat: number, lng: number) => {
    onChange({ latitude: lat, longitude: lng, address });
    void reverseGeocode(lat, lng).then((label) => {
      if (label) onChange({ latitude: lat, longitude: lng, address: label });
    });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${listId}-search`}>Cari tempat atau gedung</Label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${listId}-search`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
            placeholder="mis. Monas Jakarta, nama kantor, jalan…"
            className="pr-9 pl-9"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
          />
          {search.isFetching && (
            <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {open && results.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
            >
              {results.map((place) => (
                <li key={place.placeId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickPlace(place)}
                  >
                    <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{place.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Didukung OpenStreetMap Nominatim. Klik peta untuk menempatkan pin; lingkaran biru
          menunjukkan radius geofence.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border">
        <SiteLocationMap
          latitude={latitude}
          longitude={longitude}
          radiusMeters={radiusMeters}
          onPick={pickMap}
        />
      </div>
    </div>
  );
}
