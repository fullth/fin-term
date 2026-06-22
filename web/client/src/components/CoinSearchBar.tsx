import { useState, useRef, useEffect } from 'react';
import type { CoinSearchResult, CoinMeta } from '../lib/types';
import { api } from '../lib/api';

interface Props {
  onAdd: (c: CoinMeta) => void;
}

export function CoinSearchBar({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CoinSearchResult[]>([]);
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
        const { results } = await api.cryptoSearch(q.trim());
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

  const add = (r: CoinSearchResult) => {
    onAdd({ id: r.id, symbol: r.symbol, name: r.name, upbitMarket: r.upbitMarket });
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="searchbar" style={{ position: 'relative' }}>
      <input
        value={q}
        placeholder="코인 검색 후 Enter / 클릭으로 추가 (업비트 KRW 상장만 · 예: solana, 도지)"
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
            <div key={r.id} className="row" onClick={() => add(r)}>
              <span className="sym">{r.symbol}</span>
              <span className="name">{r.name}</span>
              <span className="val dim">{r.upbitMarket}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
