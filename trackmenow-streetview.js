/* TrackMeNow — Street View mode inside the common landing workspace.
 * Street View is launched directly from the landing map with a persistent Pegman control.
 * Drag Pegman onto the map to enter Street View at that exact point; there is no separate Street View tab.
 * Uses the Maps JavaScript API Street View panorama (not a small Embed API iframe),
 * so the panorama fills the viewport and supports Google-style navigation controls.
 */
(function () {
  'use strict';

  var map = null;
  var googleKey = '';
  var attached = null;
  var active = false;
  var overlay = null;
  var panoramaHost = null;
  var statusEl = null;
  var closeBtn = null;
  var pegmanBtn = null;
  var panorama = null;
  var apiPromise = null;
  var requestToken = 0;

  function key() {
    return String(window.TM_GOOGLE_MAPS_API_KEY || '').trim();
  }

  function ensureDom() {
    if (overlay) return;
    var style = document.createElement('style');
    style.id = 'tm-streetview-css';
    style.textContent =
      '' +
      '#tm-streetview-overlay{position:fixed;inset:58px 0 var(--tm-dock-h,76px) 0;z-index:10010;background:#05080c;display:none}' +
      '#tm-streetview-overlay.open{display:block}' +
      '#tm-streetview-panorama{position:absolute;inset:0;width:100%;height:100%;background:#080d12}' +
      '#tm-streetview-head{position:absolute;left:12px;top:12px;z-index:5;display:flex;align-items:center;gap:10px;max-width:calc(100% - 24px);padding:8px 10px;border:1px solid rgba(180,210,230,.2);border-radius:9px;background:rgba(4,10,16,.88);color:#dff4ff;font:700 11px system-ui;box-shadow:0 4px 20px rgba(0,0,0,.25)}' +
      '#tm-streetview-title{max-width:min(62vw,520px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#tm-streetview-close{border:0;border-radius:5px;padding:5px 8px;background:rgba(255,255,255,.1);color:#fff;font:700 14px system-ui;cursor:pointer}' +
      '#tm-streetview-pegman{position:fixed;right:18px;top:calc(58px + 16px);z-index:10020;width:48px;height:48px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:rgba(4,10,16,.94);color:#fff;cursor:grab;box-shadow:0 5px 22px rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none}' +
      '#tm-streetview-pegman svg{width:31px;height:31px;display:block}' +
      '#tm-streetview-pegman.on{outline:2px solid rgba(98,215,255,.65);box-shadow:0 0 0 4px rgba(98,215,255,.12),0 5px 22px rgba(0,0,0,.38)}' +
      '#tm-streetview-status{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;max-width:min(560px,calc(100% - 32px));padding:14px 16px;border:1px solid rgba(160,200,225,.22);border-radius:10px;background:rgba(4,10,16,.95);color:#cfe3ee;font:13px/1.55 system-ui;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.4)}' +
      '#tm-streetview-status[hidden]{display:none}' +
      '#tm-streetview-status a{color:#62d7ff}' +
      '' +
      '@media(max-width:600px){#tm-streetview-head{left:8px;top:8px}#tm-streetview-overlay{inset:52px 0 0 0}}';
    document.head.appendChild(style);

    overlay = document.createElement('section');
    overlay.id = 'tm-streetview-overlay';
    overlay.setAttribute('aria-label', 'Google Street View panorama');
    panoramaHost = document.createElement('div');
    panoramaHost.id = 'tm-streetview-panorama';
    var head = document.createElement('div');
    head.id = 'tm-streetview-head';
    var title = document.createElement('span');
    title.id = 'tm-streetview-title';
    title.textContent = 'GOOGLE STREET VIEW';
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'tm-streetview-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close Street View');
    statusEl = document.createElement('div');
    statusEl.id = 'tm-streetview-status';
    statusEl.setAttribute('role', 'status');
    statusEl.hidden = true;
    head.appendChild(title);
    head.appendChild(closeBtn);
    overlay.appendChild(panoramaHost);
    overlay.appendChild(head);
    overlay.appendChild(statusEl);
    document.body.appendChild(overlay);

    pegmanBtn = document.createElement('button');
    pegmanBtn.type='button'; pegmanBtn.id='tm-streetview-pegman'; pegmanBtn.title='Drag Pegman onto the map to enter Street View'; pegmanBtn.draggable=true;
    pegmanBtn.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="6.5" r="4.5" fill="#fbbc04"/><path d="M10.2 12.3c.9-1.3 2.4-2.1 4-2.1h3.6c1.6 0 3.1.8 4 2.1l2.8 4.2-3.2 2.1-2.3-3.2-.6 2.7 3.2 8.4h-4.1l-1.8-5.2-1.8 5.2h-4.1l3.2-8.4-.6-2.7-2.3 3.2-3.2-2.1 2.8-4.2z" fill="#fbbc04"/></svg>';
    pegmanBtn.addEventListener('click',function(){active=!active;pegmanBtn.classList.toggle('on',active);if(map&&map.getCanvas)map.getCanvas().style.cursor=active?'crosshair':'';});
    pegmanBtn.addEventListener('dragstart',function(e){active=true;pegmanBtn.classList.add('on');if(e.dataTransfer){e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/plain','trackmenow-streetview');}});
    document.body.appendChild(pegmanBtn);
    closeBtn.addEventListener('click', hideView);
    var targets=[document.getElementById('map'),document.getElementById('tm-google-earth-stage')];
    targets.forEach(function(target){
      if(!target)return;
      target.addEventListener('dragover',function(event){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';if(pegmanBtn){pegmanBtn.classList.add('on');}});
      target.addEventListener('drop',function(event){event.preventDefault();
        if(target.id==='map'&&map&&typeof map.unproject==='function'){
          var rect=target.getBoundingClientRect();var p=map.unproject([event.clientX-rect.left,event.clientY-rect.top]);
          active=false;if(pegmanBtn)pegmanBtn.classList.remove('on');if(map.getCanvas)map.getCanvas().style.cursor='';showAt(p.lat,p.lng);
        }
      });
    });
  }

  function showStatus(message, html) {
    if (!statusEl) return;
    statusEl.replaceChildren();
    if (html) statusEl.innerHTML = message;
    else statusEl.textContent = message;
    statusEl.hidden = false;
  }

  function hideStatus() {
    if (statusEl) statusEl.hidden = true;
  }

  function hideView() {
    if (overlay) overlay.classList.remove('open');
    active=false;if(pegmanBtn)pegmanBtn.classList.remove('on');
    if (map && map.getCanvas) map.getCanvas().style.cursor='';
    hideStatus();
    if (panorama && typeof panorama.setVisible === 'function') panorama.setVisible(false);
    if (map && map.getCanvas) map.getCanvas().style.cursor = active ? 'crosshair' : '';
  }

  async function resolveKey() {
    var k = key();
    if (k) return k;
    try {
      var r = await fetch((window.TM_API_BASE || 'https://wispy-bush-9aee.recreationeeraj.workers.dev') + '/api/google/maps-config', { cache: 'no-store' });
      var j = await r.json();
      if (j && j.configured && j.key) {
        googleKey = String(j.key);
        window.TM_GOOGLE_MAPS_API_KEY = googleKey;
        window.TM_GOOGLE_MAPS_3D_API_KEY = googleKey;
        return googleKey;
      }
    } catch (e) {}
    return '';
  }

  async function loadGoogleApi() {
    if (window.google && window.google.maps && typeof window.google.maps.importLibrary === 'function') {
      return;
    }
    if (apiPromise) return apiPromise;
    var k = await resolveKey();
    if (!k) throw new Error('Google Maps browser key is unavailable. TrackMeNow checked both the published build and the secure Worker configuration endpoint.');
    apiPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-tm-google-3d-api]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', function () { reject(new Error('Google Maps JavaScript API failed to load. Check key restrictions and enabled APIs.')); }, { once: true });
        return;
      }
      var script = document.createElement('script');
      script.dataset.tmGoogle3dApi = '1';
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(k) + '&v=weekly&loading=async&libraries=streetView,maps3d';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Google Maps JavaScript API failed to load. Check the browser key restrictions and API access.')); };
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  async function showAt(lat, lon) {
    ensureDom();
    var token = ++requestToken;
    overlay.classList.add('open');
    panoramaHost.style.display = 'block';
    hideStatus();
    var title = document.getElementById('tm-streetview-title');
    title.textContent = 'GOOGLE STREET VIEW · ' + Number(lat).toFixed(5) + ', ' + Number(lon).toFixed(5);
    showStatus('Finding the nearest available Google Street View panorama…');

    try {
      await loadGoogleApi();
      if (token !== requestToken) return;
      var lib = null;
      if (window.google.maps && typeof window.google.maps.importLibrary === 'function') {
        lib = await window.google.maps.importLibrary('streetView');
      }
      if (token !== requestToken) return;
      var StreetViewPanorama = lib && lib.StreetViewPanorama ? lib.StreetViewPanorama : window.google.maps.StreetViewPanorama;
      var StreetViewService = lib && lib.StreetViewService ? lib.StreetViewService : window.google.maps.StreetViewService;
      var StreetViewStatus = lib && lib.StreetViewStatus ? lib.StreetViewStatus : window.google.maps.StreetViewStatus;
      if (!StreetViewPanorama || !StreetViewService) {
        throw new Error('Google Street View library is unavailable. Confirm Maps JavaScript API is enabled for this key.');
      }

      if (!panorama) {
        panorama = new StreetViewPanorama(panoramaHost, {
          position: { lat: Number(lat), lng: Number(lon) },
          pov: { heading: 0, pitch: 0 },
          zoom: 0,
          addressControl: true,
          fullscreenControl: true,
          linksControl: true,
          panControl: true,
          zoomControl: true,
          motionTracking: false,
          visible: false
        });
      }

      var service = new StreetViewService();
      var request = {
        location: { lat: Number(lat), lng: Number(lon) },
        radius: 100,
        source: window.google.maps.StreetViewSource ? window.google.maps.StreetViewSource.DEFAULT : undefined
      };
      var result = await service.getPanorama(request).catch(function () { return null; });
      var resultStatus = result && result.status;
      if (!result || (resultStatus && resultStatus !== 'OK' && (!StreetViewStatus || resultStatus !== StreetViewStatus.OK))) {
        // A map click may be a little away from a road. Retry a wider search before declaring no coverage.
        request.radius = 1000;
        result = await service.getPanorama(request).catch(function () { return null; });
      }

      if (token !== requestToken) return;
      var data = result && result.data ? result.data : result;
      var status = result && result.status;
      if (!result) throw new Error('Google could not find a Street View panorama within 1 km. Try a nearby road or another location.');
      if (status && StreetViewStatus && status !== StreetViewStatus.OK && status !== 'OK') {
        throw new Error('No Street View panorama is available within 1 km of this point. Try a nearby road or another location.');
      }
      var location = data && data.location;
      if (!location || !location.latLng) {
        // Some API versions resolve the panorama result directly; accept only a real panorama ID.
        if (!data || !data.location || !data.location.pano) {
          throw new Error('Google returned no Street View panorama here. Street View coverage varies by road and country.');
        }
      }
      panorama.setPano(data.location.pano);
      panorama.setPov({ heading: 0, pitch: 0 });
      panorama.setVisible(true);
      panoramaHost.style.display = 'block';
      hideStatus();
    } catch (err) {
      if (token !== requestToken) return;
      panoramaHost.style.display = 'none';
      var message = err && err.message ? err.message : 'Street View could not be loaded.';
      showStatus(message + ' Google key: ' + (key() ? 'PRESENT' : 'MISSING') + '. Enable Maps JavaScript API + Street View, billing, and authorize connectingprofessional.github.io in the same key.');
    }
  }

  function onMapClick(ev) {
    if (!active || !ev || !ev.lngLat) return;
    showAt(ev.lngLat.lat, ev.lngLat.lng);
  }

  function install() {
    if (!map || attached === map) return;
    if (attached && attached.off) attached.off('click', onMapClick);
    attached = map;
    ensureDom();
    map.on('click', onMapClick);
  }

  function seekMap() {
    var attempts = 0;
    var timer = setInterval(function () {
      var candidate = window.map || window.maplibre;
      if (candidate && typeof candidate.on === 'function' && typeof candidate.getCanvas === 'function') {
        map = candidate;
        install();
        if (attached === map) clearInterval(timer);
      }
      if (++attempts > 120) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', seekMap);
  else seekMap();

  window.TrackMeNowStreetView = {
    attach: function (m) { map = m; install(); },
    show: showAt,
    openCurrent: function () {
      ensureDom();
      if(overlay) overlay.classList.remove('open');
      active=true;if(pegmanBtn)pegmanBtn.classList.add('on');
      if(map&&map.getCanvas)map.getCanvas().style.cursor='crosshair';
    },
    handleEarthClick: function(pos){if(pos&&Number.isFinite(Number(pos.lat))&&Number.isFinite(Number(pos.lng)))showAt(Number(pos.lat),Number(pos.lng));},
    hide: hideView,
    activate: function(){ensureDom();active=true;if(pegmanBtn)pegmanBtn.classList.add('on');if(map&&map.getCanvas)map.getCanvas().style.cursor='crosshair';}
  };
})();
