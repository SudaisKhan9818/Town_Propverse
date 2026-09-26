'use client';

/**
 * PremiumPlotCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic info card for ALL selectable units in the 3D town:
 *   • Residential plots  (house, marla, bedrooms, owner, timeline)
 *   • Amenities          (market, masjid — civic-style fields)
 *   • Civic blocks       (park, school, hospital, police, fire, wapda)
 *
 * PERFORMANCE RULE: NO second Canvas inside this card.
 * Image preview is a plain <img> (static thumbnail).
 *
 * Usage:
 *   <PremiumPlotCard unit={unit} onClose={() => setUnit(null)} />
 *
 * `unit` shape (all fields optional except id):
 * {
 *   id:            string   — "P-3" | "civic-hospital" | "masjid-2"
 *   type?:         'house' | 'amenity' | 'civic'
 *   imageUrl?:     string   — override thumbnail (otherwise auto-resolved)
 *
 *   // House fields
 *   status?:        'Allotted' | 'Free' | 'Rented'
 *   marla?:         number
 *   bedrooms?:      number
 *   ownerName?:     string
 *   ownerContact?:  string   — will be auto-masked
 *   ownedSince?:    string   — "8 months"
 *   rentedFrom?:    string   — "Jan 2024"
 *   allotmentType?: string   — "Wapda Quota / Private"
 *
 *   // Civic / amenity fields
 *   civicType?:     string   — 'wapda'|'police'|'masjid'|'market'|'park'|...
 *   department?:    string
 *   inchargeName?:  string
 *   contact?:       string
 *   timings?:       string
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Exact palette from town.config.ts ────────────────────────────────────────
export const COLORS = {
  ground:       '#D9C9B0',
  road:         '#2A2D32',
  roadMarking:  '#F0D58A',
  curb:         '#B96A4B',
  plotGround:   '#EDE9E3',
  accent:       '#A95C43',
  wall:         '#8A8A8A',
  gate:         '#D5C4A1',
  civicBody:    '#E8E3DA',
  civicTrim:    '#B87958',
  parkGround:   '#6F9454',
  masjid:       '#E5DED2',
  masjidDome:   '#C8A048',
  pole:         '#34383A',
  lightBulb:    '#FFE0A0',
  fog:          '#D5D5D5',
  foliage:      '#2D5A27',
};

// ── Civic metadata maps ───────────────────────────────────────────────────────
const CIVIC_LABELS = {
  hospital: 'Town Hospital',
  school:   'Town School',
  police:   'Police Station',
  fire:     'Fire Station',
  wapda:    'WAPDA Block',
  park:     'Central Park',
  masjid:   'Community Masjid',
  market:   'Community Market',
};

const CIVIC_DEPARTMENTS = {
  hospital: 'Health Services',
  school:   'Education Dept.',
  police:   'Police Department',
  fire:     'Fire Control',
  wapda:    'WAPDA Authority',
  park:     'Parks & Recreation',
  masjid:   'Community Affairs',
  market:   'Commerce Dept.',
};

const CIVIC_TIMINGS = {
  hospital: '24 / 7',
  school:   '8:00 AM – 3:30 PM',
  police:   '24 / 7',
  fire:     '24 / 7',
  wapda:    '9:00 AM – 5:00 PM',
  park:     '6:00 AM – 10:00 PM',
  masjid:   'All prayer times',
  market:   '9:00 AM – 9:00 PM',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskContact(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return raw;
  const visible = digits.slice(-4);
  const area    = digits.slice(Math.max(0, digits.length - 10), digits.length - 7);
  const prefix  = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${prefix}${area} *** ${visible}`;
}

function resolveThumbnail(unit) {
  if (unit.imageUrl) return unit.imageUrl;
  const ct = unit.civicType ?? '';
  const CIVIC_THUMB = '/images/propverse-town-aerial.png';
  const CIVIC_TYPES = ['hospital','school','police','fire','wapda','park','masjid','market','amenity','civic'];
  if (CIVIC_TYPES.includes(ct) || unit.type === 'civic' || unit.type === 'amenity') return CIVIC_THUMB;
  return '/images/propverse-bungalow.png';
}

function isHouseUnit(unit) {
  if (unit.type === 'house') return true;
  if (unit.type === 'amenity' || unit.type === 'civic') return false;
  return !!(unit.marla || unit.bedrooms || unit.status);
}

function statusColor(status) {
  switch (status) {
    case 'Free':     return COLORS.parkGround;
    case 'Rented':   return COLORS.accent;
    case 'Allotted': return COLORS.curb;
    default:         return COLORS.wall;
  }
}

function timelineLabel(unit) {
  if (unit.status === 'Rented' && unit.rentedFrom)   return `Rented from ${unit.rentedFrom}`;
  if (unit.status === 'Allotted' && unit.ownedSince)  return `Allotted — ${unit.ownedSince} ago`;
  if (unit.ownedSince) return `Owned for ${unit.ownedSince}`;
  return null;
}

// ── Inject styles once ────────────────────────────────────────────────────────
function injectStyles() {
  if (typeof document === 'undefined') return;
  const STYLE_ID = '__pp-card-styles__';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pp-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .pp-shimmer {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 10px;
      background: linear-gradient(
        90deg,
        ${COLORS.ground} 25%,
        ${COLORS.civicBody} 50%,
        ${COLORS.ground} 75%
      );
      background-size: 200% 100%;
      animation: pp-shimmer 1.4s infinite linear;
    }
    .pp-contact-btn:hover {
      background: ${COLORS.accent} !important;
      color: #fff !important;
    }
    .pp-close-btn:hover { filter: brightness(1.12); }
    .pp-x-btn:hover { background: rgba(169,92,67,0.15) !important; }
  `;
  document.head.appendChild(style);
}
injectStyles();

// ── Sub-components ────────────────────────────────────────────────────────────
function ImageShimmer() {
  return <div className="pp-shimmer" />;
}

function InfoCell({ label, value, span = false }) {
  return (
    <div style={{
      gridColumn: span ? '1 / -1' : 'auto',
      padding: '8px 10px',
      borderRadius: 8,
      background: 'rgba(217,201,176,0.30)',
      border: '1px solid rgba(217,201,176,0.50)',
    }}>
      <p style={{
        margin: '0 0 2px',
        fontSize: '0.58rem',
        fontWeight: 700,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: COLORS.accent,
      }}>
        {label}
      </p>
      <p style={{
        margin: 0,
        fontSize: '0.84rem',
        fontWeight: 600,
        color: COLORS.pole,
        lineHeight: 1.25,
        wordBreak: 'break-word',
      }}>
        {value}
      </p>
    </div>
  );
}

function TimelineRow({ icon, iconBg, text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      padding: '8px 10px',
      borderRadius: 8,
      background: 'rgba(240,213,138,0.15)',
      border: '1px solid rgba(240,213,138,0.30)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.85rem',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: '0.78rem',
        fontWeight: 600,
        color: COLORS.pole,
        lineHeight: 1.3,
      }}>
        {text}
      </span>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
/**
 * @param {{ unit: object | null, onClose: () => void }} props
 */
export default function PremiumPlotCard({ unit, onClose }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [unit?.id]);

  if (!unit) return null;

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth <= 1024;

  const isHouse    = isHouseUnit(unit);
  const civicType  = unit.civicType ?? (isHouse ? null : (unit.type !== 'house' ? unit.type : null));
  const thumbnail  = resolveThumbnail(unit);
  const tl         = isHouse ? timelineLabel(unit) : null;
  const rawContact = unit.ownerContact ?? unit.contact ?? null;
  const masked      = maskContact(rawContact);

  // Dynamic grid fields for house plots with realistic fallback defaults
  const sizeVal     = unit.marla ? `${unit.marla} Marla` : (unit.id.includes('7marla') ? '7 Marla' : unit.id.includes('12marla') ? '12 Marla' : '5 Marla');
  const bedsVal     = unit.bedrooms ? `${unit.bedrooms} BHK` : (unit.marla === 12 ? '5 BHK' : unit.marla === 7 ? '4 BHK' : '3 BHK');
  const facingVal   = unit.facing ?? (unit.marla === 12 ? 'Park Facing' : 'North-East');
  const roadVal     = unit.road ?? (unit.marla === 12 ? '60 Ft Boulevard' : '40 Ft Road');
  const possessVal  = unit.possession ?? 'Ready for Construction';
  const ownerName   = unit.ownerName ?? (isHouse ? 'PropVerse Verified Owner' : 'Civic Directorate');
  const priceVal    = unit.price ?? (unit.marla === 12 ? '2.45 Crore' : unit.marla === 7 ? '1.65 Crore' : '1.15 Crore');
  const paidPct     = unit.paidPercentage ?? 85;

  // Responsive container styles
  const cardStyle = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '75vh',
        width: '100%',
        zIndex: 210,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'rgba(237,233,227,0.94)',
        backdropFilter: 'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTop: '2px solid rgba(169,92,67,0.30)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.35)',
        fontFamily: "'Inter','Segoe UI',sans-serif",
        color: COLORS.pole,
      }
    : {
        position: 'fixed',
        top: 16,
        right: 16,
        maxHeight: 'calc(100vh - 32px)',
        width: isTablet ? 320 : 360,
        zIndex: 210,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'rgba(237,233,227,0.88)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderRadius: 16,
        border: '1px solid rgba(169,92,67,0.25)',
        boxShadow: '-12px 12px 48px rgba(42,45,50,0.28)',
        fontFamily: "'Inter','Segoe UI',sans-serif",
        color: COLORS.pole,
      };

  return (
    <AnimatePresence>
      {unit && (
        <motion.aside
          key={`pp-card-${unit.id}`}
          initial={isMobile ? { y: '100%', opacity: 0 } : { x: isTablet ? 340 : 380, opacity: 0 }}
          animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
          exit={isMobile ? { y: '100%', opacity: 0 } : { x: isTablet ? 340 : 380, opacity: 0 }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={cardStyle}
        >
          {/* Accent top stripe */}
          <div style={{
            height: 5,
            background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.civicTrim}, ${COLORS.roadMarking})`,
            flexShrink: 0,
            borderRadius: isMobile ? '20px 20px 0 0' : '16px 16px 0 0',
          }} />

          {/* Mobile Drag Indicator Bar */}
          {isMobile && (
            <div style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(42,45,50,0.25)',
              margin: '8px auto 0',
            }} />
          )}

          <div style={{ padding: isMobile ? '14px 18px 24px' : '20px 20px 28px' }}>

            {/* Close X button */}
            <button
              id="pp-card-x-btn"
              type="button"
              className="pp-x-btn"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: isMobile ? 16 : 14,
                right: isMobile ? 16 : 14,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid rgba(169,92,67,0.25)',
                background: 'rgba(237,233,227,0.75)',
                color: COLORS.pole,
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
                zIndex: 10,
              }}
            >
              ✕
            </button>

            {/* ── SECTION 1: HEADER ───────────────────────────────────────────── */}
            <div style={{ marginBottom: 14, paddingRight: 36 }}>
              <p style={{
                margin: '0 0 4px',
                fontSize: '0.62rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.accent,
                fontWeight: 700,
              }}>
                {isHouse
                  ? 'Residential Plot'
                  : (CIVIC_LABELS[civicType] ?? 'Civic Block')}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: COLORS.pole,
                  lineHeight: 1.1,
                }}>
                  {unit.id}
                </h2>

                {isHouse && unit.status && (
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 9px',
                    borderRadius: 999,
                    fontSize: '0.60rem',
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    background: statusColor(unit.status),
                    color: '#fff',
                  }}>
                    {unit.status}
                  </span>
                )}

                {isHouse && (unit.allotmentType || 'Verified') && (
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    border: '1px solid rgba(42,45,50,0.18)',
                    color: COLORS.pole,
                    background: 'rgba(255,255,255,0.4)',
                  }}>
                    {unit.allotmentType ?? 'Standard Allotment'}
                  </span>
                )}
              </div>
            </div>

            {/* ── SECTION 2: STATIC IMAGE PREVIEW (NO SECOND CANVAS) ────────── */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 14,
              background: COLORS.ground,
              border: '1px solid rgba(169,92,67,0.15)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.06)',
            }}>
              {!imgLoaded && !imgError && <ImageShimmer />}

              {!imgError && (
                <img
                  src={thumbnail}
                  alt={`${unit.id} preview`}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => { setImgError(true); setImgLoaded(true); }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: imgLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    display: 'block',
                  }}
                />
              )}

              {imgError && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 6,
                  color: COLORS.wall,
                  fontSize: '0.72rem',
                }}>
                  <span style={{ fontSize: '1.9rem' }}>🏛️</span>
                  No preview available
                </div>
              )}

              {/* ID watermark */}
              <div style={{
                position: 'absolute',
                bottom: 8, left: 10,
                fontSize: '0.60rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#fff',
                textShadow: '0 1px 4px rgba(0,0,0,0.70)',
                pointerEvents: 'none',
              }}>
                PropVerse · {unit.id}
              </div>
            </div>

            {/* ── SECTION 3: FULL BODY GRID ───────────────────────────────────── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 9px',
              marginBottom: 14,
            }}>
              {isHouse ? (
                <>
                  <InfoCell label="Plot Size"   value={sizeVal} />
                  <InfoCell label="Bedrooms"    value={bedsVal} />
                  <InfoCell label="Facing"      value={facingVal} />
                  <InfoCell label="Road Width"  value={roadVal} />
                  <InfoCell label="Category"    value={unit.allotmentType ?? 'Residential'} />
                  <InfoCell label="Possession"  value={possessVal} />
                </>
              ) : (
                <>
                  <InfoCell
                    label="Department"
                    value={unit.department ?? CIVIC_DEPARTMENTS[civicType] ?? 'Town Services'}
                    span
                  />
                  <InfoCell
                    label="Incharge / Head"
                    value={unit.inchargeName ?? 'Admin Officer'}
                  />
                  <InfoCell
                    label="Access"
                    value="Public / Civic"
                  />
                </>
              )}
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              background: `linear-gradient(90deg, ${COLORS.accent}40, transparent)`,
              marginBottom: 14,
            }} />

            {/* ── SECTION 4: OWNER & PAYMENT PROGRESS ────────────────────────── */}
            <div style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(169,92,67,0.12)',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.60rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: COLORS.accent }}>
                  {isHouse ? 'Registered Owner' : 'Managing Authority'}
                </span>
                {isHouse && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: COLORS.pole }}>
                    PKR {priceVal}
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 6px', fontSize: '0.86rem', fontWeight: 700, color: COLORS.pole }}>
                {ownerName}
              </p>

              {isHouse && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.60rem', color: COLORS.wall, marginBottom: 3 }}>
                    <span>Payment Status</span>
                    <span>{paidPct}% Paid</span>
                  </div>
                  <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(42,45,50,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${paidPct}%`, height: '100%', background: COLORS.parkGround, borderRadius: 3 }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── SECTION 5: TIMELINE ────────────────────────────────────────── */}
            {isHouse && (
              <TimelineRow
                icon="🗓"
                iconBg={COLORS.roadMarking}
                text={tl ?? `Allotted & Verified — 12 months ago`}
              />
            )}

            {!isHouse && (
              <TimelineRow
                icon="🕐"
                iconBg={COLORS.civicTrim}
                text={unit.timings ?? CIVIC_TIMINGS[civicType] ?? '24/7 Operations'}
              />
            )}

            {/* ── SECTION 6: FOOTER ACTIONS ───────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {masked ? (
                <button
                  id={`pp-contact-${unit.id}`}
                  type="button"
                  className="pp-contact-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (rawContact) window.location.href = `tel:${rawContact.replace(/\D/g, '')}`;
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    background: COLORS.plotGround,
                    color: COLORS.accent,
                    border: `1.5px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.70rem',
                    letterSpacing: '0.04em',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  📞 {masked}
                </button>
              ) : (
                <button
                  id={`pp-contact-${unit.id}`}
                  type="button"
                  className="pp-contact-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:+923001234567`;
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    background: COLORS.plotGround,
                    color: COLORS.accent,
                    border: `1.5px solid ${COLORS.accent}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.70rem',
                    letterSpacing: '0.04em',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  📞 Contact Desk
                </button>
              )}

              <button
                id={`pp-close-${unit.id}`}
                type="button"
                className="pp-close-btn"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                style={{
                  flex: '0 0 100px',
                  padding: '10px 16px',
                  background: COLORS.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.70rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  transition: 'filter 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Close
              </button>
            </div>

          </div>{/* /padding */}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
