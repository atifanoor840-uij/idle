"use client";
import Script from "next/script";

// Meta (Facebook) browser pixel. Loaded on the sign-up and Buy Challenge pages;
// fires PageView on load. Other events go through trackPixel().
export const META_BROWSER_PIXEL_ID = "1054522126934484";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Fire a standard Meta event; a no-op when the pixel is blocked or not loaded. */
export function trackPixel(event: string, data?: Record<string, unknown>, eventId?: string) {
  try {
    window.fbq?.("track", event, data ?? {}, eventId ? { eventID: eventId } : undefined);
  } catch {
    // Ad blockers can break fbq; tracking must never block the page.
  }
}

export default function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_BROWSER_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${META_BROWSER_PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
