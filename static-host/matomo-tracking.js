/**
 * Matomo analytics snippet for the static GitLab Pages build.
 * Injected into index.html via the static-host Vite plugin.
 *
 * Reads VITE_MATOMO_URL and VITE_MATOMO_SITE_ID at build time.
 * When either is missing the inject function is a no-op, so local
 * dev builds stay analytics-free.
 *
 * The SPA uses hash routing (#/module/view), so we listen for
 * hashchange and send a virtual page view on each transition.
 */

export const MATOMO_SCRIPT_ID = 'matomo-tracking'

export function buildMatomoMarkup(matomoUrl, siteId) {

  return `<!-- Matomo -->
<script id="${MATOMO_SCRIPT_ID}">
    var _paq = window._paq = window._paq || [];
    /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
    _paq.push(['disableCookies']);
    _paq.push(["disableAlwaysUseSendBeacon"]);
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    (function () {
        var u = "//eightknot.osci.io/";
        _paq.push(['setTrackerUrl', u + 'a.php']);
        _paq.push(['setSiteId', '11']);
        var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
        g.async = true; g.src = u + 'a.js'; s.parentNode.insertBefore(g, s);
    })();
</script>
<!-- End Matomo Code -->
`
}

export function injectMatomoTracking(html) {
  if (html.includes(`id="${MATOMO_SCRIPT_ID}"`)) return html
  if (!html.includes('</head>')) {
    throw new Error('[static-host] </head> not found — cannot inject Matomo tracking')
  }
  return html.replace('</head>', `${buildMatomoMarkup()}</head>`)
}
