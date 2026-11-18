import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';

// One shader fills the entire viewport; there is no horizon or unlit lower strip.
export function mountSky(ui) {
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
  const stage=document.createElement('div'); stage.className='celestial-sky'; stage.setAttribute('aria-hidden','true'); document.body.prepend(stage);
  let scale=Math.min(devicePixelRatio,1);
  renderer.setPixelRatio(scale); renderer.domElement.setAttribute('aria-hidden','true'); stage.append(renderer.domElement);
  const u={uRes:{value:new THREE.Vector2(1,1)},uTime:{value:20},uDawn:{value:0}};
  const mesh=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3)),new THREE.ShaderMaterial({
    uniforms:u,depthTest:false,depthWrite:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: /* glsl */ `
      uniform vec2 uRes; uniform float uTime; uniform float uDawn;
      float hash(vec2 p){vec3 a=fract(vec3(p.xyx)*.1031);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<3;i++){n+=noise(p)*a;p=p*2.03+vec2(1.7,9.2);a*=.5;}return n;}
      vec3 starLayer(vec2 p,float cell,float probability,float size,float seed){
        vec2 id=floor(p/cell),f=fract(p/cell);float r=hash(id+seed);
        vec2 offset=vec2(hash(id+seed+1.3),hash(id+seed+8.7))*.72+.14;
        vec2 d=(f-offset)*cell;float radius=size*(.65+hash(id+seed+5.)*.7);
        float core=exp(-dot(d,d)/(radius*radius));float halo=exp(-length(d)/(radius*3.))* .12;
        float twinkle=.86+.14*sin(uTime*(.23+r*.22)+r*40.);
        return vec3(.77,.87,1.)*(core+halo)*step(probability,r)*twinkle;
      }
      vec3 aurora(vec2 uv){
        float t=uTime;float x=uv.x*uRes.x/uRes.y;vec3 light=vec3(0.);
        for(int i=0;i<3;i++){
          float seed=float(i)*8.1;
          float fold=.085*sin(x*4.2+t*.045+seed)+.037*sin(x*10.3-t*.034+seed);
          float base=.06+float(i)*.27+fold+.065*(fbm(vec2(x*2.+t*.018,seed))- .5);
          float h=uv.y-base;
          float veil=smoothstep(-.045,.025,h)*exp(-max(h,0.)*7.2);
          float ray=.22+.9*pow(fbm(vec2(x*43.+t*.07,seed+h*.3)),2.);
          float presence=.65+.35*noise(vec2(x*2.4+t*.025,seed+5.));
          vec3 color=mix(vec3(.12,.68,.49),vec3(.12,.58,.68),noise(vec2(x*1.3+seed,t*.013)));
          color=mix(color,vec3(.43,.34,.68),smoothstep(.12,.36,h)*.65);
          float hem=exp(-pow((h-.012)/.023,2.))*.12;
          light+=color*(veil*ray+hem)*presence*(i==1?.9:.72);
        }
        return light;
      }
      void main(){
        vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv*vec2(uRes.x/uRes.y,1.)*900.;
        vec3 col=mix(vec3(.016,.031,.067),vec3(.018,.052,.084),.5+.5*sin(uv.y*3.));
        col+=aurora(uv);
        vec3 stars=starLayer(p,30.,.82,.55,1.)*.65+starLayer(p,67.,.83,.9,14.)*.9+starLayer(p,127.,.84,1.55,32.);
        col+=stars*(1.-smoothstep(0.,.55,uDawn));
        float dawn=smoothstep(0.,1.,uDawn);
        vec3 morning=mix(vec3(.77,.72,.8),vec3(.973,.969,.957),smoothstep(.18,1.,uDawn));
        col=mix(col,morning,dawn);
        gl_FragColor=vec4(col,1.);
      }`,
  }));
  mesh.frustumCulled=false;const scene=new THREE.Scene();scene.add(mesh);const camera=new THREE.OrthographicCamera();
  let raf=0,last=0,elapsed=20,visible=true,slow=0,frames=0,resizeQueued=false;
  function updateDawn(){u.uDawn.value=0;visible=true;}
  function measure(){renderer.setSize(innerWidth,innerHeight);u.uRes.value.set(innerWidth*renderer.getPixelRatio(),innerHeight*renderer.getPixelRatio());updateDawn();}
  function draw(){u.uTime.value=elapsed;renderer.render(scene,camera); document.body.classList.add('sky-ready');}
  function frame(time){
    raf=0;if(document.hidden||!visible||ui.paused||!ui.skyAvailable){last=0;return;}
    if(last && time-last<1000/30){raf=requestAnimationFrame(frame);return;}
    const dt=last?Math.min((time-last)/1000,.1):0;last=time;elapsed+=dt;
    if(dt){frames++;slow+=dt>1/24?1:0;if(frames===90){if(slow>50&&scale>.65){scale=Math.max(.65,scale-.25);renderer.setPixelRatio(scale);measure();}frames=0;slow=0;}}
    draw();raf=requestAnimationFrame(frame);
  }
  function sync(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(document.hidden||!visible||!ui.skyAvailable)return;draw();if(!ui.paused)raf=requestAnimationFrame(frame);}
  addEventListener('scroll',()=>{updateDawn();if(!visible||ui.paused||!raf)sync();},{passive:true});
  addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;measure();sync();});});
  document.addEventListener('visibilitychange',sync);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(raf)cancelAnimationFrame(raf);raf=0;ui.setSkyUnavailable();});
  ui.onChange(sync);new ResizeObserver(()=>{measure();sync();}).observe(document.documentElement);document.fonts.ready.then(()=>{measure();sync();});measure();sync();
}
