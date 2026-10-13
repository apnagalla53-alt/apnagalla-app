import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import api from '../../shared/api';
import './item-photo.css';

/** Fetch private image content only when its card approaches the viewport. */
export default function ItemPhoto({ id, name }: { id: string; name: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, objectUrl = '', started = false;
    setUrl(''); setFailed(false);
    const load = async () => {
      if (started) return; started = true;
      try {
        const response = await api.get('/attachments/' + encodeURIComponent(id) + '/content', { responseType: 'blob' });
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data); setUrl(objectUrl);
      } catch { if (active) setFailed(true); }
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); void load(); }
    }, { rootMargin: '100px' });
    if (observer && frame.current) observer.observe(frame.current); else void load();
    return () => { active = false; observer?.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  return <span className="r-item-photo" ref={frame}>
    {url && !failed ? <img src={url} alt={name + ' photo'} onError={() => setFailed(true)} /> : failed ? <ImageOff size={20} aria-label="Item photo unavailable" /> : <span aria-hidden="true" className="r-skeleton" />}
  </span>;
}
