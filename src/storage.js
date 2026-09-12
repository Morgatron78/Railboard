import { stations } from './api.js';
export const defaults = { crs: 'BMV', stationName: 'Bromsgrove', theme: 'retro', board: 'departures', count: 6, favourite: '', autoRefresh: true, cacheBoard: true, onboarded: false };
export function validateSettings(value = {}) {
  const station = /^[A-Z]{3}$/.test(value?.crs) && typeof value?.stationName === 'string' && value.stationName.trim() ? { crs: value.crs, name: value.stationName.slice(0,100) } : stations.find(s => s.crs === value?.crs) || stations[0];
  return { ...defaults, crs: station.crs, stationName: station.name,
    theme: ['retro', 'modern', 'midnight'].includes(value?.theme) ? value.theme : defaults.theme,
    board: ['departures', 'arrivals'].includes(value?.board) ? value.board : defaults.board,
    count: [4, 6, 8, 10, 20, 30].includes(value?.count) ? value.count : defaults.count,
    favourite: typeof value?.favourite === 'string' ? value.favourite.slice(0, 100) : '',
    ...Object.fromEntries(['autoRefresh', 'cacheBoard', 'onboarded'].map(key => [key, typeof value?.[key] === 'boolean' ? value[key] : defaults[key]])) };
}
export function read(key) { try { return JSON.parse(localStorage.getItem(`railboard:${key}`)); } catch { return null; } }
export function recentStations(current, previous = []) {
  const seen = new Set();
  return [current, ...(Array.isArray(previous) ? previous : [])].filter(s => {
    if (!s || !/^[A-Z]{3}$/.test(s.crs) || typeof s.name !== 'string' || !s.name.trim() || seen.has(s.crs)) return false;
    seen.add(s.crs); return true;
  }).slice(0,3).map(s => ({crs:s.crs,name:s.name.slice(0,100)}));
}
export function write(key, value) { try { localStorage.setItem(`railboard:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
export function clearBoard() { try { Object.keys(localStorage).filter(k => k.startsWith('railboard:board')).forEach(k => localStorage.removeItem(k)); } catch { /* Storage can be disabled. */ } }
export function matchingCache(board, settings, type, mock = true) {
  return board?.mock === mock && board.station?.crs === settings.crs && board.type === type && Array.isArray(board.services) && board.services.length <= settings.count && Number.isFinite(Date.parse(board.generatedAt));
}
