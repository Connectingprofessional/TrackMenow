/* TrackMeNow — Google Live compatibility facade.
 * The application has ONE Earth map workspace. This legacy secondary Google map
 * renderer intentionally creates no second map/canvas/overlay.
 * Live movement, cameras and GPS are rendered by the common TrackMeNow map.
 */
(function(){
  'use strict';
  window.TrackMeNowGoogleLiveMap={
    open:function(){
      if(window.TrackMeNowGoogleMapTiles&&window.TrackMeNowGoogleMapTiles.open2D){
        return window.TrackMeNowGoogleMapTiles.open2D('roadmap');
      }
      return Promise.resolve();
    },
    close:function(){},
    isActive:function(){return false;},
    setMapType:function(type){
      if(window.TrackMeNowGoogleMapTiles&&window.TrackMeNowGoogleMapTiles.open2D){
        return window.TrackMeNowGoogleMapTiles.open2D(type||'roadmap');
      }
    }
  };
})();