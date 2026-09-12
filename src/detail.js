const key = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
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
