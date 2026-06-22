import { useState, useRef, useEffect } from 'react';
import type { SearchResult } from '../lib/types';
import { api } from '../lib/api';

interface Props {
  onAdd: (sym: string, name: string) => void;
}

export function SearchBar({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const { results } = await api.search(q.trim());
        setResults(results);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const add = (r: SearchResult) => {
    onAdd(r.symbol, r.name);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="searchbar" style={{ position: 'relative' }}>
      <input
        value={q}
        placeholder="종목 검색 후 Enter / 클릭으로 관심목록 추가 (예: AAPL, 삼성)"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) add(results[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <div key={r.symbol} className="row" onClick={() => add(r)}>
              <span className="sym">{r.symbol}</span>
              <span className="name">{r.name}</span>
              <span className="val dim">{r.exchange || r.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
