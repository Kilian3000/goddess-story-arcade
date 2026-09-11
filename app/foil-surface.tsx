"use client";

import { useEffect, useRef } from "react";

const vertexSource = `attribute vec2 position; varying vec2 uv; void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }`;
const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform vec2 light;
uniform float time;
uniform float strength;
uniform float wrapper;
uniform float finish;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 p=vec2(uv.x,1.-uv.y);
  vec2 delta=(p-light)*vec2(.72,1.);
  float broad=exp(-dot(delta,delta)*5.5);
  float crease=sin(p.y*52.+sin(p.x*18.)*.8)*.008;
  float sweep=p.x*.8+p.y*.4+crease-light.x*.8-light.y*.4;
  float spec=exp(-sweep*sweep*260.);
  float fine=sin((p.x+p.y*.38)*950.)*.06+.94;
  float spectrum=p.x*2.7+p.y*1.9+light.x*1.5-light.y*.65+time*.035;
  vec3 rainbow=.55+.45*cos(6.28318*(spectrum+vec3(0.,.33,.67)));
  vec2 cell=p*vec2(86.,125.);
  vec2 dotp=fract(cell)-.5;
  float grain=hash(floor(cell));
  float glint=pow(max(0.,1.-length(dotp)*2.),12.)*step(.972,grain);
  glint*=pow(max(0.,sin(grain*75.+time*.6+light.x*10.)),12.)*broad;
  // Localized finishes leave the print visible, including on bright OLED screens.
  float etch=pow(.5+.5*sin((p.x-p.y)*210.),18.);
  float facets=step(.64,fract(p.x*15.+p.y*21.))*step(.55,fract(p.x*21.-p.y*15.));
  vec3 foil=mix(vec3(.78,.9,1.),rainbow,step(1.5,finish)*.7);
  if(finish>2.5 && finish<3.5) foil=mix(vec3(1.,.68,.22),rainbow,.16);
  if(finish>3.5) foil=mix(rainbow,vec3(.93,.84,1.),.22);
  foil=mix(foil,vec3(.86,.9,1.),wrapper);
  float texture=finish<1.5 ? .55 : finish<2.5 ? .45+etch*.55 : finish<3.5 ? .6+glint : .4+facets*.6;
  vec3 color=mix(foil,vec3(1.),spec*.75)+glint;
  float alpha=(broad*.025+spec*.22)*fine*texture+glint*.28;
  alpha*=strength*(.83+grain*.17);
  // Concentrate the finish in the card's existing edge, not a frame outside it.
  float edge=1.-smoothstep(.006,.045,min(min(p.x,1.-p.x),min(p.y,1.-p.y)));
  if(wrapper<.5) alpha*=edge;
  gl_FragColor=vec4(color,min(.16,alpha));
}`;

/** A transparent, light-reactive material over the original print, never replacement artwork. */
export function FoilSurface({ strength = 1, wrapper = false, finish = 1 }: { strength?: number; wrapper?: boolean; finish?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const material = useRef<HTMLSpanElement>(null);
  const power = useRef(strength);
  power.current = strength;
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    const surface = canvas.current;
    const host = material.current;
    if (!surface || !host) return;
    const gl = surface.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false });
    if (!gl) return; // CSS material remains available on devices without WebGL.
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) throw new Error("foil shader");
      shaders.push(shader); gl!.shaderSource(shader, source); gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error("foil shader compile");
      return shader;
    }
    try {
      program = gl.createProgram(); if (!program) return;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("foil program link");
      gl.useProgram(program);
      buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    } catch {
      shaders.forEach(shader => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      return;
    }
    const uniforms = { light: gl.getUniformLocation(program,"light"), time: gl.getUniformLocation(program,"time"), strength: gl.getUniformLocation(program,"strength"), wrapper: gl.getUniformLocation(program,"wrapper"), finish: gl.getUniformLocation(program,"finish") };
    gl.uniform1f(uniforms.wrapper, wrapper ? 1 : 0);
    const pointerHost = host.closest<HTMLElement>(".tactile-stack, .pocket-opening") || host.parentElement!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, stopped = false, held = false, touched = 0, last = 0;
    let x = .35, y = .3, targetX = x, targetY = y;
    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      surface.width = Math.max(1, Math.round(surface.clientWidth*dpr));
      surface.height = Math.max(1, Math.round(surface.clientHeight*dpr));
      gl.viewport(0,0,surface.width,surface.height);
    };
    const observer = new ResizeObserver(resize); observer.observe(surface); resize();
    const move = (event: PointerEvent) => {
      const box = pointerHost.getBoundingClientRect();
      targetX = Math.max(-.2, Math.min(1.2,(event.clientX-box.left)/box.width));
      targetY = Math.max(-.2, Math.min(1.2,(event.clientY-box.top)/box.height));
      touched = performance.now();
    };
    const down = (event: PointerEvent) => { held=true; move(event); };
    const up = () => { held=false; touched=performance.now(); };
    const lost = (event: Event) => { event.preventDefault(); stopped=true; cancelAnimationFrame(frame); host.removeAttribute("data-ready"); };
    surface.addEventListener("webglcontextlost",lost);
    pointerHost.addEventListener("pointerdown",down,{passive:true});
    pointerHost.addEventListener("pointermove",move,{passive:true});
    pointerHost.addEventListener("pointerup",up,{passive:true});
    pointerHost.addEventListener("pointercancel",up,{passive:true});
    function draw(now: number) {
      if (stopped) return;
      frame=requestAnimationFrame(draw);
      if (document.hidden || power.current <= 0 || now-last < (held ? 15 : 32)) return;
      last=now;
      const t=reduced.matches ? 0 : now*.001;
      if (!held && now-touched>1200) { targetX=.42+Math.sin(t*.43)*.28; targetY=.38+Math.cos(t*.31)*.17; }
      if (reduced.matches) { x=targetX; y=targetY; }
      else { x+=(targetX-x)*(held ? .55 : .08); y+=(targetY-y)*(held ? .55 : .08); }
      gl!.uniform2f(uniforms.light,x,y); gl!.uniform1f(uniforms.time,t);
      gl!.uniform1f(uniforms.strength,power.current);
      gl!.uniform1f(uniforms.finish,finishRef.current);
      gl!.drawArrays(gl!.TRIANGLES,0,6);
      host!.setAttribute("data-ready", "");
    }
    frame=requestAnimationFrame(draw);
    return () => {
      stopped=true; cancelAnimationFrame(frame); observer.disconnect();
      surface.removeEventListener("webglcontextlost",lost);
      pointerHost.removeEventListener("pointerdown",down); pointerHost.removeEventListener("pointermove",move);
      pointerHost.removeEventListener("pointerup",up); pointerHost.removeEventListener("pointercancel",up);
      shaders.forEach(shader=>gl.deleteShader(shader)); gl.deleteBuffer(buffer); gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [wrapper]);
  return <span ref={material} className={`foil-material ${wrapper ? "foil-metal" : "foil-holographic"}`} data-finish={finish} aria-hidden="true" style={{ opacity: strength > 0 ? (wrapper ? .12 : .3) : 0 }}><canvas ref={canvas} /><i className="foil-material-fallback" /></span>;
}
