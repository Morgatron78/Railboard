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
    resize() { map?.resize(); },
    destroy() { ++revision; marker?.remove(); map?.remove(); marker = map = null; }
  };
}

export function expandableMap(dialog, panel, resize) {
  function setExpanded(expanded) {
    dialog.classList.toggle('map-expanded', expanded);
    const button = panel.querySelector('.expand-map');
    if(button) { button.textContent = expanded ? 'Back to service details' : 'Expand map'; button.setAttribute('aria-expanded', String(expanded)); }
    resize();
    button?.focus({preventScroll:true});
  }
  const click = event => { if(event.target.closest('.expand-map')) setExpanded(!dialog.classList.contains('map-expanded')); };
  const cancel = event => {
    if(dialog.classList.contains('map-expanded')) { event.preventDefault(); setExpanded(false); }
  };
  panel.addEventListener('click', click);
  dialog.addEventListener('cancel', cancel);
  return {
    reset() { if(dialog.classList.contains('map-expanded')) setExpanded(false); },
    dispose() { dialog.classList.remove('map-expanded'); panel.removeEventListener('click',click); dialog.removeEventListener('cancel',cancel); }
  };
}
