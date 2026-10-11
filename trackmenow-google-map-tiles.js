/* TrackMeNow — Google Maps Platform Map Tiles API
 * Uses Google's Map Tiles API directly:
 *   - Photorealistic 3D Tiles rendered with CesiumJS
 *   - Google 2D Satellite / Roadmap / Terrain imagery via Map Tiles API sessions
 * API key is resolved from the existing secure Worker configuration endpoint.
 */
(function () {
  'use strict';

  var API = window.TM_API_BASE || 'https://wispy-bush-9aee.recreationeeraj.workers.dev';
  var overlay = null, viewer = null, tileset = null, imageryLayer = null;
  var active = false, loading = false, mode = '3d';
  var GOOGLE_KEY = '';

  function css() {
    if (document.getElementById('tm-google-tiles-css')) return;
    var s = document.createElement('style');
    s.id = 'tm-google-tiles-css';
    s.textContent =
      '#tm-google-tiles{position:fixed;inset:0;z-index:10020;display:none;background:#05080c;color:#eaf6ff;font:12px system-ui,sans-serif}' +
      '#tm-google-tiles.active{display:block}' +
      '#tm-google-tiles-view{position:absolute;inset:0 0 66px 0}' +
      '#tm-google-tiles-view .cesium-viewer{font-family:system-ui,sans-serif}' +
      '#tm-google-tiles-toolbar{position:absolute;z-index:20;top:10px;left:10px;right:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;pointer-events:none}' +
      '#tm-google-tiles-toolbar>*{pointer-events:auto}' +
      '#tm-google-tiles-status{padding:7px 10px;border:1px solid #ffffff24;border-radius:7px;background:#06101de8;color:#cbe7f3;max-width:min(650px,70vw)}' +
      '.tm-gt-btn{border:1px solid #ffffff2b;border-radius:7px;background:#071522ee;color:#eaf7ff;padding:8px 10px;font:800 10px system-ui;cursor:pointer}' +
      '.tm-gt-btn:hover{background:#10283a}.tm-gt-btn.on{background:#15508a;border-color:#58a9ff}.tm-gt-blue{background:#1a73e8;border-color:#5aa0f5;color:#fff}' +
      '#tm-google-tiles-close{margin-left:auto}' +
      '#tm-google-tiles-dock{position:absolute;z-index:20;left:0;right:0;bottom:0;min-height:66px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:7px;background:#040a11f5;border-top:1px solid #ffffff20}' +
      '#tm-google-tiles-dock .tm-gt-btn{min-width:110px}' +
      '#tm-google-tiles-attribution{position:absolute;z-index:21;right:8px;bottom:74px;max-width:min(720px,70vw);padding:3px 6px;color:#fff;background:#0008;font-size:10px;text-shadow:0 1px 2px #000;pointer-events:none}' +
      '#tm-google-tiles-attribution a{color:#fff}' +
      '#tm-google-tiles-open{position:fixed;z-index:10005;right:14px;top:142px;min-height:36px;padding:0 12px;border:1px solid #5aa0f5;border-radius:8px;background:#1a73e8;color:#fff;font:900 10px system-ui;cursor:pointer;box-shadow:0 5px 20px #0006}' +
      '@media(max-width:650px){#tm-google-tiles-toolbar{top:6px;left:6px;right:6px}#tm-google-tiles-status{max-width:calc(100vw - 20px);order:3;flex-basis:100%}#tm-google-tiles-view{bottom:108px}#tm-google-tiles-dock{min-height:108px;padding:5px}.tm-gt-btn{padding:7px 8px;font-size:9px}#tm-google-tiles-dock .tm-gt-btn{min-width:0}#tm-google-tiles-attribution{bottom:112px;left:6px;right:6px;max-width:none}}';
    document.head.appendChild(s);
  }

  function button(label, fn, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tm-gt-btn' + (cls ? ' ' + cls : '');
    b.textContent = label; b.addEventListener('click', fn); return b;
  }

  function ensureUI() {
    if (overlay) return;
    css();
    overlay = document.createElement('section');
    overlay.id = 'tm-google-tiles';
    overlay.setAttribute('aria-label', 'Google Maps Platform Map Tiles');
    var view = document.createElement('div'); view.id = 'tm-google-tiles-view';
    var toolbar = document.createElement('div'); toolbar.id = 'tm-google-tiles-toolbar';
    var status = document.createElement('div'); status.id = 'tm-google-tiles-status'; status.textContent = 'Google Map Tiles ready.';
    var close = button('TRACKMENOW MAP', closeTiles); close.id = 'tm-google-tiles-close';
    toolbar.append(status, close);
    var attribution = document.createElement('div');
    attribution.id = 'tm-google-tiles-attribution';
    attribution.textContent = 'Google Maps Platform · Map Tiles API';
    var dock = document.createElement('div'); dock.id = 'tm-google-tiles-dock';
    dock.appendChild(button('3D PHOTOREALISTIC', function(){switchMode('3d')}, 'tm-gt-blue'));
    dock.appendChild(button('2D SATELLITE', function(){switchMode('satellite')}));
    dock.appendChild(button('2D ROADMAP', function(){switchMode('roadmap')}));
    dock.appendChild(button('2D TERRAIN', function(){switchMode('terrain')}));
    dock.appendChild(button('TRACKMENOW CENTER', function(){flyToTrackMeNow()}));
    overlay.append(view, toolbar, attribution, dock);
    document.body.appendChild(overlay);

    var open = button('GOOGLE MAP TILES', openTiles, 'tm-gt-blue');
    open.id = 'tm-google-tiles-open';
    document.body.appendChild(open);
  }

  function setStatus(s, error) {
    var n = document.getElementById('tm-google-tiles-status');
    if (n) { n.textContent = s; n.style.color = error ? '#ffaaaa' : '#cbe7f3'; }
  }

  async function resolveKey() {
    var direct = String(window.TM_GOOGLE_MAPS_API_KEY || window.TM_GOOGLE_MAPS_3D_API_KEY || '').trim(); if (!direct) { try { direct = String(localStorage.getItem('TM_GOOGLE_MAPS_API_KEY') || localStorage.getItem('TM_GOOGLE_MAPS_3D_API_KEY') || '').trim(); } catch (e) {} }
    if (direct) return direct;
    try {
      var r = await fetch(API + '/api/google/maps-config', {cache:'no-store'});
      var j = await r.json();
      if (j && j.configured && j.key) {
        GOOGLE_KEY = String(j.key);
        window.TM_GOOGLE_MAPS_API_KEY = GOOGLE_KEY;
        window.TM_GOOGLE_MAPS_3D_API_KEY = GOOGLE_KEY;
        return GOOGLE_KEY;
      }
    } catch (e) {}
    return '';
  }

  function loadCesium() {
    if (window.Cesium) return Promise.resolve(window.Cesium);
    if (window.__tmCesiumPromise) return window.__tmCesiumPromise;
    window.__tmCesiumPromise = new Promise(function(resolve, reject) {
      window.CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.146/Build/Cesium/';
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = window.CESIUM_BASE_URL + 'Widgets/widgets.css';
      document.head.appendChild(link);
      var s = document.createElement('script');
      s.src = window.CESIUM_BASE_URL + 'Cesium.js';
      s.async = true;
      s.onload = function(){ resolve(window.Cesium); };
      s.onerror = function(){ reject(new Error('CesiumJS could not be loaded.')); };
      document.head.appendChild(s);
    });
    return window.__tmCesiumPromise;
  }

  function trackCenter() {
    var m = window.map || window.maplibre;
    if (m && typeof m.getCenter === 'function') {
      var c = m.getCenter();
      return {lat:Number(c.lat)||20,lng:Number(c.lng)||15};
    }
    return {lat:20,lng:15};
  }

  function trackZoom() {
    var m = window.map || window.maplibre;
    return m && typeof m.getZoom === 'function' ? Number(m.getZoom()) || 3 : 3;
  }

  async function ensureViewer() {
    var Cesium = await loadCesium();
    var key = await resolveKey();
    if (!key) throw new Error('Google Maps API key is unavailable. Configure the existing Worker Google Maps key.');
    if (viewer) return {Cesium:Cesium,key:key};

    viewer = new Cesium.Viewer('tm-google-tiles-view', {
      imageryProvider: false,
      baseLayerPicker: false,
      geocoder: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity
    });
    viewer.scene.globe.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#05080c');
    Cesium.RequestScheduler.requestsByServer['tile.googleapis.com:443'] = 18;
    return {Cesium:Cesium,key:key};
  }

  async function load3D() {
    var x = await ensureViewer(), Cesium=x.Cesium, key=x.key;
    if (imageryLayer) { viewer.imageryLayers.remove(imageryLayer, true); imageryLayer=null; }
    viewer.scene.globe.show = false;
    if (tileset) {
      tileset.show = true;
    } else {
      setStatus('Checking Google Photorealistic 3D Tiles access…');
      var tilesUrl='https://tile.googleapis.com/v1/3dtiles/root.json?key='+encodeURIComponent(key);
      var probe = null;
      setStatus('Loading Google Photorealistic 3D Earth…');
      if (Cesium.Cesium3DTileset.fromUrl) {
        tileset = await Cesium.Cesium3DTileset.fromUrl(tilesUrl,{showCreditsOnScreen:true,skipLevelOfDetail:true});
      } else {
        tileset = new Cesium.Cesium3DTileset({url:tilesUrl,showCreditsOnScreen:true,skipLevelOfDetail:true});
        if (tileset.readyPromise) await tileset.readyPromise;
      }
      viewer.scene.primitives.add(tileset);
      viewer.scene.globe.show = false;
      if (tileset.loadProgress) tileset.loadProgress.addEventListener(function(queued,processing){ if(queued||processing) setStatus('Google 3D Earth · loading '+queued+' tiles'); viewer.scene.requestRender(); });
    }
    var c=trackCenter();
    var height=Math.max(12000,500000/Math.max(1,Math.pow(2,trackZoom()-2)));
    viewer.camera.flyTo({
      destination:Cesium.Cartesian3.fromDegrees(c.lng,c.lat,height),
      orientation:{heading:0,pitch:-Cesium.Math.toRadians(62),roll:0},
      duration:1.1,
      complete:function(){ viewer.scene.requestRender(); }
    });
    viewer.scene.requestRender();
    setStatus('Google Map Tiles API · PHOTOREALISTIC 3D TILES active. CesiumJS is rendering Google 3D Tiles.');
  }

  async function load2D(mapType) {
    var x=await ensureViewer(), Cesium=x.Cesium, key=x.key;
    if (tileset) tileset.show=false;
    viewer.scene.globe.show=true;
    if (imageryLayer) { viewer.imageryLayers.remove(imageryLayer,true); imageryLayer=null; }
    setStatus('Opening Google '+mapType.toUpperCase()+' 2D Map Tiles…');
    var provider=await Cesium.Google2DImageryProvider.fromUrl({
      key:key,
      mapType:mapType,
      language:'en-US',
      region:'IN'
    });
    imageryLayer=viewer.imageryLayers.addImageryProvider(provider);
    var c=trackCenter();
    viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(c.lng,c.lat,Math.max(25000,1000000/Math.max(1,trackZoom()))),duration:0.9});
    setStatus('Google Map Tiles API · 2D '+mapType.toUpperCase()+' active.');
  }

  async function switchMode(next) {
    if (!active || loading) return;
    loading=true; mode=next;
    try {
      if(next==='3d') await load3D();
      else await load2D(next);
    } catch(e) {
      console.error('[TrackMeNow] Google Map Tiles error', e);
      if (viewer) { viewer.scene.globe.show = false; viewer.scene.requestRender(); }
      setStatus((e && e.message ? e.message : 'Google Map Tiles failed to load.') + ' Enable Map Tiles API + billing and use a Map Tiles-compatible key.',true);
    } finally { loading=false; }
  }

  function flyToTrackMeNow() {
    if (!viewer || !window.Cesium) return;
    var c=trackCenter();
    viewer.camera.flyTo({
      destination:window.Cesium.Cartesian3.fromDegrees(c.lng,c.lat,mode==='3d'?Math.max(35000,900000/Math.max(1,Math.pow(2,trackZoom()-2))):Math.max(25000,1000000/Math.max(1,trackZoom()))),
      orientation:mode==='3d'?{heading:0,pitch:-window.Cesium.Math.toRadians(62),roll:0}:undefined,
      duration:0.8,
      complete:function(){ viewer.scene.requestRender(); }
    });
  }

  async function openTiles() {
    ensureUI();
    if (window.TrackMeNowGoogleEarth && window.TrackMeNowGoogleEarth.isActive && window.TrackMeNowGoogleEarth.isActive()) window.TrackMeNowGoogleEarth.close();
    if (window.TrackMeNowGoogleLiveMap && window.TrackMeNowGoogleLiveMap.isActive && window.TrackMeNowGoogleLiveMap.isActive()) window.TrackMeNowGoogleLiveMap.close();
    active=true; overlay.classList.add('active');
    setStatus('Activating Google Maps Platform Map Tiles…');
    await switchMode(mode);
  }

  async function open3D() {
    ensureUI();
    if (window.TrackMeNowGoogleLiveMap && window.TrackMeNowGoogleLiveMap.isActive && window.TrackMeNowGoogleLiveMap.isActive()) {
      window.TrackMeNowGoogleLiveMap.close();
    }
    active = true;
    mode = '3d';
    overlay.classList.add('active');
    setStatus('Loading Google Photorealistic 3D Tiles with CesiumJS…');
    await switchMode('3d');
    return viewer;
  }

  function closeTiles() {
    active=false;
    if(overlay) overlay.classList.remove('active');
  }

  function init() {
    ensureUI();
    window.TrackMeNowGoogleMapTiles = {open:openTiles,open3D:open3D,close:closeTiles,isActive:function(){return active;}};
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();