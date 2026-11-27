import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';

/** The QR payload is only the public verification URL. It carries no Fayda data, passwords or tokens. */
function verificationUrl(code: string): string {
  return `${window.location.origin}/verify/${code}`;
}

export function CardQr({ code }: { code: string }) {
  const url = verificationUrl(code);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    toDataURL(url, {
      margin: 1,
      width: 168,
      errorCorrectionLevel: 'M',
      // Scanners need a dark code on a light ground, independent of the app theme.
      color: { dark: '#04211c', light: '#ffffff' },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl bg-white p-2">
        {dataUrl ? (
          <img src={dataUrl} alt="" width={168} height={168} />
        ) : (
          <p className="flex h-[168px] w-[168px] items-center px-3 text-center text-small text-ink-secondary">
            QR code is unavailable in this browser.
          </p>
        )}
      </div>
      <a href={url} className="text-small font-medium text-primary hover:underline">
        Open verification page
      </a>
    </div>
  );
}
