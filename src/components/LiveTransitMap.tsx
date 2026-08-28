import { Capacitor } from '@capacitor/core';
import { useEffect, useState, type MouseEvent } from 'react';
import { translate } from '../i18n';
import type { AppLanguage } from '../i18n';

interface LiveTransitMapProps {
  url: string;
  language: AppLanguage;
  onClose(): void;
}

type FrameStatus = 'loading' | 'ready' | 'slow' | 'failed';

export function LiveTransitMap({ url, language, onClose }: LiveTransitMapProps) {
  const [frameStatus, setFrameStatus] = useState<FrameStatus>('loading');
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    if (frameStatus !== 'loading') return;
    const timer = window.setTimeout(() => setFrameStatus('slow'), 12_000);
    return () => window.clearTimeout(timer);
  }, [frameKey, frameStatus]);

  const retry = () => {
    setFrameStatus('loading');
    setFrameKey((current) => current + 1);
  };

  const openExternal = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!Capacitor.isNativePlatform()) return;
    event.preventDefault();
    window.location.assign(url);
  };

  return (
    <section className="live-map-page">
      <header className="live-map-header">
        <button className="live-map-close" type="button" onClick={onClose}>
          <span aria-hidden="true">←</span> {translate(language, 'close')}
        </button>
        <strong>{translate(language, 'liveMapTitle')}</strong>
        <a
          className="live-map-external-link"
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={openExternal}
        >
          {translate(language, 'openInTransloc')}
        </a>
      </header>

      <p className="live-map-explainer">{translate(language, 'liveMapExplanation')}</p>

      <div className="live-map-frame-shell" aria-busy={frameStatus === 'loading'}>
        <iframe
          key={frameKey}
          className={frameStatus === 'failed' ? 'live-map-frame is-hidden' : 'live-map-frame'}
          src={url}
          title={translate(language, 'liveMapTitle')}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          onLoad={() => setFrameStatus('ready')}
          onError={() => setFrameStatus('failed')}
        />

        {frameStatus === 'loading' && (
          <div className="live-map-message">{translate(language, 'loadingLiveMap')}</div>
        )}
        {(frameStatus === 'slow' || frameStatus === 'failed') && (
          <div className="live-map-fallback" role="status">
            <strong>
              {translate(language, frameStatus === 'slow' ? 'liveMapSlow' : 'liveMapFailed')}
            </strong>
            <button className="secondary-button" type="button" onClick={retry}>
              {translate(language, 'retryEmbed')}
            </button>
            <a
              className="primary-button"
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={openExternal}
            >
              {translate(language, 'openInTransloc')}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
