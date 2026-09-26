import { findClub, findClubByKey, allClubs, clubsByDivision,
  startingDivisionsForOvr, worldMeta, clubBaseline, domesticReputation,
  CAREER_WORLD_VERSION } from '../src/data/careerWorld.js';
import { CREST_FILES } from '../src/data/careerWorld/crests.generated.js';

const clubs = allClubs();
const keys = Object.keys(CREST_FILES);
const bySlug = new Map(clubs.map((c) => [c.slug.toLowerCase(), c]));
const matched = keys.filter((k) => bySlug.has(k.toLowerCase()));
const orphans = keys.filter((k) => !bySlug.has(k.toLowerCase()));

console.log('SMOKE SNAPSHOT');
console.log('total clubs:', clubs.length);
console.log('divisions internal:', [1, 2].map((n) => `${n}:${clubsByDivision(n).length}`).join(' '));
console.log('leagues:',
  clubs.reduce((m, c) => { const k = c.leagueId + ':' + c.countryCode; m.set(k, (m.get(k) || 0) + 1); return m; },
  new Map()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} = ${n}`).join(' | '));
console.log('countries:', [...new Set(clubs.map((c) => c.countryCode + ':' + c.country))].sort().join(' | '));
console.log('slugs:', new Set(clubs.map((c) => c.slug.toLowerCase())).size,
  '| duplicates:', clubs.length - new Set(clubs.map((c) => c.slug.toLowerCase())).size);
console.log('incomplete records:',
  clubs.filter((c) => !c.slug || !c.name || !c.short || !c.shortName || !c.city || !c.crest || !c.overlap || !c.division).length);
console.log('crest files: entries:', keys.length, '| matched:', matched.length, '| orphans:', orphans.length);
console.log('crest orphans:', orphans.join(', '));
console.log('worldMeta:', JSON.stringify(worldMeta));
console.log('CAREER_WORLD_VERSION:', CAREER_WORLD_VERSION);
console.log('clubs without logo:', clubs.length - matched.length);
