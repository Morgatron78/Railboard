// An update is activated only after an explicit click, outside open dialogs.
export function watchUpdates(registration, {button, serviceWorker = navigator.serviceWorker, documentRef = document, Observer = MutationObserver, reload = () => location.reload()} ) {
  let requested = false;
  const render = () => { button.hidden = !registration.waiting || Boolean(documentRef.querySelector('dialog[open]')); };
  const observeWorker = () => {
    const worker = registration.installing;
    if(worker) worker.addEventListener('statechange',render);
    render();
  };
  registration.addEventListener('updatefound',observeWorker);
  serviceWorker.addEventListener('controllerchange', () => { if(requested) reload(); });
  button.addEventListener('click', () => {
    if(!registration.waiting || documentRef.querySelector('dialog[open]')) return;
    requested = true; button.disabled = true; button.textContent = 'Updating…';
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  });
  const observer = new Observer(render);
  documentRef.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
  let checkedAt = 0;
  documentRef.addEventListener('visibilitychange', () => {
    if(!documentRef.hidden && Date.now()-checkedAt > 60000) {
      checkedAt = Date.now(); registration.update().catch(()=>{});
    }
  });
  observeWorker();
}
