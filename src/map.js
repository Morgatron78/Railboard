let library;
function loadLibrary() {
  if (library) return library;
  library = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css';
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js';
    const timer = setTimeout(fail, 15000);
    function fail() { clearTimeout(timer); css.remove(); script.remove(); library = null; reject(new Error('Map library unavailable')); }
    script.onerror = css.onerror = fail;
    let styled = false, loaded = false;
    const ready = () => { if(styled && loaded) { clearTimeout(timer); resolve(window.maplibregl); } };
    css.onload = () => { styled = true; ready(); };
    script.onload = () => { loaded = true; ready(); };
    document.head.append(css, script);
  });
  return library;
}

// Keep the map and camera alive between reports; discard late loads after closing.
export function createTrainMap({load = loadLibrary} = {}) {
  let map, marker, revision = 0;
  return {
    async show(container, position, onError) {
      const request = ++revision;
      const gl = await load();
      if(request !== revision) return;
      const coordinates = [position.lon, position.lat];
      if(!map) {
        map = new gl.Map({container, style:'https://tiles.openfreemap.org/styles/liberty',
          center:coordinates, zoom:12, attributionControl:true});
        map.addControl(new gl.NavigationControl({showCompass:false}), 'top-right');
        map.on('error', onError);
        marker = new gl.Marker({color:'#003b73'}).setLngLat(coordinates).addTo(map);
      } else marker.setLngLat(coordinates);
    },
    destroy() { ++revision; marker?.remove(); map?.remove(); marker = map = null; }
  };
}
