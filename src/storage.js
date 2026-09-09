import { stations } from './api.js';
export const defaults = { crs: 'BMV', stationName: 'Bromsgrove', theme: 'retro', board: 'departures', count: 6, favourite: '', autoRefresh: true, cacheBoard: true, onboarded: false };
export function validateSettings(value = {}) {
  const station = stations.find(s => s.crs === value?.crs) || stations[0];
  return { ...defaults, crs: station.crs, stationName: station.name,
    theme: ['retro', 'modern', 'midnight'].includes(value?.theme) ? value.theme : defaults.theme,
    board: ['departures', 'arrivals'].includes(value?.board) ? value.board : defaults.board,
    count: [4, 6, 8, 10].includes(value?.count) ? value.count : defaults.count,
    favourite: typeof value?.favourite === 'string' ? value.favourite.slice(0, 100) : '',
    ...Object.fromEntries(['autoRefresh', 'cacheBoard', 'onboarded'].map(key => [key, typeof value?.[key] === 'boolean' ? value[key] : defaults[key]])) };
}
export function read(key) { try { return JSON.parse(localStorage.getItem(`railboard:${key}`)); } catch { return null; } }
export function write(key, value) { try { localStorage.setItem(`railboard:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
export function clearBoard() { try { localStorage.removeItem('railboard:board'); } catch { /* Storage can be disabled. */ } }
export function matchingCache(board, settings, type) {
  return board?.mock === true && board.station?.crs === settings.crs && board.type === type && Array.isArray(board.services) && board.services.length <= settings.count && Number.isFinite(Date.parse(board.generatedAt));
}
