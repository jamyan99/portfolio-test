// The About room, on the frozen lake's north shore (b-rooms.js pans the view up to it). An About
// photo lies in the snow at the lake's corner as the way in; the room is a strip of panels lying in
// the snow, with the lake's top edge left in view below as the dock. The wheel moves sideways
// through the panels, which settle in as they arrive, and the journey's line melts its way from
// year to year. Every word in it comes from the site's About page (about.html); nothing here is
// new copy.
const ROOT='../../';
const ROUTE='#/about';
const arrow='<svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';
const next='<svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

const FACTS=[['Studying','B.F.A. UX Design, SCAD'],['Graduating','June 2027'],['Looking for','New-grad product design roles'],['Based in','Savannah, GA · open to relocating']];
const JOURNEY=[
  {year:'Before',events:[
    {when:'Growing up',title:'Ulaanbaatar, Mongolia',body:'Where I grew up, and where a local club full of strangers turned me into a basketball player.'}]},
  {year:'2024',badge:'Dean’s List',events:[
    {when:'Sep 2024',title:'Started at SCAD',body:'A B.F.A. in User Experience Design at the Savannah College of Art and Design, with an Achievement Honor Scholarship.'}]},
  {year:'2025',badge:'Dean’s List',events:[
    {when:'Mar–May 2025',title:'Liminal',body:'A wellness app for people with anxiety and depression. We built it as a team of three; the final redesign is mine.',stats:['Team of 3','2 rounds of usability testing'],link:['Case study','projects/liminal.html']},
    {when:'2025',title:'ContentPlus',body:'Educational screen time for kids, built in 10 weeks as a team of three. I later redesigned it on my own as ContentPlus 2.0.',stats:['Team of 3','10 weeks','Tested with 6 users'],link:['Case study','projects/content-plus.html']}]},
  {year:'2026',badge:'Dean’s List',events:[
    {when:'Jan–Mar 2026',title:'FINRA x SCADpro',body:'Research and early concepts for a unified, role-based login and dashboard, with a 22-person SCADpro team.',stats:['Team of 22','Under NDA'],link:['Summary','projects/finra-scadpro.html']},
    {when:'May 2026',title:'Harley-Davidson Sportster S dashboard',body:'A 4-inch embedded dashboard: states, riding guard rules and alert priority, prototyped in code with AI.',stats:['88 / 90 checks passed','AI-assisted prototyping'],link:['Case study','projects/vibe-coding.html']},
    {when:'2026',title:'Freelance marketing designer, Amante Pizza & Pasta',body:'Posters, Instagram posts, Reels and menu graphics, plus website updates, for a restaurant in Kirkland, WA.',stats:['Freelance']},
    {when:'Aug 2026',title:'UNCCD COP17, back in Ulaanbaatar',body:'Contract support staff in the Venue Command Operation Center at COP17 of the UN Convention to Combat Desertification: process maps, workflows and staffing plans.',stats:['Contract','Ulaanbaatar']},
    {when:'Sep–Nov 2026',title:'SoundCloud for Spotify users',body:'A usability study of SoundCloud with 14 Spotify users. I coded the prototype we tested in two unmoderated rounds and moderated 2 of our 5 sessions.',stats:['Team of 3','3 rounds of testing','14 Spotify users'],link:['Case study','projects/soundcloud.html']}]},
  {year:'2027',events:[
    {when:'June 2027',title:'Graduating, and next up',body:'Looking for a new-grad product design role, and open to relocating.',link:['Get in touch','mailto:jamyanart@gmail.com'],next:true}]},
];
const esc=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const href=path=>path.startsWith('mailto:')?path:ROOT+path;

const event=(e,i)=>`<li class="room-event room-unit${e.next?' room-event--next':''}" style="--d:${i}">
  <p class="room-event__when">${e.when}</p>
  <p class="room-event__title">${esc(e.title)}</p>
  <p class="room-event__body">${esc(e.body)}</p>
  ${e.stats?`<ul class="room-event__stats" aria-label="Details">${e.stats.map(s=>`<li>${s}</li>`).join('')}</ul>`:''}
  ${e.link?`<a class="room-link" href="${href(e.link[1])}"><span>${e.link[0]}</span>${next}</a>`:''}
</li>`;

const ROOM=`
<section class="lake-room__field shore" aria-labelledby="room-title">
  <div class="room-track" tabindex="-1">
    <section class="room-panel room-me" data-stop="About" aria-label="Portrait">
      <figure class="room-well room-unit"><span><img src="${ROOT}assets/img/about-portrait.webp" alt="Jamiyan Batnyam" width="1122" height="1402" decoding="async"></span></figure>
    </section>
    <section class="room-panel room-intro">
      <div class="room-unit">
        <p class="room-eyebrow">About</p>
        <h2 id="room-title" tabindex="-1">Designer, teammate, <em>explorer.</em></h2>
      </div>
      <div class="room-unit" style="--d:1">
        <p>I’m a UX / Product Designer from Ulaanbaatar, Mongolia, currently studying at SCAD in Savannah. My work spans wellness, learning, and complex digital experiences.</p>
        <p>I bring visual design, UX thinking, and product thinking together to make experiences clearer. Teamwork, communication, and resilience shape how I approach a problem—and how I keep improving until things work.</p>
      </div>
    </section>
    <section class="room-panel room-connect" data-stop="Connect" aria-labelledby="room-connect">
      <h3 class="room-label room-unit" id="room-connect">Connect</h3>
      <a class="room-card room-card--wide room-unit" style="--d:1" href="${ROOT}Jamiyan_Batnyam_Resume.pdf" target="_blank" rel="noopener"><b>Résumé</b><span>PDF</span>${arrow}</a>
      <div class="room-cards">
        <a class="room-card room-unit" style="--d:2" href="mailto:jamyanart@gmail.com"><b>Email</b><span>jamyanart@gmail.com</span></a>
        <a class="room-card room-unit" style="--d:3" href="https://www.linkedin.com/in/jbatnyam" target="_blank" rel="noopener"><b>LinkedIn</b><span>in/jbatnyam</span>${arrow}</a>
      </div>
      <h3 class="room-label room-unit" style="--d:4">Quick facts</h3>
      <dl class="room-facts room-unit" style="--d:5">${FACTS.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    </section>
    <section class="room-panel room-journey" data-stop="Journey" aria-labelledby="room-journey">
      <div class="room-unit">
        <p class="room-eyebrow">The journey</p>
        <h3 id="room-journey">How I got here<span class="room-dot">.</span></h3>
      </div>
      <ol class="room-years">
        ${JOURNEY.map(y=>`<li class="room-year">
          <div class="room-year__head"><span class="room-mark" aria-hidden="true"></span><h4>${y.year}</h4>${y.badge?`<span class="room-badge">${y.badge}</span>`:''}</div>
          <ol class="room-events${y.events.length>2?' room-events--two':''}">${y.events.map(event).join('')}</ol>
        </li>`).join('')}
      </ol>
    </section>
    <section class="room-panel room-outside" data-stop="Outside design" aria-labelledby="room-outside">
      <div class="room-unit">
        <p class="room-eyebrow">Outside design</p>
        <h3 id="room-outside">A love of basketball<span class="room-dot">.</span></h3>
      </div>
      <div class="room-unit" style="--d:1">
        <p>I’m originally from Ulaanbaatar, Mongolia, and I’ve developed a strong passion for basketball. Funny enough, I didn’t enjoy the game much as a kid—until my older cousins kept beating me at it. Determined to improve, I joined a local club with a group of strangers, and over time, I fell in love with the sport.</p>
        <p>Basketball taught me more than just how to play—it taught me how to communicate, work as a team, and think strategically under pressure. Those lessons have shaped the way I approach design. My competitive nature pushes me to stay resilient, find creative solutions when challenges arise, and keep improving until things work.</p>
        <a class="room-link" href="#/playground"><span>Explore the playground</span>${arrow}</a>
      </div>
    </section>
  </div>
</section>
<nav class="lake-room__dock" aria-label="About sections">
  <button class="room-back" type="button"><svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></svg>Back to the lake</button>
  <div class="room-stops"><span class="room-stops__line" aria-hidden="true"><span></span></span></div>
</nav>`;

export function aboutRoom({hero,reduced,home,travel}) {
  const root=document.documentElement;
  const sideways=matchMedia('(min-width: 761px) and (min-height: 560px)');

  // The way in: the About photo, lying in the snow at the lake's corner.
  const tile=document.createElement('a');
  tile.className='lake-about'; tile.href=ROUTE; tile.setAttribute('aria-label','About');
  tile.innerHTML=`<span class="lake-about__photo"><img src="${ROOT}assets/img/about-portrait.webp" alt="" width="1122" height="1402" decoding="async"></span><span class="lake-about__label" aria-hidden="true">About</span>`;
  hero.append(tile);

  const room=document.createElement('div');
  room.className='lake-room'; room.id='about-room';
  room.innerHTML=ROOM; room.hidden=true; room.inert=true;
  document.body.append(room);
  const track=room.querySelector('.room-track');
  let timers=[];

  // The dock: one stop per panel that names itself, on a line that fills as you move along.
  const stopsEl=room.querySelector('.room-stops');
  const panels=[...track.querySelectorAll('[data-stop]')];
  const stops=panels.map(panel=>{
    const b=document.createElement('button'); b.type='button'; b.className='room-stop';
    b.innerHTML=`<span class="room-stop__dot" aria-hidden="true"></span><span>${panel.dataset.stop}</span>`;
    b.addEventListener('click',()=>glide(panel)); stopsEl.append(b); return b;
  });

  // Panels and cards settle in (rise and fade) the first time they come into view.
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
  }),{root:track,threshold:.12});
  const watch=()=>track.querySelectorAll('.room-unit:not(.is-in)').forEach(el=>io.observe(el));

  // Sideways scrolling: the wheel's up/down becomes left/right, eased toward where it's headed,
  // so a notched mouse wheel glides instead of jumping. Trackpad swipes and keys use the browser's
  // own scrolling, and the eased target follows them.
  let target=0, raf=0, last=0;
  const max=()=>track.scrollWidth-track.clientWidth;
  function step(time) {
    const dt=last?Math.min((time-last)/1000,.05):1/60; last=time;
    const x=track.scrollLeft, d=target-x;
    if (Math.abs(d)<.5) { track.scrollLeft=target; raf=0; last=0; return; }
    track.scrollLeft=x+d*(1-Math.exp(-dt*9)); raf=requestAnimationFrame(step);
  }
  const go=x=>{ target=Math.max(0,Math.min(max(),x)); if (reduced.matches) { track.scrollLeft=target; return; } if (!raf) raf=requestAnimationFrame(step); };
  function glide(panel) {
    if (!sideways.matches) { panel.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'}); return; }
    go(panel.offsetLeft-parseFloat(getComputedStyle(track).paddingLeft));
  }
  track.addEventListener('wheel',event=>{
    if (!sideways.matches || event.ctrlKey || Math.abs(event.deltaX)>Math.abs(event.deltaY)) return;
    event.preventDefault();
    const unit=event.deltaMode===1?32:event.deltaMode===2?track.clientWidth:1;
    go((raf?target:track.scrollLeft)+event.deltaY*unit);
  },{passive:false});
  track.addEventListener('scroll',()=>{ if (!raf) target=track.scrollLeft; progress(); },{passive:true});
  track.addEventListener('keydown',event=>{
    if (!sideways.matches || event.altKey || event.ctrlKey || event.metaKey) return;
    const page=track.clientWidth*.8, from=raf?target:track.scrollLeft;
    const to={ArrowRight:from+120,ArrowDown:from+120,ArrowLeft:from-120,ArrowUp:from-120,PageDown:from+page,PageUp:from-page,' ':from+(event.shiftKey?-page:page),Home:0,End:max()}[event.key];
    if (to===undefined || event.target.closest('a,button')&&event.key===' ') return;
    event.preventDefault(); go(to);
  });

  // Where you are: the dock's line fills and its stop lights up; along the journey, a warm line
  // melts its way from year to year, and each year's mark thaws and glows when it arrives.
  const journey=track.querySelector('.room-years'), years=[...journey.children];
  function progress() {
    const vertical=!sideways.matches;
    const pos=vertical?track.scrollTop:track.scrollLeft, size=vertical?track.clientHeight:track.clientWidth;
    const end=Math.max(1,(vertical?track.scrollHeight:track.scrollWidth)-size);
    room.style.setProperty('--room-p',(pos/end).toFixed(4));
    const view=track.getBoundingClientRect(), from=r=>vertical?r.top:r.left, length=r=>vertical?r.height:r.width;
    let current=0;
    panels.forEach((panel,i)=>{ if (from(panel.getBoundingClientRect())<=from(view)+length(view)*.6) current=i; });
    if (pos>=end-24) current=panels.length-1;
    stops.forEach((stop,i)=>{ stop.classList.toggle('is-current',i===current); stop.toggleAttribute('aria-current',i===current); });
    const read=from(view)+length(view)*.8, line=journey.getBoundingClientRect();
    journey.style.setProperty('--line',Math.max(0,Math.min(1,(read-from(line))/length(line))).toFixed(4));
    years.forEach(year=>year.classList.toggle('is-lit',from(year.getBoundingClientRect())+16<=read));
  }

  room.querySelector('.room-back').addEventListener('click',home);
  sideways.addEventListener('change',()=>{ track.scrollLeft=track.scrollTop=target=0; progress(); });

  return {
    root:room,
    // How far the view pans: everything but the dock's strip of lake (on phones, short enough
    // that the copy at the lake's top stays out of it).
    fit() {
      const dock=sideways.matches?132:70;
      root.style.setProperty('--lake-dock',dock+'px');
      root.style.setProperty('--lake-pan',(innerHeight-dock)+'px');
      if (!room.hidden) { target=Math.min(target,max()); progress(); }
    },
    show(route,quick) {
      timers.forEach(clearTimeout);
      room.hidden=false; room.inert=false;
      track.scrollLeft=track.scrollTop=0; target=0; progress();
      timers=[setTimeout(watch,quick?0:travel*.45)];
    },
    arrived() { watch(); track.querySelector('#room-title').focus({preventScroll:true}); },
    hide() { timers.forEach(clearTimeout); room.inert=true; },
    park() { if (room.inert) room.hidden=true; },
    returnFocus() { tile.focus({preventScroll:true}); },
  };
}
