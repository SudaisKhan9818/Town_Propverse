'use client'

import { useState } from 'react'
import { ArrowRight, MoveUpRight } from 'lucide-react'
import { Hero, Navbar } from '@/src/features/landing'
import { TownCanvas } from '@/src/features/town'
import { AgentWidget } from '@/src/features/rag'

function Logo() {
  return <a href="#top" className="wordmark" aria-label="PropVerse home">PropVerse</a>
}

function TownVisual({ large = false }: { large?: boolean }) {
  return <div className={`town-visual ${large ? 'town-visual-large' : ''}`} aria-label="Abstract 3D town model preview" role="img">
    <div className="town-horizon" />
    <div className="town-sun" />
    <div className="terrain terrain-one" /><div className="terrain terrain-two" />
    <div className="town-road town-road-one" /><div className="town-road town-road-two" /><div className="town-road town-road-three" />
    {Array.from({ length: 13 }).map((_, i) => <span className={`town-building building-${i + 1}`} key={i} />)}
    <div className="town-water" />
    <div className="visual-caption"><span>PROPVERSE / TOWN 01</span><span>31.5°N 74.3°E</span></div>
  </div>
}

function Marquee() {
  const text = 'RAYCASTER  ✦  CESIUM  ✦  BLENDER  ✦  THREE.JS  ✦  REAL-TIME DATA  ✦  '
  return <div className="marquee" aria-label="Technology stack"><div>{text}{text}</div></div>
}

const features = [
  ['01', 'Explore', 'Fly through the town in real-time 3D. Move from the street to the skyline without losing the details that matter.'],
  ['02', 'Intelligence', 'Live data is layered onto every plot, so context is always one glance away.'],
  ['03', 'Plan', 'Compare societies, districts, and possibilities before you make your next move.'],
]

function Features({ onExplore }: { onExplore: () => void }) {
  return <section id="intelligence" className="features-section content-section">
    <div className="section-intro"><p className="eyebrow">A living point of view</p><h2>Property is more<br /><em>than a pin on a map.</em></h2></div>
    <div className="feature-grid">{features.map(([number, title, text]) => <article className="feature-item" key={number}><span className="feature-number">{number}</span><h3>{title}</h3><p>{text}</p><button onClick={onExplore} aria-label={`Explore ${title}`} style={{ background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', display: 'grid', width: '2.7rem', height: '2.7rem', placeItems: 'center', marginTop: '2.4rem', color: 'var(--clay)', transition: 'background .2s, color .2s' }}><ArrowRight size={17} /></button></article>)}</div>
  </section>
}

function QuoteBreak() {
  return <section id="about" className="quote-break"><TownVisual large /><div className="quote-overlay"><p>“The clearest view of the future<br />is a place you can walk through.”</p><span>— PropVerse, 2026</span></div></section>
}

function Stats() {
  return <section className="stats-section"><div><strong>500+</strong><span>Plots mapped</span></div><div><strong>12</strong><span>Districts modeled</span></div><div><strong>24/7</strong><span>Real-time pricing</span></div><div><strong>01</strong><span>Living model</span></div></section>
}

function Footer() {
  return <footer id="contact" className="site-footer"><div className="footer-top"><div><p className="eyebrow">The next address</p><h2>Make room<br /><em>for possibility.</em></h2></div><div className="newsletter"><p>Get the occasional view from here.</p><div className="newsletter-line"><input aria-label="Email address" type="email" placeholder="Your email address" /><button type="button" aria-label="Subscribe"><ArrowRight size={18} /></button></div></div></div><div className="footer-bottom"><Logo /><div className="footer-links"><div><span>Platform</span><a href="#towns">Towns</a><a href="#intelligence">Intelligence</a></div><div><span>Company</span><a href="#about">About</a><a href="#contact">Contact</a></div><div><span>Social</span><a href="#contact">Instagram</a><a href="#contact">LinkedIn</a></div></div></div><div className="footer-meta"><span>© 2026 PropVerse</span><span>31.5°N 74.3°E</span><span>Built for the future of place</span></div></footer>
}

export default function PropVerseLanding() {
  const [show3D, setShow3D] = useState(false);

  return <main>
    <Navbar onExplore={() => setShow3D(true)} />
    <Hero onExplore={() => setShow3D(true)} />
    <Marquee />
    <Features onExplore={() => setShow3D(true)} />
    <QuoteBreak />
    <Stats />
    <section id="towns" className="towns-section content-section">
      <p className="eyebrow">A town in your hands</p>
      <h2>Walk it. Read it.<br /><em>Know it.</em></h2>
      <button className="primary-action" onClick={() => setShow3D(true)} style={{ cursor: 'pointer', border: 'none', marginTop: '3rem' }}>
        Launch the 3D experience <MoveUpRight size={16} />
      </button>
    </section>
    <Footer />
    
    {/* Always rendered to keep WebGL context, just visually hidden when not active */}
    <TownCanvas visible={show3D} onClose={() => setShow3D(false)} />
    {show3D && <AgentWidget />}
  </main>
}
