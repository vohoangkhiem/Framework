import { MEDIA_LIBRARY_SCRIPTS, MEDIA_STREAM_REQUESTS } from '@api/mocks/media-player-stub';
import { TAGS, tags } from '@config/test-tags';
import { expect, test } from '@fixtures';

interface InertPlayer {
  src(source: { src: string; type: string }): InertPlayer;
  pause(): InertPlayer;
}
type VideoJsWindow = Window & { videojs: (elementId: string) => InertPlayer };

/**
 * Every Demoblaze page loads a video.js HLS player that no test exercises; the framework serves
 * an inert stand-in instead (see `stubMediaPlayer`), because WebKit on Linux crashed while tearing
 * the real player's media pipeline down between navigations. These tests run against a static
 * document, so raw `page` calls are acceptable here.
 */
test.describe('Media player stub', tags(TAGS.framework), () => {
  test('matches the player library and stream URLs the application uses', () => {
    const origin = 'https://www.demoblaze.com';
    expect(`${origin}/node_modules/video.js/dist/video.min.js`).toMatch(MEDIA_LIBRARY_SCRIPTS);
    expect(`${origin}/node_modules/videojs-contrib-hls/dist/videojs-contrib-hls.min.js`).toMatch(
      MEDIA_LIBRARY_SCRIPTS
    );
    expect(`${origin}/js/index.js`).not.toMatch(MEDIA_LIBRARY_SCRIPTS);
    expect(`${origin}/node_modules/jquery/dist/jquery.min.js`).not.toMatch(MEDIA_LIBRARY_SCRIPTS);

    expect('https://hls.demoblaze.com/index.m3u8').toMatch(MEDIA_STREAM_REQUESTS);
    expect('https://hls.demoblaze.com/about_demo_hls_600k00000.ts').toMatch(MEDIA_STREAM_REQUESTS);
    expect('https://api.demoblaze.com/entries').not.toMatch(MEDIA_STREAM_REQUESTS);
    expect(`${origin}/prod.html?idp_=1`).not.toMatch(MEDIA_STREAM_REQUESTS);
  });

  test('serves an inert player so the page scripts run without attaching a media source', async ({
    page,
  }) => {
    await page.setContent(`
      <video id="example-video"></video>
      <script src="https://www.demoblaze.com/node_modules/video.js/dist/video.min.js"></script>
    `);

    // The exact calls index.js, prod.js and cart.js make once config.json has loaded.
    const outcome = await page.evaluate(() => {
      const player = (window as unknown as VideoJsWindow).videojs('example-video');
      player.src({ src: 'https://hls.demoblaze.com/index.m3u8', type: 'application/x-mpegURL' });
      player.pause();
      const video = document.querySelector('video');
      return { currentSrc: video?.currentSrc ?? 'missing', hasSrc: video?.hasAttribute('src') };
    });

    expect(outcome).toStrictEqual({ currentSrc: '', hasSrc: false });
  });

  test('aborts HLS playlists and segments before they reach the network', async ({ page }) => {
    const failedRequest = page.waitForEvent('requestfailed', request =>
      request.url().endsWith('/index.m3u8')
    );
    await page.setContent('<img src="https://hls.demoblaze.com/index.m3u8" alt="">');

    const request = await failedRequest;
    expect(request.failure()?.errorText).toMatch(/BLOCKED_BY_CLIENT|blocked/i);
  });
});
