/**
 * Lightweight astronomical approximations for entertainment-only horoscope copy.
 * Moon longitude / phase use mean formulas (not a precise ephemeris).
 */

export const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

/** Tropical sun sign from calendar month (1–12) and day (1–31). */
export function tropicalSunSignFromMonthDay(month, day) {
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const md = m * 100 + d;
  if (md >= 1222 || md <= 119) return "Capricorn";
  if (md >= 120 && md <= 218) return "Aquarius";
  if (md >= 219 && md <= 320) return "Pisces";
  if (md >= 321 && md <= 419) return "Aries";
  if (md >= 420 && md <= 520) return "Taurus";
  if (md >= 521 && md <= 620) return "Gemini";
  if (md >= 621 && md <= 722) return "Cancer";
  if (md >= 723 && md <= 822) return "Leo";
  if (md >= 823 && md <= 922) return "Virgo";
  if (md >= 923 && md <= 1022) return "Libra";
  if (md >= 1023 && md <= 1121) return "Scorpio";
  if (md >= 1122 && md <= 1221) return "Sagittarius";
  return null;
}

export function parseBirthDateString(raw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, da));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== da
  ) {
    return null;
  }
  return { y, mo, da };
}

/** Julian date (UTC), including fractional day. */
export function julianDayUtc(date) {
  const d = date instanceof Date ? date : new Date(date);
  return 2440587.5 + d.getTime() / 86400000;
}

export function zodiacSignFromLongitude(lonDeg) {
  const L = ((lonDeg % 360) + 360) % 360;
  const idx = Math.min(11, Math.floor(L / 30));
  return ZODIAC_SIGNS[idx];
}

/**
 * Mean ecliptic longitudes (deg) and synodic phase from Julian date.
 * Moon sign is bucketed from mean lunar longitude (approximate).
 */
export function lunarSkyFromJulianDay(jd) {
  const n = jd - 2451545.0;
  const moonLon = ((218.316 + 13.176396 * n) % 360 + 360) % 360;
  const sunLon = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const elongation = ((moonLon - sunLon + 360) % 360);
  const illumination = (1 - Math.cos((elongation * Math.PI) / 180)) / 2;
  const moonIlluminationPercent = Math.round(illumination * 1000) / 10;
  const moonPhaseKey = moonPhaseKeyFromElongation(elongation);
  return {
    moonLongitudeDeg: moonLon,
    sunLongitudeDeg: sunLon,
    elongationDeg: elongation,
    moonIlluminationPercent,
    moonPhaseKey,
    moonPhaseLabel: titleCasePhase(moonPhaseKey),
    moonSignApprox: zodiacSignFromLongitude(moonLon),
  };
}

export function moonPhaseKeyFromElongation(elongationDeg) {
  const E = ((elongationDeg % 360) + 360) % 360;
  if (E < 22.5 || E >= 337.5) return "new";
  if (E < 67.5) return "waxing crescent";
  if (E < 112.5) return "first quarter";
  if (E < 157.5) return "waxing gibbous";
  if (E < 202.5) return "full";
  if (E < 247.5) return "waning gibbous";
  if (E < 292.5) return "last quarter";
  return "waning crescent";
}

function titleCasePhase(key) {
  return String(key)
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function computeHoroscopeAstronomy(birthYmd, atDate = new Date()) {
  const parsed = parseBirthDateString(birthYmd);
  if (!parsed) return null;
  const sunSign = tropicalSunSignFromMonthDay(parsed.mo, parsed.da);
  if (!sunSign) return null;
  const jd = julianDayUtc(atDate);
  const sky = lunarSkyFromJulianDay(jd);
  return {
    sunSign,
    moonSignApprox: sky.moonSignApprox,
    moonPhase: sky.moonPhaseLabel,
    moonPhaseKey: sky.moonPhaseKey,
    moonIlluminationPercent: sky.moonIlluminationPercent,
    elongationDeg: sky.elongationDeg,
  };
}
