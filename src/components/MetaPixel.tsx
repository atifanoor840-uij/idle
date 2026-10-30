// Meta (Facebook) browser pixel, hardcoded. Rendered as a plain <script> in the
// <head> of the marketing and portal root layouts, so it is in the server HTML of
// every public and trader page and fires PageView on load. Other events go
// through trackPixel().
export const META_BROWSER_PIXEL_ID = "1054522126934484";

const PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1054522126934484');
fbq('track', 'PageView');`;

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

/** Put inside <head>. */
export function MetaPixelHead() {
  return <script id="meta-pixel" dangerouslySetInnerHTML={{ __html: PIXEL_SNIPPET }} />;
}

/** Put inside <body>: the no-JavaScript fallback. */
export function MetaPixelNoscript() {
  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img height="1" width="1" style={{ display: "none" }} alt="" src="https://www.facebook.com/tr?id=1054522126934484&ev=PageView&noscript=1" />
    </noscript>
  );
}
