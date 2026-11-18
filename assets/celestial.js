// One motion preference and one sky renderer per document, shared by every route.
const root=document.documentElement, body=document.body;
const query=matchMedia('(prefers-reduced-motion: reduce)');
const subscribers=new Set();
let paused=false, available=true;
try { paused=sessionStorage.getItem('celestial-paused')==='true'; } catch {}
const button=document.createElement('button');
button.className='celestial-motion'; button.type='button';
const header=body.querySelector('.site-header');
if(header) header.insertBefore(button,header.querySelector('.menu-toggle'));
const ui={
  get paused(){return paused||query.matches;},
  get skyAvailable(){return available;},
  onChange(callback){subscribers.add(callback); return()=>subscribers.delete(callback);},
  setSkyUnavailable(){available=false;body.classList.add('sky-static');sync();},
};
function sync(){
  root.classList.toggle('motion-off',ui.paused);
  body.dataset.motion=ui.paused?'paused':'playing';
  body.dataset.reducedMotion=String(query.matches);
  button.setAttribute('aria-pressed',String(ui.paused));
  button.disabled=query.matches||!available;
  button.textContent=query.matches||!available?'Still sky':paused?'Play sky':'Pause sky';
  button.setAttribute('aria-label',query.matches?'Static sky: reduced motion is enabled':!available?'Static sky: animation unavailable':paused?'Play sky animation':'Pause sky animation');
  subscribers.forEach(callback=>callback());
  document.dispatchEvent(new Event('motionchange'));
}
button.addEventListener('click',()=>{
  paused=!paused;
  try{sessionStorage.setItem('celestial-paused',String(paused));}catch{}
  sync();
});
query.addEventListener('change',sync);
sync();
// The static CSS sky remains useful if WebGL or the existing free CDN is unavailable.
import('./celestial-sky.js').then(({mountSky})=>mountSky(ui)).catch(()=>ui.setSkyUnavailable());
if(body.classList.contains('celestial-home')) {
  import('./celestial-hero.js').catch(()=>{});
  if('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{body.classList.toggle('past-hero',!entry.isIntersecting);},{threshold:.2}).observe(document.getElementById('home'));
}
