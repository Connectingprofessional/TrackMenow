/* TrackMeNow — Google Photorealistic 3D Tiles bridge.
 * IMPORTANT: Photorealistic 3D Tiles are rendered by CesiumJS through
 * https://tile.googleapis.com/v1/3dtiles/root.json
 * The Maps JavaScript "Map3DElement" API is intentionally NOT used here.
 */
(function () {
  'use strict';

  var active = false;

  function init() {
    window.TrackMeNowGoogleEarth = {
      open: function () {
        active = true;
        if (window.TrackMeNowGoogleMapTiles && typeof window.TrackMeNowGoogleMapTiles.open3D === 'function') {
          return window.TrackMeNowGoogleMapTiles.open3D();
        }
        throw new Error('Google Photorealistic 3D Tiles renderer is not loaded.');
      },
      close: function () {
        active = false;
        if (window.TrackMeNowGoogleMapTiles && typeof window.TrackMeNowGoogleMapTiles.close === 'function') {
          window.TrackMeNowGoogleMapTiles.close();
        }
      },
      isActive: function () {
        return active || !!(window.TrackMeNowGoogleMapTiles &&
          typeof window.TrackMeNowGoogleMapTiles.isActive === 'function' &&
          window.TrackMeNowGoogleMapTiles.isActive());
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();