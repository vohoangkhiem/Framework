import type { BrowserContext } from '@playwright/test';

/**
 * The media player library the application loads on every page (`video.min.js`) and its HLS
 * plugin. Both are served by the application's own origin under `node_modules/`.
 */
export const MEDIA_LIBRARY_SCRIPTS = /\/(video\.min\.js|videojs-contrib-hls\.min\.js)(\?.*)?$/;

/** HLS playlists and MPEG-TS segments. The CDN host comes from the application's `config.json`. */
export const MEDIA_STREAM_REQUESTS = /\.(m3u8|ts)(\?.*)?$/;

/**
 * Inert stand-in for video.js. Every property of the exported object is itself callable and
 * returns the object again, so the application's `videojs('example-video').src(...)` and
 * `.pause()` calls succeed without ever attaching a source to the `<video>` element.
 */
export const INERT_VIDEOJS_SCRIPT = `/* Inert video.js served by the test framework (src/api/mocks/media-player-stub.ts). */
(function () {
  'use strict';
  var inert = new Proxy(function () {}, {
    get: function (_target, property) {
      if (property === 'then') {
        return undefined; // never mistaken for a thenable
      }
      if (property === Symbol.toPrimitive || property === 'toString' || property === 'valueOf') {
        return function () {
          return '';
        };
      }
      return inert;
    },
    set: function () {
      return true;
    },
    apply: function () {
      return inert;
    },
    construct: function () {
      return inert;
    },
  });
  window.videojs = inert;
})();
`;

/**
 * Replaces the application's video player with an inert stub for every page of `context` and
 * aborts HLS traffic, so the browser never builds a media pipeline.
 *
 * Why: each Demoblaze page instantiates a video.js HLS player (inside a modal no test opens) as
 * soon as `config.json` has loaded. The player attaches a MediaSource to the `<video>` element,
 * which on WebKit/Linux is backed by a GStreamer pipeline. In the Playwright container that
 * pipeline's teardown during the next navigation crashed the page: every WebKit test that
 * navigated a second time (home -> product, login reload, header -> cart, delete-item reload)
 * failed with "Page crashed" or with a dead page ("element(s) not found", `Received: undefined`),
 * while Chromium and Firefox ran the same steps green. The video is never the subject of a test,
 * so the stub removes a non-functional dependency rather than hiding a defect.
 *
 * Registered at context level so page-level routes (`RouteMocker`) keep precedence.
 */
export async function stubMediaPlayer(context: BrowserContext): Promise<void> {
  await context.route(MEDIA_LIBRARY_SCRIPTS, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: INERT_VIDEOJS_SCRIPT,
    })
  );
  await context.route(MEDIA_STREAM_REQUESTS, route => route.abort('blockedbyclient'));
}
