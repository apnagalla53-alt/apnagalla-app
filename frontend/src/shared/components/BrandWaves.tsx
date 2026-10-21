import './BrandWaves.css';

/** Two small SVG layers animated only with transforms; no canvas or extra requests. */
export default function BrandWaves() {
  return <div className="brand-waves" aria-hidden="true">
    <svg className="brand-waves-back" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M0 130C180 30 360 230 540 130S900 30 1080 130s180 80 360 0V320H0Z" fill="currentColor" /></svg>
    <svg className="brand-waves-front" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M0 190C240 300 360 80 600 190s360 110 600 0 180-45 240 0V320H0Z" fill="currentColor" /></svg>
  </div>;
}
