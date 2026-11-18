const imageRoot = 'assets/img/';
const projectRoot = 'projects/';
// Approximate north-up screen positions from the ESO / IAU Scorpius chart.
// https://www.eso.org/public/images/eso1726d/ — design coordinates, not astrometry.
const stars = {
  beta: [.902,.055], delta: [.938,.167], pi: [.938,.302],
  sigma: [.744,.267], antares: [.675,.298], tau: [.616,.365],
  epsilon: [.496,.598], mu: [.484,.744], zeta: [.467,.909],
  eta: [.340,.949], theta: [.156,.955], iota: [.069,.856],
  kappa: [.098,.805], shaula: [.160,.727], lesath: [.182,.731],
};
const trace = ['beta','delta','sigma','antares','tau','epsilon','mu','zeta','eta','theta','iota','kappa','shaula'];
const branches = [['delta','pi'],['shaula','lesath']];
const projects = [
  { id:'liminal', node:'antares', title:'Liminal', label:'Liminal', side:'left',
    href:'liminal.html', domain:'Wellness · Mobile app',
    image:'liminal/thumb-phones.jpg', alt:'Liminal interfaces on three lavender phones',
    description:'A calmer place for meditation, journaling, and everyday support.' },
  { id:'hmi', node:'epsilon', title:'Motorcycle Dashboard HMI', label:'Motorcycle HMI', side:'right',
    href:'vibe-coding.html', domain:'Embedded systems · Prototyping',
    image:'framer/3WinJVulNQwWIQ1isblfTQpUG5k-1024.webp', alt:'Motorcycle instrument cluster project thumbnail',
    description:'Glanceable information and clear interactions for a four-inch display.' },
  { id:'content-plus', node:'delta', title:'Content Plus', label:'Content Plus', side:'left',
    href:'content-plus.html', domain:'Learning · Kids & families',
    image:'content-plus/thumb.jpg', alt:'Content Plus on a tablet in its yellow stand',
    description:'Educational content for children to explore and parents to manage.' },
  { id:'finra', node:'shaula', title:'FINRA x SCADpro', label:'FINRA × SCADpro', side:'right',
    href:'finra-scadpro.html', domain:'Enterprise systems · NDA summary',
    image:'framer/j90JLu2USyq46GRLYCzX1TgsCc-1024.webp', alt:'Public FINRA and SCADpro project summary',
    description:'A unified, permission-based login and dashboard. Public summary only.' },
];
const projectNodes = new Set(projects.map(project => project.node));
const point = node => stars[node].map(value => value * 1000).join(',');


const hero=document.querySelector('.celestial-hero');
const slots=[...hero.querySelectorAll('.project-slot')];
let active=null,mode='pointer',pointerType='mouse',hideTimer;
function positionPeek(slot) {
  const anchor=slot.querySelector('.project-star').getBoundingClientRect();
  const peek=slot.querySelector('.project-peek');
  const width=peek.offsetWidth, height=peek.offsetHeight;
  let left=anchor.right-10;
  if (left+width>innerWidth-18) left=anchor.left-width+10;
  left=Math.max(18,Math.min(left,innerWidth-width-18));
  let top=anchor.bottom-8;
  if (top+height>innerHeight-18 && anchor.top-height+8>=18) top=anchor.top-height+8;
  top=Math.max(18,Math.min(top,Math.max(18,innerHeight-height-18)));
  peek.style.left=left+'px'; peek.style.top=top+'px';
  peek.style.transformOrigin=`${left>anchor.left?'left':'right'} ${top>anchor.top?'top':'bottom'}`;
}
function show(slot,announce=false) {
  clearTimeout(hideTimer);
  if (slot.suppressed) return;
  if (active && active!==slot) close(active);
  active=slot;
  positionPeek(slot);
  slot.classList.add('is-open');
  slot.querySelector('.project-star').setAttribute('aria-expanded','true');
  const peek=slot.querySelector('.project-peek'); peek.inert=false; peek.setAttribute('aria-hidden','false');
  if (announce) {
    const project=projects.find(project=>project.id===slot.dataset.project);
    hero.querySelector('#focus-selection-status').textContent=`${project.title}. ${project.description}`;
  }
}
function close(slot=active) {
  clearTimeout(hideTimer);
  if (!slot) return;
  slot.classList.remove('is-open');
  slot.querySelector('.project-star').setAttribute('aria-expanded','false');
  const peek=slot.querySelector('.project-peek'); peek.inert=true; peek.setAttribute('aria-hidden','true');
  if (active===slot) active=null;
}
function deferClose(slot) {
  clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{
    if (mode==='keyboard' && slot.contains(document.activeElement)) return;
    if (slot.matches(':hover') && pointerType==='mouse') return;
    close(slot);
  },180);
}
slots.forEach((slot,index)=>{
  const anchor=slot.querySelector('.project-star');
  slot.addEventListener('pointerenter',event=>{
    if (event.pointerType!=='mouse') return;
    pointerType='mouse'; mode='pointer'; slot.suppressed=false; show(slot);
  });
  slot.addEventListener('pointerleave',event=>{ if (event.pointerType==='mouse') deferClose(slot); });
  slot.addEventListener('focusin',()=>{ if (mode==='keyboard') show(slot,true); });
  slot.addEventListener('focusout',event=>{
    if (slot.contains(event.relatedTarget)) return;
    slot.suppressed=false; if (mode==='keyboard') close(slot);
  });
  anchor.addEventListener('pointerdown',event=>{ pointerType=event.pointerType; mode='pointer'; });
  anchor.addEventListener('click',event=>{
    if (pointerType!=='mouse' && mode!=='keyboard') {
      event.preventDefault(); slot.suppressed=false; show(slot,true);
    }
  });
  anchor.addEventListener('keydown',event=>{
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let next;
    if (event.key==='ArrowRight' || event.key==='ArrowDown') next=(index+1)%slots.length;
    if (event.key==='ArrowLeft' || event.key==='ArrowUp') next=(index-1+slots.length)%slots.length;
    if (event.key==='Home') next=0;
    if (event.key==='End') next=slots.length-1;
    if (next===undefined) return;
    event.preventDefault(); mode='keyboard'; slots[next].suppressed=false; slots[next].querySelector('.project-star').focus();
  });
  slot.querySelector('.project-peek__close').addEventListener('click',()=>{
    slot.suppressed=true; close(slot); anchor.focus({preventScroll:true});
  });
});
document.addEventListener('keydown',event=>{
  if (event.key==='Tab' || event.key.startsWith('Arrow')) mode='keyboard';
  if (event.key==='Escape' && active) {
    const slot=active; slot.suppressed=true; close(slot); slot.querySelector('.project-star').focus({preventScroll:true});
  }
},true);
document.addEventListener('pointerdown',event=>{ if (active && !active.contains(event.target)) close(active); },true);
addEventListener('scroll',()=>{ if (active) { if (mode==='keyboard') positionPeek(active); else close(active); } },{passive:true});
addEventListener('resize',()=>{ if (active) positionPeek(active); });

