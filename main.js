// ── Particle canvas ──
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W, H, particles = [];

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.r  = Math.random() * 1.2 + 0.2;
    this.vx = (Math.random() - 0.5) * 0.15;
    this.vy = (Math.random() - 0.5) * 0.15;
    this.a  = Math.random() * 0.5 + 0.1;
    const c = Math.random();
    this.color = c < 0.4
      ? `rgba(124,106,255,${this.a})`
      : c < 0.7
      ? `rgba(0,212,255,${this.a})`
      : `rgba(255,106,245,${this.a})`;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// モバイルは負荷軽減のためパーティクル数を削減
const PARTICLE_COUNT = window.innerWidth < 768 ? 60 : 150;
for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

function animate() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animate);
}
// 初回描画の後にパーティクルを開始（初期レンダリングをブロックしない）
if ('requestIdleCallback' in window) {
  requestIdleCallback(animate, { timeout: 1000 });
} else {
  setTimeout(animate, 100);
}

// ── Nav: ヒーローを過ぎたら表示 ──
const nav   = document.querySelector('nav');
const hero  = document.getElementById('hero');

function onScroll() {
  const heroBottom = hero.getBoundingClientRect().bottom;
  if (heroBottom <= 0) {
    nav.classList.add('visible');
  } else {
    nav.classList.remove('visible');
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll(); // 初期判定

// ── Scroll reveal ──
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── GA4 クリック計測 ──
// - 楽曲・配信サービス・SNS のリンククリックをイベントで送信。種類はリンク先（href）で判定
//   youtube_click / instagram_click：月次Webレポートの標準イベント（「来店・関心につながる行動」に集計）
//   streaming_click：Spotify・Apple Music・Amazon Music（AKYRAWAVE 独自。月次Webレポートの集計対象外）
// - 押された場所は data-ga-location、曲名・担当は data-track / data-member
// - window.gtag は正式ホストでのみ定義される（index.html の GA4 タグ）。プレビュー・ローカルでは何も送らない
const MAX_PARAM_LENGTH = 100; // GA4 のイベントパラメータ値の上限

const STREAMING_PLATFORMS = [
  { platform: 'spotify', matches: (host) => /(^|\.)spotify\.com$/.test(host) },
  { platform: 'apple_music', matches: (host) => host === 'music.apple.com' },
  { platform: 'amazon_music', matches: (host) => /^music\.amazon\./.test(host) },
];

const streamingPlatformOf = (url) => {
  const found = STREAMING_PLATFORMS.find((item) => item.matches(url.hostname));
  return found ? found.platform : null;
};

const LINK_EVENTS = [
  { eventName: 'youtube_click', matches: (url) => /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be' },
  { eventName: 'instagram_click', matches: (url) => /(^|\.)instagram\.com$/.test(url.hostname) },
  { eventName: 'streaming_click', matches: (url) => streamingPlatformOf(url) !== null },
];

const linkText = (link) =>
  (link.getAttribute('aria-label') || link.textContent).replace(/\s+/g, ' ').trim();

const buildClickParams = (link, url, eventName) => {
  const { gaLocation, track, member } = link.dataset;
  return {
    link_location: gaLocation || 'other',
    link_text: linkText(link).slice(0, MAX_PARAM_LENGTH),
    link_url: `${url.origin}${url.pathname}`.slice(0, MAX_PARAM_LENGTH),
    ...(track ? { track_title: track.slice(0, MAX_PARAM_LENGTH) } : {}),
    ...(member ? { member } : {}),
    ...(eventName === 'streaming_click' ? { platform: streamingPlatformOf(url) } : {}),
  };
};

document.addEventListener('click', (event) => {
  if (typeof window.gtag !== 'function') return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  let url;
  try {
    url = new URL(link.href);
  } catch (error) {
    return;
  }
  const match = LINK_EVENTS.find((item) => item.matches(url));
  if (!match) return;
  window.gtag('event', match.eventName, buildClickParams(link, url, match.eventName));
});
