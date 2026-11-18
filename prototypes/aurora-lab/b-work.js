// The project rooms, on the frozen lake's east shore (b-rooms.js pans the view across to them),
// after kiabai.me's work rooms. The lake slides away to the left until only its right edge is
// left, as a dock with a tile for every room; the case study reads down a column in the snow,
// with its sections listed beside it. Choosing another project in the dock swaps the column
// without moving the view. Every word here is copied from that project's case-study page (only
// a few sentences picked out of each); the full page is one click away at the end.
import { paintCrawler } from '../crawler/crawler.js';

const ROOT='../../';
const IMG=ROOT+'assets/img/';
const arrow='<svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

const WORK=[
  {id:'liminal',name:'Liminal',icon:'liminal/liminal-logo.svg',page:['Case study','projects/liminal.html'],
    kicker:'Student Team Project',title:'Liminal',tagline:'your space to breathe, reflect, and grow',
    hero:['liminal/mockup-trio.jpg','Three lavender phones on a pastel set, showing the Sublab, Home and Journal screens'],
    meta:[['Year','2025'],['Duration','10 Weeks'],['Team','3 people'],['My Roles','UI Design, UX Research, Visual Design']],
    sections:[
      {nav:'Overview',kind:'text',title:'Overview',body:[
        'Liminal is a wellness app for people with anxiety and depression who feel stuck, caught in overthinking and pulling away from others. It offers four tools to help shift those patterns. SubLab lets you make personal affirmation tracks, Meditation offers guided and solo sessions, the Journal tracks habits and mood, and Community is a place to share support.',
        'The name means an in-between space. The app is meant to be a bridge that helps people work through their anxiety and depression.'],
        list:['My contribution',['All three of us shaped Liminal together, from the research and features to the wireframes and both rounds of testing. No one person decided the whole thing.','The final redesign is mine. The screens under Introducing Liminal and the style guide are from it.']]},
      {nav:'Discovery',kind:'pair',cards:[
        ['Problem Space','Many young adults want real connection, but anxiety and depression make reaching out feel impossible. So they escape into digital distractions, which leaves them more isolated than before.'],
        ['The Proposal','A self-help app for people with anxiety and depression that helps them break out of overthinking and start acting again. Based on what we heard in the survey and interviews, we chose four tools.']]},
      {nav:'Research',kind:'stats',eyebrow:'Research',title:'Understanding The Problem',
        lead:'We surveyed and interviewed young adults to learn how anxiety and depression affect their daily habits, their relationships, and how they look for relief.',
        stats:[['23','Survey questions'],['32','Survey responses'],['3','Question types'],['7','Interviews']],
        list:['Key Insights',['Anxiety is constant, so people treat it as normal','People crave connection, then pull away from it','Stress slowly wears relationships down','People need reflection, but rarely make time for it']]},
      {nav:'Solution',kind:'features',eyebrow:'Solution',title:'Features',items:[
        ['SubLab','liminal/hero-sublab.png','Make your own affirmation track: your affirmations, mixed quietly under music or ambient sound.'],
        ['Meditation','liminal/hero-meditation-orb.png','Guided or solo sessions that mix prompts, ambient sound and silence to help you settle your thoughts.'],
        ['Journal','liminal/nav-journal.png','A place to notice your patterns: what you think, which feelings repeat, and how your story changes over time.'],
        ['Community','liminal/hero-community.png','A space to share affirmations and reflections, and support each other.']]},
      {nav:'Test Results',kind:'stats',eyebrow:'Test Results',title:'The same two tasks, in both rounds',
        stats:[['30%','round 1, 3 of 10 attempts'],['42%','round 2, 5 of 12 attempts']],
        body:'Finished with no trouble, on the two tasks tested in both rounds. Creating a track went from 0 of 5 to 2 of 6; starting a solo meditation stayed about the same (3 of 5, then 3 of 6). Round 2 otherwise used a revised task list, so its overall 78% isn’t directly comparable with round 1’s overall 30%.'},
      {nav:'Final Delivery',kind:'screens',eyebrow:'Final Delivery',title:'Introducing Liminal',shots:[
        ['liminal/screens/onboarding-welcome.jpg','Welcome'],['liminal/screens/sublab-composer.jpg','Composer'],['liminal/screens/meditation-player.jpg','Now playing'],
        ['liminal/screens/journal-mood.jpg','Mood'],['liminal/screens/community.jpg','Community']]},
      {nav:'Reflection',kind:'text',title:'Reflection',body:[
        'Testing early showed us where people got lost. In both rounds, creating a track in SubLab was the hardest task. The redesign helped: 2 of 6 people finished it with no trouble in round 2, against none of 5 in round 1. But it was still the weakest task, and that remaining confusion shaped the final onboarding, which now walks people through SubLab step by step. The biggest lesson for me: when a feature is unfamiliar, the design has to explain it, not just display it.']},
    ]},
  {id:'soundcloud',name:'SoundCloud',icon:'soundcloud/thumb.jpg',page:['Case study','projects/soundcloud.html'],
    kicker:'Student Team Project · UX Research',title:'SoundCloud',tagline:'Spotify habits don’t work on SoundCloud',
    hero:['soundcloud/cover.jpg','Four phones showing our SoundCloud redesign: the full player with back, pause and next buttons, an artist page, Saved songs, and an ad playing in the mini player'],
    meta:[['Year','2026'],['Duration','10 Weeks'],['Team','3 people'],['My Roles','UX Research, Prototyping']],
    sections:[
      {nav:'Overview',kind:'text',title:'Overview',body:[
        'Spotify users who try SoundCloud get stuck on things they do without thinking: skipping a song, saving one, getting past an ad. Over 10 weeks, our team of three tested SoundCloud with 14 Spotify users, redesigned the moments that broke, and tested the redesign twice.',
        'We worked as SoundCloud’s design team and finished with a recommendation to its product and engineering team: what to change first, and why.'],
        list:['My contribution',['I designed and coded the interactive prototype we tested in both unmoderated rounds, then rebuilt it in the week between rounds based on what Round 1 showed.',
          'I moderated 2 of our 5 sessions on the real SoundCloud app (P3 and P5).',
          'The three of us planned the study, analyzed every session in a shared rainbow sheet, and wrote the recommendations together.']]},
      {nav:'Challenge',kind:'pair',quote:['Our hypothesis','Spotify users struggle wherever SoundCloud breaks a habit Spotify taught them.'],cards:[
        ['The Challenge','SoundCloud has music you can’t get on Spotify: new artists and songs that only live there. But a Spotify user opening it for the first time brings years of habits with them.'],
        ['The Brief','Our brief was to find out how well SoundCloud serves these new users, and what it should change first.']]},
      {nav:'Approach',kind:'steps',eyebrow:'Research Approach',title:'Find the problems, then test the fixes',
        lead:'Each method answered a different question. The heuristic review told us where to look, the moderated sessions showed us why people got stuck, and two unmoderated rounds told us whether our fixes worked with no one there to help.',
        steps:[['Heuristic evaluation','We reviewed the real app against usability heuristics: no skip buttons on the full player, two unskippable ads before the first song, artist links hidden behind “Show more.”'],
          ['Moderated usability tests','We watched people skip, save, find their saved music and get past an ad, and asked them why they did what they did.'],
          ['Unmoderated test, Round 1','Our first redesign, tested on UserTesting with no moderator, to see if the fixes worked without help.'],
          ['Unmoderated test, Round 2','The same tasks and success criteria as Round 1, so we could tell whether our changes made things better.']]},
      {nav:'Findings',kind:'compare',eyebrow:'Key Findings',title:'Four habits SoundCloud breaks',items:[
        ['Skip isn’t where Spotify users look for it',[{src:'soundcloud/screens/real-player.jpg',alt:'The SoundCloud app player: song title, cover art and waveform, with no skip or pause buttons.',tag:'SoundCloud app',tone:'bad',rings:[[0.03,0.732,0.94,0.036,'pill']],label:'No skip buttons'},{src:'soundcloud/screens/player.jpg',alt:'Our redesigned player: back, pause and next buttons under the waveform, and one Save button at the top.',tag:'Our redesign',tone:'good',rings:[[0.16,0.724,0.68,0.094,'pill']],label:'Back, pause and next row',lens:{cx:0.5,cy:0.771,z:1.35,mw:100,mh:38,my:0.771}}],'4 of 5 looked at the bottom for skip. With a back, pause and next row: 3/5 → 5/5 → 4/4 changed songs on their own.'],
        ['The heart saves, but it looks like a like',[{src:'soundcloud/screens/real-player.jpg',alt:'The SoundCloud app player after tapping the heart: the heart in the bottom bar and a small Saved to Library pop-up above it.',tag:'SoundCloud app',tone:'bad',rings:[[0.334,0.832,0.333,0.057,'pill'],[0.078,0.899,0.192,0.044,'pill']],label:'Heart + quick pop‑up'},{src:'soundcloud/screens/round1-heart-and-save.jpg',alt:'Round 1 prototype: a Saved button at the top and the heart still in the bottom bar.',tag:'Round 1',tone:'bad',rings:[[0.042,0.186,0.272,0.054,'pill'],[0.062,0.92,0.204,0.041,'pill']],label:'Save added, heart kept'},{src:'soundcloud/screens/player.jpg',alt:'Round 2 prototype: one Save button at the top and no heart in the bottom bar.',tag:'Round 2',tone:'good',rings:[[0.043,0.186,0.248,0.055,'pill']],label:'One Save button',lens:{cx:0.167,cy:0.2135,z:2.4,mw:62,mh:62,my:0.2135,round:true}}],'4 of 5 weren’t sure the heart saved. Round 1 kept the heart and confused 3 of 5; with one Save button, 0 of 4.'],
        ['An ad freezes the whole app',[{src:'soundcloud/screens/real-ad.jpg',alt:'The SoundCloud app during an ad: the ad fills the screen, with a countdown and the song that plays after it at the bottom.',tag:'SoundCloud app',tone:'bad',rings:[[0.853,0.889,0.119,0.057,'pill']],label:'Wait out the countdown'},{src:'soundcloud/screens/ad-mini-player.jpg',alt:'Our redesign: the Home screen stays usable while an ad plays in the mini player, which says what is playing next.',tag:'Our redesign',tone:'good',rings:[[0.016,0.808,0.968,0.089,'pill']],label:'The ad moves to the mini player',lens:{cx:0.35,cy:0.8525,z:1.4,mw:104,mh:40,my:0.8525}}],'5 of 5 had to wait out an ad. With the ad in the mini player, 0 of 4 got stuck.'],
        ['Artist pages are hard to reach',[{src:'soundcloud/screens/player.jpg',alt:'Our Round 2 player: the artist’s name, Kairo, sits under the song title as plain text.',tag:'Round 2 player',tone:'bad',rings:[[0.043,0.124,0.121,0.025,'pill']],label:'Name looks like plain text',lens:{cx:0.18,cy:0.123,z:2.2,mw:70,mh:32,my:0.1365,side:'left'}},{src:'soundcloud/screens/artist.jpg',alt:'Our artist page for Kairo: profile, Follow button, an About section with hometown and bio, and links to Instagram, TikTok and YouTube.',tag:'Our artist page',tone:'good',rings:[[0.025,0.514,0.96,0.25,'box']],label:'About section with links'}],'Our About section worked for everyone who reached it. Getting there didn’t: 3 of 5 went straight to the artist in Round 1, 1 of 4 in Round 2.']]},
      {nav:'Impact',kind:'stats',eyebrow:'Impact',title:'Same tasks, far fewer people stuck',
        stats:[['2/5 → 0/4','couldn’t change songs on their own'],['4/5 → 0/4','weren’t sure their song had saved'],['5/5 → 0/4','got stuck waiting out an ad']],
        body:'The real app compared with our final redesign. These are small groups, so we treat them as strong signals, not final proof.'},
      {nav:'Final Delivery',kind:'screens',eyebrow:'Final Delivery',title:'The redesign we tested',shots:[
        ['soundcloud/screens/player.jpg','Player'],['soundcloud/screens/saved-songs.jpg','Saved songs'],['soundcloud/screens/ad-mini-player.jpg','Ad in the mini player'],['soundcloud/screens/artist.jpg','Artist page']]},
      {nav:'Reflection',kind:'text',title:'Reflection',body:[
        'Easy wasn’t enough. By Round 2, all 4 testers called our redesign easy, but their interest in switching from Spotify averaged 5 on a scale of 1 to 11, mostly because of price and their music library.',
        'The biggest lesson for me: a fix isn’t done until people can use it without help. The Save button only worked once we took the heart away.']},
    ]},
  {id:'content-plus',name:'ContentPlus',icon:'content-plus/thumb.jpg',page:['Case study','projects/content-plus.html'],
    kicker:'Student Team Project',title:'ContentPlus',
    hero:['content-plus/cover.jpg','ContentPlus 2.0 on a phone and a tablet standing on a yellow plinth, both showing the kids’ home screen'],
    meta:[['Year','2025'],['Duration','10 Weeks'],['Team','3 people'],['My Roles','UI Design, UX Research, Visual Design']],
    sections:[
      {nav:'Overview',kind:'text',title:'Overview',body:[
        'Parents use technology to babysit their kids while doing chores and activities. Because educational content doesn\'t capture their children\'s attention, parents often feel guilty about giving their children screen time. ContentPlus is a platform with vetted educational videos, games, and activities that children want to play with. It includes key features like parental controls, a connection to your child\'s schoolwork, and a secure way for them to play with friends. It\'s the ideal solution for guilt-free screen time.'],
        list:['My contribution',['The original project was a team of three: we did the research, sketches, wireframes and user testing together.','ContentPlus 2.0 is my own redesign. The screens under Introducing ContentPlus and the style guide are from it.']]},
      {nav:'Discovery',kind:'pair',quote:['Our Strategy','How might we make children\'s TV interactive and educational?'],cards:[
        ['Problem Space','Screen time, specifically YouTube, is a significant part of modern life. But excessive screen time comes with consequences'],
        ['The Proposal','An educational app that keeps kids engaged through a variety of media, including videos, games, and interactive activities']]},
      {nav:'Research',kind:'groups',eyebrow:'Research',title:'Understanding The Problem',
        lead:'We sent out cultural probe kits, conducted observational studies, and held interviews with parents, grandparents, and aunts to better understand children’s screen time usage and how parents use technology in their daily lives',
        groups:[['Interviews',['Devices are often used as a babysitter','TV is the most used device','Technology is essential in 2025','Chores done in short amount of time']],
          ['Observation Studies',['Less features than YouTube','Most videos are reviewed by AI','Minimal parental controls','Large variety of content']],
          ['Cultural Probe',['Screens are used while doing chores','Location affects screen use','Less screen time away from family','Screens are used to occupy children']]]},
      {nav:'User Testing',kind:'grid',eyebrow:'User Testing',title:'User Testing Results',
        lead:'We tested our mid-fidelity wireframes with six users to check the navigation and main user flow',
        items:[['Content','Expanding video, activity, and game options'],['Onboarding Experience','Providing a smooth introduction for new users'],['Navigation','Ensuring consistent and easy navigation'],
          ['Parental Controls','Offering clear and detailed options for parents'],['Profile Section','Simplifying the profile with an active status']]},
      {nav:'Final Delivery',kind:'screens',eyebrow:'Final Delivery',title:'Introducing ContentPlus',shots:[
        ['content-plus/screens/onboarding-welcome.jpg','Welcome'],['content-plus/screens/onboarding-home-or-school.jpg','Home or school'],['content-plus/screens/videos-home.jpg','Home'],
        ['content-plus/screens/videos-playing.jpg','Playing'],['content-plus/screens/coplay-game.jpg','Play'],['content-plus/screens/parental-menu.jpg','Menu']]},
      {nav:'Device',kind:'figure',title:'ContentPlus Device',body:'We also proposed a dedicated ContentPlus device that runs only our app.',
        img:['content-plus/device-front.jpg','The ContentPlus device: a tablet in a chunky yellow case showing the kids\' home screen, with Koko peeking over the top']},
      {nav:'Reflection',kind:'text',title:'Reflection',body:[
        'Testing our mid-fidelity wireframes with six users helped us identify issues and improve the design early, before we moved to the final visuals. The feedback centered on five areas: expanding video, activity, and game options; a smooth introduction for new users; clear and detailed options for parents; consistent and easy navigation; and a simpler profile with an active status. That early round of testing gave us a strong foundation for the final design.']},
    ]},
  {id:'hmi',name:'Motorcycle Dashboard HMI',icon:'framer/3WinJVulNQwWIQ1isblfTQpUG5k-1024.webp',page:['Case study','projects/vibe-coding.html'],
    title:'Designing an Embedded Motorcycle Dashboard',
    tagline:'Glanceable hierarchy, riding guard rules and alert priority for a 4-inch Harley-Davidson Sportster S display, prototyped in code with AI',
    hero:['framer/3WinJVulNQwWIQ1isblfTQpUG5k-2048.webp','The prototype dashboard: a round instrument cluster reading 0 MPH'],
    meta:[['Role','UX Designer / AI-assisted prototyper'],['Tools','Claude, Codex, ChatGPT'],['Focus','Embedded UI, state machines, interaction logic']],
    sections:[
      {nav:'Overview',kind:'text',body:[
        'A rider can only spare this 4-inch screen a glance, so the project came down to three design decisions: what the rider must be able to read at a glance, what the bike should refuse to do while it’s moving (Settings locks while riding), and which alert wins when two arrive at once, like a low-fuel warning during an incoming call.',
        'I defined those states, guard rules and overlay priorities, then used AI coding tools to build them into a working HTML, CSS and JavaScript prototype, and tested the builds against a written checklist instead of trusting how they looked. The final build passed 88 of 90 manual checks.']},
      {nav:'Project Challenge',kind:'grid',numbered:true,eyebrow:'Project Challenge',title:'This was not a normal app screen',
        lead:'The prototype was a 4-inch digital motorcycle dashboard. That meant I had to think about rider attention, physical controls, safety rules, and what should happen when several system events happen at once.',
        items:[['Glanceable by design','The rider cannot look away for long, so the dashboard needed clear hierarchy and fast recognition.'],
          ['Physical controls','The UI had to work through motorcycle controls like Page, Home, Trip, and D-pad input instead of touch.'],
          ['Riding guard rules','Some features, especially Settings and Diagnostics, needed to lock or change behavior while riding.'],
          ['Priority overlays','Low fuel, incoming calls, and prompts needed interruption rules so the rider always sees the highest-priority event.'],
          ['Small screen, big system','The interface only had five main sections, but the logic underneath included states, triggers, guards, overlays, and edge cases.']]},
      {nav:'My Process',kind:'steps',eyebrow:'My Process',title:'Analyze → document → build → test → repeat',
        lead:'I treated vibe coding as a learning loop, not a shortcut. Each prompt became a design decision, and each failure told me what I had not explained clearly enough yet.',
        steps:[['Analyze','I studied the dashboard structure, rider context, and safety constraints.'],['Document','I mapped sections, controls, states, overlays, and guard rules.'],
          ['Build','I used AI to create working HTML, CSS, and JavaScript prototypes.'],['Test','I tested the output with checklist criteria instead of trusting the visual result.'],
          ['Repeat','I updated prompts and prototype logic based on what failed.']]},
      {nav:'System Logic',kind:'grid',eyebrow:'System Logic Under The Surface',title:'The hard part was what the screen had to remember.',
        lead:'Once the prototype became interactive, I had to define the invisible rules behind the interface. These were the concepts that made the project more like an embedded HMI than a normal website.',
        items:[['State','A state is where the system currently is, like Home, Navigation, Media, Vehicle, Settings, or Settings Locked.'],
          ['Transition','A transition is the move from one state to another, such as pressing Page to move from Home to Navigation.'],
          ['Trigger','A trigger is what causes the system to change, like a button press, a low-fuel event, or an incoming call.'],
          ['Guard rule','A guard rule decides whether a change is allowed, like blocking Settings while the motorcycle is moving.'],
          ['Overlay','An overlay interrupts the normal screen when something important happens, such as Low Fuel or Incoming Call.'],
          ['Edge case','An edge case is the situation that breaks the simple version of the design, like receiving a call while another prompt is active.']]},
      {nav:'Final Prototype',kind:'screens',wide:true,eyebrow:'Final Prototype',title:'The states I checked',shots:[
        ['framer/FA93dZWX2qzBLxaxiBtOEZEhS4-1024.webp','Home','Stage 29 prototype, Home state'],['framer/v7w46X3zvLmSbXIkf7olDMDJ9ZI-1024.webp','Navigation','Stage 29 prototype, Navigation state'],
        ['framer/0xyovrNo0JXYCMg7gqkwvpLJkxw-1024.webp','Media','Stage 29 prototype, Media state'],['framer/YsxhpexWaHX4O6D4DRppW5bKik-1024.webp','Vehicle','Stage 29 prototype, Vehicle state'],
        ['framer/Ax1azBDK0017Gsw5LHANDDfM7w-1024.webp','Settings locked','Stage 29 prototype, Settings locked state'],['framer/bmkRzhiyMa233e0QFomXPp6yCkw-1024.webp','Low Fuel overlay','Stage 29 prototype, Low Fuel overlay state'],
        ['framer/Ch4MS7jPQoCOVy160kMcF7n6LHQ-1024.webp','Incoming Call overlay','Stage 29 prototype, Incoming Call overlay state']]},
      {nav:'Measured',kind:'score',eyebrow:'How I Measured The Prototype',title:'AI checklist plus manual testing.',
        lead:'To measure the prototype, I used two types of testing: an AI-assisted checklist and my own manual review. The checklist helped me evaluate structure and logic, while manual testing helped me catch visual and interaction problems that were easier to notice by actually using the prototype.',
        score:['FINAL MANUAL SCORE','88 / 90','97.78% passed on the Stage 29 manual checklist.'],parts:[['Appearance','20 / 21'],['Manual logic','68 / 69']]},
    ]},
  {id:'finra',name:'FINRA x SCADpro',icon:'framer/j90JLu2USyq46GRLYCzX1TgsCc-1024.webp',page:['Summary','projects/finra-scadpro.html'],
    kicker:'Sponsored student team project · NDA summary',title:'FINRA x SCADpro',
    hero:['framer/j90JLu2USyq46GRLYCzX1TgsCc-1024.webp','FINRA x SCADpro'],
    meta:[['When','Jan–Mar 2026'],['Team','22 people'],['Role','UX Designer']],
    sections:[
      {nav:'Overview',kind:'text',title:'Overview',note:['This project is under NDA, so this page shows no screens or confidential details.','It covers what I can share. I’m glad to walk through my role and process in an interview.'],
        body:['SCADpro is SCAD’s design studio, where student teams take on briefs from partner organizations. For FINRA, a 22-person multidisciplinary team spent January to March 2026 exploring a unified login and dashboard for FINRA’s logged-in systems.']},
      {nav:'The Brief',kind:'text',eyebrow:'The Brief',title:'One way in, for very different people',body:[
        'FINRA’s logged-in systems serve broker-dealer staff, investors and other regulators, each with their own tasks and their own level of access, across more than one platform. The question was what a more unified experience could look like within real-world constraints: one login and dashboard, with clearer role-based flows, that helps each person find their way, finish their task, and see only what their role permits.']},
      {nav:'My Role',kind:'text',eyebrow:'My Role',title:'UX Designer on a 22-person team',
        list:['My contribution',['Worked on research and early design concepts for clearer, role-based flows, so each kind of user could get into FINRA’s logged-in systems and move between them.',
          'Researched AI and chatbot use cases, and turned the findings into data-backed recommendations.','Co-created the team’s process book and handoff documentation.']]},
      {nav:'Process',kind:'steps',eyebrow:'Process',title:'Research first, then concepts',
        lead:'The work moved from research into early design exploration, and closed with handoff documentation for FINRA.',
        steps:[[null,'Research, including AI and chatbot use cases.'],[null,'Recommendations grounded in that research.'],[null,'Design concepts for a unified, permission-based login and dashboard.'],[null,'A process book and handoff documentation.']]},
      {nav:'Outcome',kind:'text',eyebrow:'Outcome',title:'What FINRA received',body:[
        'FINRA received the team’s design concepts and research-backed recommendations, with a process book and handoff documentation.']},
    ]},
];
export const WORK_IDS=WORK.map(w=>w.id);

const esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const img=(src,alt,cls='',extra='')=>`<img class="${cls}" src="${IMG}${src}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`;
const head=s=>`${s.eyebrow?`<p class="work-eyebrow">${esc(s.eyebrow)}</p>`:''}${s.title?`<h3>${esc(s.title)}</h3>`:''}${s.lead?`<p class="work-lead">${esc(s.lead)}</p>`:''}`;
const list=([title,items])=>`<h4 class="work-label">${esc(title)}</h4><ol class="work-list">${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`;

// A before/after stage of phones (shared with the SoundCloud case-study page).
const ring=([x,y,wd,h,shape],good)=>`<span class="scx-ring${shape==='pill'?' scx-ring--pill':''}${good?' scx-ring--good':''}" style="--x:${x};--y:${y};--w:${wd};--h:${h}" aria-hidden="true"></span>`;
const stage=phones=>`<div class="scx-stage${phones.length>2?' scx-stage--3':''}">${phones.map(p=>{
  const good=p.tone==='good', L=p.lens;
  const lens=L?`<span class="scx-lens${L.round?' scx-lens--round':''}${L.side==='left'?' scx-lens--left':''}${good?'':' scx-lens--bad'}" style="--cx:${L.cx};--cy:${L.cy};--z:${L.z};--mh:${L.mh};--my:${L.my}" aria-hidden="true">${img(p.src,'')}</span>`:'';
  return `<figure class="scx-ph${good?' scx-ph--good':''}${L?(L.side==='left'?' scx-ph--lens-left':' scx-ph--lens'):''}"${L?` style="--mw:${L.mw}"`:''}><span class="scx-tag">${esc(p.tag)}</span><span class="scx-frame">${img(p.src,p.alt)}${p.rings.map(r=>ring(r,good)).join('')}${lens}</span><figcaption class="scx-label">${esc(p.label)}</figcaption></figure>`;
}).join('')}</div>`;

// One section of a case study, by kind.
const SECTION={
  text:s=>`${s.note?`<div class="work-note ice">${s.note.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`:''}${head(s)}${(s.body||[]).map(t=>`<p>${esc(t)}</p>`).join('')}${s.list?list(s.list):''}`,
  pair:s=>`${s.quote?`<p class="work-quote"><span>${esc(s.quote[0])}</span>${esc(s.quote[1])}</p>`:''}<div class="work-pair">${s.cards.map(([label,text],i)=>`<div class="work-card ice room-unit" style="--d:${i}"><p class="work-tag${i?' work-tag--warm':''}">${esc(label)}</p><p>${esc(text)}</p></div>`).join('')}</div>`,
  stats:s=>`${head(s)}<dl class="work-stats">${s.stats.map(([n,l])=>`<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join('')}</dl>${s.body?`<p>${esc(s.body)}</p>`:''}${s.list?list(s.list):''}`,
  features:s=>`${head(s)}<div class="work-features">${s.items.map(([name,src,text],i)=>`<div class="work-card ice room-unit" style="--d:${i}">${img(src,'','work-feature-art')}<h4>${esc(name)}</h4><p>${esc(text)}</p></div>`).join('')}</div>`,
  groups:s=>`${head(s)}<div class="work-groups">${s.groups.map(([title,items],i)=>`<div class="work-card ice room-unit" style="--d:${i}"><h4>${esc(title)}</h4><p class="work-tag">Key Insights</p><ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>`).join('')}</div>`,
  grid:s=>`${head(s)}<div class="work-grid${s.numbered?' work-grid--numbered':''}">${s.items.map(([name,text],i)=>`<div class="work-card ice room-unit" style="--d:${i%3}">${s.numbered?`<p class="work-num">${String(i+1).padStart(2,'0')}</p>`:''}<h4>${esc(name)}</h4><p>${esc(text)}</p></div>`).join('')}</div>`,
  steps:s=>`${head(s)}<ol class="work-steps-row">${s.steps.map(([name,text],i)=>`<li class="room-unit" style="--d:${i}"><span class="work-step-dot" aria-hidden="true">${i+1}</span>${name?`<h4>${esc(name)}</h4>`:''}<p>${esc(text)}</p></li>`).join('')}</ol>`,
  // Findings as before/after phones (assets/sc-findings.css): the problem ringed in coral, our change
  // ringed in mint and shown larger in a lens beside the phone.
  compare:s=>`${head(s)}<ol class="work-compare">${s.items.map(([name,phones,text],i)=>`<li class="room-unit" style="--d:${i%2}"><p class="work-num">${String(i+1).padStart(2,'0')}</p><h4>${esc(name)}</h4>${stage(phones)}<p>${esc(text)}</p></li>`).join('')}</ol>`,
  screens:s=>`${head(s)}<div class="work-shots${s.wide?' work-shots--wide':''}">${s.shots.map(([src,label,alt],i)=>`<figure class="room-unit" style="--d:${i%4}">${img(src,alt||`${label} screen`,'ice')}<figcaption>${esc(label)}</figcaption></figure>`).join('')}</div>`,
  figure:s=>`${head(s)}<p>${esc(s.body)}</p><figure class="work-figure ice room-unit">${img(s.img[0],s.img[1])}</figure>`,
  score:s=>`${head(s)}<div class="work-score ice room-unit"><p class="work-tag">${esc(s.score[0])}</p><p class="work-score__big">${esc(s.score[1])}</p><p>${esc(s.score[2])}</p><dl>${s.parts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`,
};

function caseHTML(w,i) {
  const nextW=WORK[(i+1)%WORK.length];
  return `<article class="work-case" data-id="${w.id}" aria-labelledby="work-title-${w.id}" hidden>
    <header class="work-hero">
      <figure class="work-hero__art ice room-unit">${img(w.hero[0],w.hero[1],'','')}</figure>
      <div class="work-hero__copy room-unit" style="--d:1">
        ${w.kicker?`<p class="work-eyebrow">${esc(w.kicker)}</p>`:''}
        <h2 id="work-title-${w.id}" tabindex="-1">${esc(w.title)}</h2>
        ${w.tagline?`<p class="work-tagline">${esc(w.tagline)}</p>`:''}
        <dl class="work-meta">${w.meta.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>
    </header>
    ${w.sections.map((s,j)=>`<section class="work-section work-section--${s.kind} room-unit" data-nav="${esc(s.nav)}" id="work-${w.id}-${j}">${SECTION[s.kind](s)}</section>`).join('')}
    <footer class="work-end room-unit">
      <a class="work-cta" href="${ROOT}${w.page[1]}">${esc(w.page[0])}${arrow}</a>
      <a class="work-next ice" href="#/work/${nextW.id}"><span><span class="work-eyebrow">Next project</span><b>${esc(nextW.name)}</b></span>${img(nextW.icon,'')}</a>
    </footer>
  </article>`;
}

// The playground's tile in the dock: the crawler itself, painted small.
function crawlerThumb() {
  const c=document.createElement('canvas'); c.width=c.height=112;
  const x=c.getContext('2d'); x.fillStyle='#0E1A22'; x.fillRect(0,0,112,112); paintCrawler(x,112,112);
  return c.toDataURL();
}

export function workRoom({reduced,home,travel}) {
  const root=document.documentElement;
  const narrow=matchMedia('(max-width: 760px)');
  const room=document.createElement('div');
  room.className='work-room'; room.id='work-room'; room.hidden=true; room.inert=true;
  room.innerHTML=`
    <div class="work-room__field shore">
      <div class="work-scroll" tabindex="-1">${WORK.map(caseHTML).join('')}</div>
      <nav class="work-steps" aria-label="Sections"><ol></ol><span class="work-steps__bar" aria-hidden="true"><span></span></span></nav>
    </div>
    <nav class="work-dock" aria-label="Rooms">
      <button class="work-dock__back" type="button" aria-label="Back to the lake"><svg class="room-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg><span>Lake</span></button>
      <a class="work-tile" href="#/about"><span class="work-tile__art">${img('about-portrait.webp','')}</span><span class="work-tile__name">About</span></a>
      ${WORK.map(w=>`<a class="work-tile" href="#/work/${w.id}" data-id="${w.id}"><span class="work-tile__art">${img(w.icon,'')}</span><span class="work-tile__name">${esc(w.name)}</span></a>`).join('')}
      <a class="work-tile" href="#/playground/crawler"><span class="work-tile__art"><img src="${crawlerThumb()}" alt=""></span><span class="work-tile__name">Crawler</span></a>
    </nav>`;
  document.body.append(room);
  const scroller=room.querySelector('.work-scroll');
  const stepsList=room.querySelector('.work-steps ol');
  const cases=Object.fromEntries([...scroller.children].map(el=>[el.dataset.id,el]));
  const tiles=[...room.querySelectorAll('.work-tile[data-id]')];
  room.querySelector('.work-dock__back').addEventListener('click',home);
  let current=null, timers=[], sections=[], stepButtons=[];

  // Sections settle in (rise and fade) the first time they scroll into view.
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
  }),{root:scroller,threshold:.08});
  const watch=()=>cases[current]?.querySelectorAll('.room-unit:not(.is-in)').forEach(el=>io.observe(el));

  // Beside the column: the case study's sections, the one you're reading lit, with a bar that
  // fills as you go down.
  function buildSteps() {
    sections=[...cases[current].querySelectorAll('[data-nav]')];
    stepsList.innerHTML=''; stepButtons=sections.map(section=>{
      const li=document.createElement('li'), b=document.createElement('button');
      b.type='button'; b.textContent=section.dataset.nav;
      b.addEventListener('click',()=>scroller.scrollTo({top:section.offsetTop-24,behavior:reduced.matches?'auto':'smooth'}));
      li.append(b); stepsList.append(li); return b;
    });
  }
  function progress() {
    const max=Math.max(1,scroller.scrollHeight-scroller.clientHeight);
    room.style.setProperty('--work-p',(scroller.scrollTop/max).toFixed(4));
    const line=scroller.scrollTop+scroller.clientHeight*.35;
    let lit=-1; sections.forEach((s,i)=>{ if (s.offsetTop<=line) lit=i; });
    if (scroller.scrollTop>=max-4) lit=sections.length-1;
    stepButtons.forEach((b,i)=>{ b.classList.toggle('is-current',i===lit); b.toggleAttribute('aria-current',i===lit); });
  }
  scroller.addEventListener('scroll',progress,{passive:true});

  // Show one project. Switching between projects fades the old column out and the new one up.
  function select(id,swap) {
    const prev=current; current=id;
    tiles.forEach(t=>t.toggleAttribute('aria-current',t.dataset.id===id));
    const show=()=>{
      Object.values(cases).forEach(el=>{ el.hidden=el.dataset.id!==id; el.classList.remove('is-leaving'); });
      scroller.scrollTop=0; buildSteps(); progress(); watch();
    };
    if (swap && prev && prev!==id && !reduced.matches) {
      cases[prev].classList.add('is-leaving');
      timers.push(setTimeout(()=>{ show(); cases[id].querySelector('h2').focus({preventScroll:true}); },170));
    } else show();
  }

  return {
    root:room,
    // How far the view pans: everything but the dock's strip of lake (on phones, all of it; the
    // dock becomes a bar along the bottom).
    fit() {
      const dock=narrow.matches?0:104;
      root.style.setProperty('--work-dock',dock+'px');
      root.style.setProperty('--work-pan',(innerWidth-dock)+'px');
    },
    show(route,quick,swap) {
      if (!swap) { timers.forEach(clearTimeout); timers=[]; room.hidden=false; room.inert=false; }
      select(route.id,swap);
      if (!swap) timers.push(setTimeout(watch,quick?0:travel*.45));
    },
    arrived() { watch(); cases[current]?.querySelector('h2').focus({preventScroll:true}); },
    hide() { timers.forEach(clearTimeout); timers=[]; room.inert=true; },
    park() { if (room.inert) room.hidden=true; },
    returnFocus() { document.querySelector(`.under a[href="#/work/${current}"]`)?.focus({preventScroll:true}); },
  };
}
