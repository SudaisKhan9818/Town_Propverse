/**
 * generate-models.mjs
 * Generates valid GLB files with real architectural 3D geometry for PropVerse town models.
 * Run: node scripts/generate-models.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'models');
mkdirSync(OUT_DIR, { recursive: true });

function box(cx, cy, cz, w, h, d, color) {
  const hw = w/2, hh = h/2, hd = d/2;
  const positions = new Float32Array([
    cx-hw,cy-hh,cz-hd, cx+hw,cy-hh,cz-hd, cx+hw,cy+hh,cz-hd, cx-hw,cy+hh,cz-hd,
    cx-hw,cy-hh,cz+hd, cx+hw,cy-hh,cz+hd, cx+hw,cy+hh,cz+hd, cx-hw,cy+hh,cz+hd,
  ]);
  const indices = new Uint16Array([
    0,1,2,0,2,3,5,4,7,5,7,6,4,0,3,4,3,7,1,5,6,1,6,2,3,2,6,3,6,7,4,5,1,4,1,0
  ]);
  return { positions, indices, color };
}

function mergeMeshes(boxes) {
  let tv=0, ti=0;
  for (const b of boxes) { tv+=b.positions.length/3; ti+=b.indices.length; }
  const positions = new Float32Array(tv*3);
  const indices = new Uint32Array(ti);
  let vo=0,io=0,vb=0;
  for (const b of boxes) {
    positions.set(b.positions,vo);
    for (let i=0;i<b.indices.length;i++) indices[io+i]=b.indices[i]+vb;
    vb+=b.positions.length/3; vo+=b.positions.length; io+=b.indices.length;
  }
  let mx=-1e9,my=-1e9,mz=-1e9,Mx=1e9,My=1e9,Mz=1e9;
  let mnx=1e9,mny=1e9,mnz=1e9;
  for (let i=0;i<positions.length;i+=3) {
    mnx=Math.min(mnx,positions[i]);mx=Math.max(mx,positions[i]);
    mny=Math.min(mny,positions[i+1]);my=Math.max(my,positions[i+1]);
    mnz=Math.min(mnz,positions[i+2]);mz=Math.max(mz,positions[i+2]);
  }
  return { positions, indices, min:[mnx,mny,mnz], max:[mx,my,mz], color:boxes[0].color };
}

function writeGLB(filepath, groups) {
  const meshes = groups.map(g => mergeMeshes(g.boxes));
  const bufs=[], accessors=[], bufferViews=[], primitives=[];
  let byteOffset=0;
  for (let mi=0;mi<meshes.length;mi++) {
    const m=meshes[mi];
    const idxBuf=Buffer.from(m.indices.buffer);
    const idxPad=(4-(idxBuf.length%4))%4;
    bufs.push(idxBuf); if(idxPad>0)bufs.push(Buffer.alloc(idxPad));
    bufferViews.push({buffer:0,byteOffset,byteLength:idxBuf.length,target:34963});
    const ibv=bufferViews.length-1;
    accessors.push({bufferView:ibv,byteOffset:0,componentType:5125,count:m.indices.length,type:'SCALAR',min:[0],max:[m.indices.reduce((a,v)=>Math.max(a,v),0)]});
    const iac=accessors.length-1;
    byteOffset+=idxBuf.length+idxPad;
    const posBuf=Buffer.from(m.positions.buffer);
    const posPad=(4-(posBuf.length%4))%4;
    bufs.push(posBuf); if(posPad>0)bufs.push(Buffer.alloc(posPad));
    bufferViews.push({buffer:0,byteOffset,byteLength:posBuf.length,target:34962});
    const pbv=bufferViews.length-1;
    accessors.push({bufferView:pbv,byteOffset:0,componentType:5126,count:m.positions.length/3,type:'VEC3',min:m.min,max:m.max});
    const pac=accessors.length-1;
    byteOffset+=posBuf.length+posPad;
    primitives.push({attributes:{POSITION:pac},indices:iac,material:mi});
  }
  const binBuf=Buffer.concat(bufs);
  const materials=meshes.map(m=>({pbrMetallicRoughness:{baseColorFactor:[...m.color.map(v=>v/255),1.0],metallicFactor:0.0,roughnessFactor:0.8},doubleSided:true}));
  const json={asset:{generator:'PropVerse',version:'2.0'},scene:0,scenes:[{name:'Scene',nodes:[0]}],nodes:[{mesh:0}],meshes:[{name:'Building',primitives}],accessors,bufferViews,buffers:[{byteLength:binBuf.length}],materials};
  const js=JSON.stringify(json);
  const jp=(4-(js.length%4))%4;
  const jb=Buffer.from(js+' '.repeat(jp));
  const total=12+8+jb.length+8+binBuf.length;
  const glb=Buffer.alloc(total); let o=0;
  glb.writeUInt32LE(0x46546C67,o);o+=4;
  glb.writeUInt32LE(2,o);o+=4;
  glb.writeUInt32LE(total,o);o+=4;
  glb.writeUInt32LE(jb.length,o);o+=4;
  glb.writeUInt32LE(0x4E4F534A,o);o+=4;
  jb.copy(glb,o);o+=jb.length;
  glb.writeUInt32LE(binBuf.length,o);o+=4;
  glb.writeUInt32LE(0x004E4942,o);o+=4;
  binBuf.copy(glb,o);
  writeFileSync(filepath,glb);
  console.log(`OK: ${filepath.split(/[/\\]/).pop()} (${(glb.length/1024).toFixed(1)}KB)`);
}

const C={wall:[232,220,200],roof:[180,90,55],door:[90,60,35],win:[120,170,210],plinth:[210,200,185],gold:[200,160,60],green:[80,130,60],dark:[170,145,120],white:[240,240,240],blue:[50,90,160]};

const models=[
  {name:'5Marla.glb',groups:[
    {boxes:[box(0,2.5,0,7.6,5,13.7,C.wall)],color:C.wall},
    {boxes:[box(0,5.6,0,7.9,1.2,14,C.roof)],color:C.roof},
    {boxes:[box(0,1.1,-6.8,1,2.2,0.1,C.door)],color:C.door},
    {boxes:[box(-2,2.5,-6.8,1.4,1.2,0.1,C.win),box(2,2.5,-6.8,1.4,1.2,0.1,C.win)],color:C.win},
    {boxes:[box(0,0.15,0,7.8,0.3,13.9,C.plinth)],color:C.plinth},
  ]},
  {name:'12Marla.glb',groups:[
    {boxes:[box(0,3.5,0,10.7,7,21.3,C.wall)],color:C.wall},
    {boxes:[box(0,7.75,0,11.1,1.5,21.7,C.roof)],color:C.roof},
    {boxes:[box(0,1.2,-10.6,1.2,2.4,0.1,C.door)],color:C.door},
    {boxes:[box(-3,3,- 10.6,1.6,1.4,0.1,C.win),box(3,3,-10.6,1.6,1.4,0.1,C.win),box(-3,5.5,-10.6,1.6,1.4,0.1,C.win),box(3,5.5,-10.6,1.6,1.4,0.1,C.win)],color:C.win},
    {boxes:[box(0,4.5,-11.1,7.5,0.2,1,C.plinth)],color:C.plinth},
    {boxes:[box(0,0.2,0,11,0.4,21.6,C.plinth)],color:C.plinth},
  ]},
  {name:'Masjid 10Marla.glb',groups:[
    {boxes:[box(0,3,0,14,6,14,C.wall)],color:C.wall},
    {boxes:[box(0,6.15,0,14.4,0.3,14.4,C.plinth)],color:C.plinth},
    {boxes:[box(0,6.5,0,5,1,5,C.gold),box(0,7.5,0,4,1,4,C.gold),box(0,8.5,0,3,1,3,C.gold),box(0,9.3,0,1.8,1,1.8,C.gold),box(0,10,0,0.8,0.8,0.8,C.gold)],color:C.gold},
    {boxes:[box(-6.5,5,-6.5,1.2,10,1.2,C.dark),box(6.5,5,-6.5,1.2,10,1.2,C.dark),box(-6.5,5,6.5,1.2,10,1.2,C.dark),box(6.5,5,6.5,1.2,10,1.2,C.dark)],color:C.dark},
    {boxes:[box(0,2.2,-7,3,4.5,0.1,C.door)],color:C.door},
    {boxes:[box(-4,3.5,-7,1.5,2,0.1,C.win),box(4,3.5,-7,1.5,2,0.1,C.win)],color:C.win},
  ]},
  {name:'Market 15Marla.glb',groups:[
    {boxes:[box(0,3.25,0,18,6.5,18,[180,155,110])],color:[180,155,110]},
    {boxes:[box(0,6.7,0,18.5,0.4,18.5,C.roof),box(0,7.3,-9.1,18.5,1.2,0.4,C.roof),box(0,7.3,9.1,18.5,1.2,0.4,C.roof),box(-9.1,7.3,0,0.4,1.2,18.5,C.roof),box(9.1,7.3,0,0.4,1.2,18.5,C.roof)],color:C.roof},
    {boxes:[box(-6,2.5,-9,3,3.5,0.1,C.win),box(0,2.5,-9,3,3.5,0.1,C.win),box(6,2.5,-9,3,3.5,0.1,C.win),box(-6,2.5,9,3,3.5,0.1,C.win),box(0,2.5,9,3,3.5,0.1,C.win),box(6,2.5,9,3,3.5,0.1,C.win)],color:C.win},
    {boxes:[box(0,0.2,0,18.3,0.4,18.3,C.plinth)],color:C.plinth},
  ]},
  {name:'hospital.glb',groups:[
    {boxes:[box(0,6,0,72,12,26,C.white)],color:C.white},
    {boxes:[box(0,12.15,0,72.5,0.3,26.5,[200,200,200])],color:[200,200,200]},
    {boxes:[box(0,12.5,0,2,0.2,8,[220,50,50]),box(0,12.5,0,8,0.2,2,[220,50,50])],color:[220,50,50]},
    {boxes:(()=>{const w=[];for(let f=0;f<3;f++)for(let x=-32;x<=32;x+=6){w.push(box(x,3+f*3.8,-13,2.5,1.8,0.1,C.win));w.push(box(x,3+f*3.8,13,2.5,1.8,0.1,C.win));}return w;})(),color:C.win},
    {boxes:[box(0,4,-14.5,10,0.3,3,C.plinth)],color:C.plinth},
    {boxes:[box(0,0.3,0,72.4,0.6,26.4,C.plinth)],color:C.plinth},
  ]},
  {name:'School.glb',groups:[
    {boxes:[box(0,4,0,72,8,28,[230,210,170])],color:[230,210,170]},
    {boxes:[box(0,8.6,0,72.4,1.2,28.4,C.roof)],color:C.roof},
    {boxes:(()=>{const w=[];for(let f=0;f<2;f++)for(let x=-30;x<=30;x+=8){w.push(box(x,2.5+f*4,-14,4,2,0.1,C.win));w.push(box(x,2.5+f*4,14,4,2,0.1,C.win));}return w;})(),color:C.win},
    {boxes:[box(-2,3,-14,0.8,6,0.8,C.plinth),box(2,3,-14,0.8,6,0.8,C.plinth)],color:C.plinth},
    {boxes:[box(0,0.3,0,72.4,0.6,28.4,C.plinth)],color:C.plinth},
  ]},
  {name:'PoliceStation.glb',groups:[
    {boxes:[box(0,3.5,0,22,7,50,C.blue)],color:C.blue},
    {boxes:[box(0,7.6,0,22.4,1.2,50.4,[30,60,120])],color:[30,60,120]},
    {boxes:[box(0,11,-24,0.3,8,0.3,[180,180,180]),box(0.6,14.5,-24,2,1.2,0.05,[0,80,180])],color:[180,180,180]},
    {boxes:(()=>{const w=[];for(let f=0;f<2;f++)for(let x=-8;x<=8;x+=5)w.push(box(x,2.5+f*3.2,-25,2,1.6,0.1,C.win));return w;})(),color:C.win},
    {boxes:[box(0,0.3,0,22.4,0.6,50.4,C.plinth)],color:C.plinth},
  ]},
  {name:'FireStation.glb',groups:[
    {boxes:[box(0,3.5,0,22,7,24,[200,55,40])],color:[200,55,40]},
    {boxes:[box(0,7.6,0,22.4,1.2,24.4,[140,35,25])],color:[140,35,25]},
    {boxes:[box(-6,2.5,-12,5.5,5,0.1,[160,40,30]),box(6,2.5,-12,5.5,5,0.1,[160,40,30])],color:[160,40,30]},
    {boxes:[box(-6,5.5,-12,2.5,1.4,0.1,C.win),box(6,5.5,-12,2.5,1.4,0.1,C.win)],color:C.win},
    {boxes:[box(0,8.5,0,1,0.8,1,[255,200,50])],color:[255,200,50]},
    {boxes:[box(0,0.3,0,22.4,0.6,24.4,C.plinth)],color:C.plinth},
  ]},
  {name:'Wapda.glb',groups:[
    {boxes:[box(0,3,0,22,6,24,[210,185,100])],color:[210,185,100]},
    {boxes:[box(0,6.5,0,22.4,1,24.4,C.roof)],color:C.roof},
    {boxes:[box(0,3,-12,13.2,2.4,0.1,[220,180,40])],color:[220,180,40]},
    {boxes:[box(-8,1.5,13.5,2,3,2,[120,110,100]),box(-4,1.5,13.5,2,3,2,[120,110,100]),box(0,1.5,13.5,2,3,2,[120,110,100])],color:[120,110,100]},
    {boxes:[box(-8,1.5,-12,2,1.8,0.1,C.win),box(-3,1.5,-12,2,1.8,0.1,C.win),box(3,1.5,-12,2,1.8,0.1,C.win),box(8,1.5,-12,2,1.8,0.1,C.win)],color:C.win},
    {boxes:[box(0,0.3,0,22.4,0.6,24.4,C.plinth)],color:C.plinth},
  ]},
  {name:'GreenGround.glb',groups:[
    {boxes:[box(0,0.1,0,72,0.2,28,C.green)],color:C.green},
    {boxes:[box(0,0.25,0,2,0.1,28,[210,200,175]),box(0,0.25,0,72,0.1,2,[210,200,175])],color:[210,200,175]},
    {boxes:[box(0,0.3,-13.7,72,0.2,0.6,[180,170,155]),box(0,0.3,13.7,72,0.2,0.6,[180,170,155]),box(-35.7,0.3,0,0.6,0.2,28,[180,170,155]),box(35.7,0.3,0,0.6,0.2,28,[180,170,155])],color:[180,170,155]},
  ]},
  {name:'kidsPlay.glb',groups:[
    {boxes:[box(0,1.75,0,0.3,3.5,0.3,[200,100,50]),box(-2,1.75,-2,0.3,3.5,0.3,[200,100,50]),box(2,1.75,-2,0.3,3.5,0.3,[200,100,50]),box(-2,1.75,2,0.3,3.5,0.3,[200,100,50]),box(2,1.75,2,0.3,3.5,0.3,[200,100,50])],color:[200,100,50]},
    {boxes:[box(0,3.2,-2,4.3,0.25,0.25,[100,170,80]),box(0,3.2,2,4.3,0.25,0.25,[100,170,80]),box(-2,3.2,0,0.25,0.25,4.3,[100,170,80]),box(2,3.2,0,0.25,0.25,4.3,[100,170,80])],color:[100,170,80]},
    {boxes:[box(3.5,1.2,0,1,0.15,4,[220,90,50])],color:[220,90,50]},
    {boxes:[box(-5,2,0,0.25,4,0.25,[80,130,200]),box(-7,2,0,0.25,4,0.25,[80,130,200]),box(-6,4.1,0,2.3,0.25,0.25,[80,130,200])],color:[80,130,200]},
    {boxes:[box(0,0.15,5,4,0.3,3,[210,185,130])],color:[210,185,130]},
    {boxes:[box(6,0.5,-4,3,0.25,3,[180,60,180])],color:[180,60,180]},
  ]},
];

console.log('\nPropVerse Model Generator\n');
for (const {name,groups} of models) {
  writeGLB(join(OUT_DIR,name),groups);
}
console.log('\nAll done!\n');
