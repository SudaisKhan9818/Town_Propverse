'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Selection } from './useSelection';
import { getTownData } from './layout-engine';

const TOWN = getTownData();
const ALL_AMENITIES = [
  ...TOWN.amenities,
  ...TOWN.civic,
];

// -- Dummy pricing (PKR) per marla size class --
const PRICE: Record<string, string> = {
  '5marla': 'PKR 45,00,000',
  '7marla': 'PKR 63,00,000',
  '12marla': 'PKR 1,08,00,000',
};

const SIZE_LABEL: Record<string, string> = {
  '5marla': '5 Marla',
  '7marla': '7 Marla',
  '12marla': '12 Marla',
};

const AMENITY_NAME: Record<string, string> = {
  market: 'Community Market',
  masjid: 'Community Masjid',
  school: 'Town School',
  hospital: 'Town Hospital',
  police: 'Police Station',
  fire: 'Fire Station',
  wapda: 'WAPDA Block',
  park: 'Central Park',
};

const AMENITY_DESC: Record<string, string> = {
  market: 'Everyday retail and fresh produce within a two-minute walk of every street.',
  masjid: 'A calm landmark for prayer and gathering, visible from every residential row.',
  school: 'Primary and secondary education at the heart of the civic zone.',
  hospital: 'Full-service healthcare serving the entire town and surrounding area.',
  police: 'Round-the-clock community policing and emergency response.',
  fire: 'Dedicated fire control and rapid response for the whole town.',
  wapda: 'Power, water and utilities administration for all plots.',
  park: 'Open green space with a running track and sports courts.',
};

const badge = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: '0.68rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  fontWeight: 700,
};

const btnPrimary = {
  width: '100%',
  padding: '12px 0',
  background: '#C47A4B',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'sans-serif',
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
};

const btnGhost = {
  ...btnPrimary,
  background: 'transparent',
  border: '1px solid rgba(245,239,226,0.35)',
  color: '#F5EFE2',
  marginTop: 10,
};

interface Props {
  selected: Selection | null;
  onClose: () => void;
  onFocus?: (pos: { x: number; z: number }) => void;
}

export default function InfoPanel({ selected, onClose, onFocus }: Props) {
  return (
    <AnimatePresence>
      {selected && (
        <motion.aside
          key="info-panel"
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 320,
            zIndex: 102,
            background: '#1C1A17',
            color: '#F5EFE2',
            padding: 24,
            fontFamily: 'sans-serif',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.35)',
            overflowY: 'auto',
          }}
        >
          <button
            onClick={(event) => { event.stopPropagation(); onClose(); }}
            aria-label="Close panel"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              background: 'transparent',
              border: '1px solid rgba(245,239,226,0.25)',
              borderRadius: 6,
              color: '#F5EFE2',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            &times;
          </button>

          {selected.type === 'plot' && (() => {
            const p = TOWN.plots[selected.index];
            if (!p) return null;
            return (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>Residential Plot</p>
                <h2 style={{ margin: '0 0 12px', fontSize: '1.6rem', fontWeight: 700 }}>{p.id}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span style={{ ...badge, background: '#C47A4B', color: '#fff' }}>{SIZE_LABEL[p.size] ?? p.size}</span>
                  <span style={{ ...badge, border: '1px solid rgba(245,239,226,0.3)', color: '#F5EFE2' }}>{p.status}</span>
                </div>
                <dl style={{ margin: '0 0 20px', fontSize: '0.86rem', lineHeight: 1.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ opacity: 0.6 }}>Price</dt><dd style={{ margin: 0, fontWeight: 700 }}>{PRICE[p.size]}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ opacity: 0.6 }}>Dimensions</dt>
                    <dd style={{ margin: 0 }}>{p.bounds.w}m &times; {p.bounds.d}m</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <dt style={{ opacity: 0.6 }}>Address</dt>
                    <dd style={{ margin: 0 }}>{p.address}</dd>
                  </div>
                </dl>
                <button
                  onClick={() => alert(`Visit request sent for ${p.id}. We will contact you shortly.`)}
                  style={btnPrimary}
                >
                  Reserve Visit
                </button>
              </div>
            );
          })()}

          {selected.type === 'amenity' && (
            (() => {
              const amenity = ALL_AMENITIES[selected.index];
              if (!amenity) return null;
              return <div>
              <p style={{ margin: '0 0 8px', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.6 }}>Amenity</p>
              <h2 style={{ margin: '0 0 12px', fontSize: '1.4rem', fontWeight: 700 }}>{AMENITY_NAME[amenity.type]}</h2>
              <p style={{ margin: '0 0 20px', fontSize: '0.86rem', lineHeight: 1.6, opacity: 0.85 }}>
                {AMENITY_DESC[amenity.type]}
              </p>
              <button
                onClick={() => onFocus?.(amenity.position)}
                style={btnPrimary}
              >
                Focus
              </button>
              </div>;
            })()
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}


