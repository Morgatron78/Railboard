const key = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
// A calling-point prediction is not evidence that a cancelled service is reinstated.
export function detailStatus(service, call) {
  if(service.status === 'cancelled' || call?.status === 'cancelled') return 'cancelled';
  if(!call) return service.status;
  return ({late:'delayed',early:'early',on_time:'on-time'})[call.status] || 'unknown';
}
export function journeyProgress(points) {
  if (!points.length) return '';
  if (points.every(p => p.passed || p.status === 'departed')) return 'Journey complete';
  if (points.some(p => p.here && (p.passed || p.status === 'departed'))) return 'Departed selected station';
  return '';
}
export function favouriteStop(points, favourite, cancelled = false) {
  if (!key(favourite)) return null;
  const index = points.findIndex(point => key(point.name) === key(favourite));
  if (index < 0) return { found:false, name:favourite };
  const point = points[index];
  return { found:true, index, name:point.name, scheduled:point.scheduled,
    expected:point.expected || null,
    state:cancelled || point.status === 'cancelled' ? 'Cancelled'
      : point.passed ? 'Already passed' : point.here ? 'Selected station'
      : point.expected ? 'Expected' : 'Prediction unavailable' };
}
