// main.js —— 《古剑奇谭二：永夜初晗凝碧天》开放世界 Three.js 主循环（直接由 engine_core.js 确定性内核驱动）
import * as THREE from 'three';
import { World, CHUNK, createWater, createSky, vegTime, mulberry } from './world.js';
import { makeChar, preloadChars, loadProps, makeProp, G_PROPS } from './assets.js';
import { buildBeast, animateBeast, makeLabelSprite, updateHpSprite } from './entities.js';
import { loadAnims, AnimPlayer } from './anim.js';
import { loadEnv } from './env.js';
import {
  Gujian2EngineCore,
  HERO_DEFS,
  NPC_DEFS as CORE_NPC_DEFS,
  PUPPET_DEFS,
  CHAPTER_QUESTS,
  STORY_SCRIPTS,
  STORY_BRANCHES,
  SIDE_ECHOES,
} from './engine_core.js';
// 软阴影补丁：必须在任何材质首次编译前 import（副作用：改写 ShaderChunk）
import './pcss.js';
// 官方后处理链：GTAO(环境光遮蔽) / Bloom / ACES 输出 / FXAA
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;

export const NPC_DEFS = CORE_NPC_DEFS;
const CHAR_IDS = ['101', '102', '103', '104', '105', '107'];

// ================= 全局状态 =================
const G = {
  meta: null,
  world: null,
  engine: null, // Gujian2EngineCore 确定性核心实例
  scene: null,
  camera: null,
  renderer: null,
  water: null,
  sky: null,
  sun: null,
  player: null,
  partyActors: [], // 4 大主角在 3D 场景中的骨骼网格实例
  puppetMesh: null, // 偃甲助战伙伴 3D 实例
  telegraphRing: null, // Boss 红圈 AOE 预警环
  keys: {},
  yaw: 0.6,
  pitch: 0.32,
  dist: 9,
  camDrag: false,
  monsters: [],
  pickups: [],
  npcs: [],
  storyActors: [],
  timeOfDay: 0.32,
  state: 'title',
  nearNPC: null,
  nearPickup: null,
  nearStoryObj: null,
  quests: {},
  inventory: {},
  stats: null,
  attackCd: 0,
  skillCd: 0,
  dodgeCd: 0,
  ultCd: 0,
  dialogOpen: false,
  panelOpen: null,
  kills: 0,
  discovered: new Set(['n04']),
  autoPilot: false,
  cfg: {},
};
window.G = G;

const HOTBAR_SKILLS = [
  { key: 'J', action: 'attack', name: '轻击三连', cd: 0.42, iconIdx: 0 },
  { key: 'K', action: 'heavy', name: '重击破盾', cd: 1.2, iconIdx: 3 },
  { key: 'L', action: 'skill', name: '星蕴战技', cd: 2.5, iconIdx: 6 },
  { key: 'C', action: 'dodge', name: '闪避无敌', cd: 0.9, iconIdx: 9 },
  { key: 'G', action: 'guard', name: '天罡防反', cd: 1.5, iconIdx: 12 },
  { key: 'U', action: 'ultimate', name: '星蕴终结', cd: 4.0, iconIdx: 15 },
];

// ================= 启动 =================
boot();

async function boot() {
  try {
    window.__step = 'meta';
    setLoad(5, '读取九域山河档案…');
    const meta = await (await fetch('./assets/world.meta.json')).json();
    G.meta = meta;
    window.__step = 'heights';
    setLoad(15, '展开 4000m×4100m 真实高度图…');
    const buf = await fetchBin('./assets/world.heights.bin', (p) =>
      setLoad(15 + p * 50, '展开山河地形…'),
    );
    const u16 = new Uint16Array(buf);
    const heights = new Float32Array(u16.length);
    for (let i = 0; i < u16.length; i++) {
      heights[i] = meta.hmin + (u16[i] / 65535) * (meta.hmax - meta.hmin);
    }

    let propsIdxJson = null;
    try {
      propsIdxJson = await (await fetch('./assets/props/index.json')).json();
    } catch (e) {
      console.warn('props index fetch warn', e);
    }

    // 初始化纯 ESM 确定性核心引擎并挂载到 window.Gujian2Engine
    G.engine = new Gujian2EngineCore(meta, heights, propsIdxJson, { seed: 42, mode: 'normal' });
    window.Gujian2Engine = G.engine;

    window.__step = 'colormap';
    setLoad(70, '绘制大地颜色…');
    const loader = new THREE.TextureLoader();
    const colormapTex = await loader.loadAsync('./assets/world.colormap.png');
    colormapTex.colorSpace = THREE.SRGBColorSpace;
    colormapTex.anisotropy = 8;
    colormapTex.flipY = false;
    colormapTex.needsUpdate = true;

    let terrainNrm = null;
    try {
      terrainNrm = await loader.loadAsync('./assets/terrain.normal.png');
      terrainNrm.flipY = false;
      terrainNrm.colorSpace = THREE.NoColorSpace;
      terrainNrm.wrapS = terrainNrm.wrapT = THREE.ClampToEdgeWrapping;
      terrainNrm.anisotropy = 4;
      terrainNrm.needsUpdate = true;
      setLoad(74, '叠上山石纹路…');
    } catch (e) {
      console.warn('terrain normal missing', e);
    }

    const detailTex = {};
    for (const n of ['dirt', 'stone', 'slab']) {
      try {
        const t = await loader.loadAsync(`./assets/terrain/${n}.png`);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        detailTex[n] = t;
      } catch (e) {}
    }

    try {
      G.env = await loadEnv();
    } catch (e) {
      console.warn('env.json missing', e);
    }
    window.__step = 'scene';

    setLoad(76, '汇聚草木生灵…');
    preloadIcons();
    initScene(meta, heights, colormapTex, terrainNrm, detailTex);

    window.__step = 'chars';
    setLoad(80, '唤醒乐无异、闻人羽、夏夷则、阿阮、华月、谢衣、沈夜…');
    await preloadChars(CHAR_IDS);
    window.__step = 'anims';
    setLoad(84, '传授举止身法…');
    G.anims = await loadAnims(['idle', 'walk', 'run', 'sprint', 'attack', 'jump']);
    generateCharPortraits();
    window.__step = 'props';
    setLoad(88, '搬来屋舍桥梁（建立 OBB 碰撞网格）…');
    G.props = null;
    try {
      G.props = await loadProps();
    } catch (e) {
      console.warn('props load fail', e);
    }

    window.__step = 'spawn';
    setLoad(93, '铺陈《永夜初晗凝碧天》七章主线与人间烟火…');
    spawnActors();
    window.__step = 'done';
    setLoad(96, '落笔…');

    if (localStorage.getItem('shx.save.gj2')) $('btnCont').classList.remove('dis');
    $('loading').style.display = 'none';
    $('title').style.display = 'flex';
    setLoad(100, '');
  } catch (err) {
    window.__err = String((err && err.stack) || err);
    $('loadTxt').textContent = '加载失败: ' + window.__err;
    $('loadTxt').style.color = '#ff8a7a';
    console.error(err);
  }
}

async function fetchBin(url, onProgress) {
  const resp = await fetch(url);
  const total = +resp.headers.get('Content-Length') || 8200000;
  const reader = resp.body.getReader();
  const chunks = [];
  let got = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}

function setLoad(p, txt) {
  $('barIn').style.width = p + '%';
  if (txt) $('loadTxt').textContent = txt;
}

function preloadIcons() {
  const ui = G.meta.ui;
  G.cfg.items = [];
  G.cfg.monsters = [];
  G.cfg.skills = [];
  G.cfg.story = [];
  for (let i = 0; i < ui.items; i++)
    G.cfg.items.push(`assets/ui/item/item_${String(i).padStart(2, '0')}.png`);
  for (let i = 0; i < ui.monsters; i++)
    G.cfg.monsters.push(`assets/ui/monster/mon_${String(i).padStart(2, '0')}.png`);
  for (let i = 0; i < ui.skills; i++)
    G.cfg.skills.push(`assets/ui/skill/skill_${String(i).padStart(2, '0')}.png`);
  for (let i = 0; i < ui.story; i++)
    G.cfg.story.push(`assets/ui/story/story_${String(i).padStart(2, '0')}.png`);
  G.cfg.faces = NPC_DEFS.map((n) => n.face);
}

const PORTRAIT_THEMES = {
  '101': { bgInner: '#6b2d1a', bgOuter: '#1c0d0a', rim: '#f6ad55', badge: '火·腾蛇', camX: -0.04, camY: 0.068, dist: 0.48 },
  '102': { bgInner: '#5e2328', bgOuter: '#1a0b0e', rim: '#fc8181', badge: '金·天狼', camX: 0.04, camY: 0.062, dist: 0.47 },
  '103': { bgInner: '#1e3a5f', bgOuter: '#0a1526', rim: '#63b3ed', badge: '水·太阴', camX: -0.03, camY: 0.065, dist: 0.45 },
  '104': { bgInner: '#1d4d3c', bgOuter: '#091c15', rim: '#68d391', badge: '木·鸾鸟', camX: 0.03, camY: 0.064, dist: 0.46 },
  '105': { bgInner: '#3b2554', bgOuter: '#120a1c', rim: '#b794f4', badge: '廉贞', camX: 0.04, camY: 0.068, dist: 0.47 },
  '106': { bgInner: '#1d4549', bgOuter: '#09191c', rim: '#4fd1c5', badge: '大偃师', camX: -0.06, camY: 0.068, dist: 0.48 },
  '107': { bgInner: '#2e1d59', bgOuter: '#0e081f', rim: '#9f7aea', badge: '紫微', camX: 0.05, camY: 0.068, dist: 0.48 },
};

/**
 * 原版 assets/ui/face/face_*.png 是 3D 模型的展开 UV 贴图（平铺人脸面具），直接放入 <img> 会严重变形。
 * 此处直接利用已加载的 3D 骨骼角色网格与材质，在离屏 WebGLRenderTarget 中渲染每位角色的三维半身胸像，
 * 合成仙侠底纹与星蕴徽记后替换所有 HUD / 队伍栏 / 对话框头像。
 */
function generateCharPortraits() {
  if (!G.renderer) return;
  const SIZE = 256;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
  });
  const portScene = new THREE.Scene();
  const amb = new THREE.AmbientLight(0xfff5e8, 1.55);
  const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.35);
  keyLight.position.set(-0.5, 0.7, -1.2);
  const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.15);
  fillLight.position.set(0.65, 0.25, -0.9);
  const rimLight = new THREE.DirectionalLight(0xffd27d, 1.45);
  rimLight.position.set(0, 0.8, 1.1);
  portScene.add(amb, keyLight, fillLight, rimLight);

  const portCam = new THREE.PerspectiveCamera(26, 1, 0.05, 10);
  const prevRT = G.renderer.getRenderTarget();
  const prevClearColor = G.renderer.getClearColor(new THREE.Color());
  const prevClearAlpha = G.renderer.getClearAlpha();

  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const flipCanvas = document.createElement('canvas');
  flipCanvas.width = SIZE;
  flipCanvas.height = SIZE;
  const flipCtx = flipCanvas.getContext('2d');

  const outCanvas = document.createElement('canvas');
  outCanvas.width = SIZE;
  outCanvas.height = SIZE;
  const ctx = outCanvas.getContext('2d');

  const headPos = new THREE.Vector3();
  const portraitMap = {};

  for (const id of ['101', '102', '103', '104', '105', '106', '107']) {
    const npcDef = NPC_DEFS.find((n) => n.id === id);
    const modelId = (npcDef && npcDef.model) || (id === '106' ? '107' : id);
    const ch = makeChar(modelId);
    if (!ch) continue;
    const theme = PORTRAIT_THEMES[id] || PORTRAIT_THEMES['101'];

    // 应用待机动画首帧，令角色自然垂臂立姿
    if (G.anims) {
      const ap = new AnimPlayer(ch.parts, G.anims);
      ap.setSpeed(0);
      ap.update(0.02);
    }
    portScene.add(ch.group);
    ch.group.updateMatrixWorld(true);
    if (ch.parts.mesh && ch.parts.mesh.skeleton) {
      ch.parts.mesh.skeleton.update();
    }

    if (ch.parts.head) {
      ch.parts.head.getWorldPosition(headPos);
    } else {
      headPos.set(0, (ch.height || 1.75) * 0.88, 0);
    }

    // 角色视觉正面朝向本地 -Z（参见 ANIMATION.md §4.4）
    const lookY = headPos.y + (theme.camY || 0.065);
    const lookZ = headPos.z - 0.02;
    portCam.position.set(headPos.x + (theme.camX || 0), lookY + 0.015, headPos.z - (theme.dist || 0.47));
    portCam.lookAt(headPos.x, lookY - 0.01, lookZ);
    portCam.updateProjectionMatrix();

    G.renderer.setRenderTarget(rt);
    G.renderer.setClearColor(0x000000, 0);
    G.renderer.clear(true, true, true);
    G.renderer.render(portScene, portCam);
    G.renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, pixels);

    portScene.remove(ch.group);

    // WebGL 像素行序自底向上，翻转写入 2D Canvas
    const imgData = flipCtx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const srcOff = (SIZE - 1 - y) * SIZE * 4;
      const dstOff = y * SIZE * 4;
      imgData.data.set(pixels.subarray(srcOff, srcOff + SIZE * 4), dstOff);
    }
    flipCtx.putImageData(imgData, 0, 0);

    // 绘制古风仙侠径向渐变背景 + 光晕 + 3D 角色半身像
    ctx.clearRect(0, 0, SIZE, SIZE);
    const grad = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.42, SIZE * 0.06, SIZE * 0.5, SIZE * 0.5, SIZE * 0.54);
    grad.addColorStop(0, theme.bgInner);
    grad.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 背光星轨装饰环
    ctx.save();
    ctx.strokeStyle = theme.rim;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(SIZE * 0.5, SIZE * 0.46, SIZE * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 叠加 3D 角色渲染图层
    ctx.drawImage(flipCanvas, 0, 0);

    portraitMap[id] = outCanvas.toDataURL('image/png');
  }

  G.renderer.setRenderTarget(prevRT);
  G.renderer.setClearColor(prevClearColor, prevClearAlpha);
  rt.dispose();

  // 更新所有角色定义与引擎队伍中的头像地址
  HERO_DEFS.forEach((h) => {
    if (portraitMap[h.id]) h.face = portraitMap[h.id];
  });
  NPC_DEFS.forEach((n) => {
    if (portraitMap[n.id]) n.face = portraitMap[n.id];
  });
  if (G.engine && Array.isArray(G.engine.party)) {
    G.engine.party.forEach((m) => {
      const key = String(m.role_id || m.id || '');
      if (portraitMap[key]) m.face = portraitMap[key];
    });
  }
  G.cfg.faces = NPC_DEFS.map((n) => n.face);
  G.portraits = portraitMap;
}

// ================= 场景 =================
function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.isSprite) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

function initScene(meta, heights, colormapTex, terrainNrm, detailTex) {
  const scene = new THREE.Scene();
  G.scene = scene;
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 12000);
  G.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  G.renderer.setSize(innerWidth, innerHeight);
  G.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  G.renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.15;
  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('app').appendChild(G.renderer.domElement);

  const world = new World(meta, heights, colormapTex);
  G.world = world;

  world.terrainMat = new THREE.MeshStandardMaterial({
    map: colormapTex,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.22,
  });
  if (terrainNrm) world.terrainMat.normalMap = terrainNrm;
  world.terrainMat.normalScale = new THREE.Vector2(2.1, 2.1);
  {
    const d1 = detailTex.dirt,
      d2 = detailTex.stone,
      d3 = detailTex.slab;
    world.terrainMat.onBeforeCompile = (sh) => {
      sh.uniforms.uDirt = { value: d1 };
      sh.uniforms.uStone = { value: d2 };
      sh.uniforms.uSlab = { value: d3 };
      sh.uniforms.uSea = { value: world.sea };
      sh.uniforms.uBump = { value: 0.9 };
      sh.vertexShader =
        `attribute float aSlope;\nattribute float aAlt;\n
        varying vec3 vWp;\n varying float vSlope;\n varying float vAlt;\n` +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n vWp = position;\n vSlope = aSlope;\n vAlt = aAlt;',
        );
      sh.fragmentShader =
        `
        uniform sampler2D uDirt, uStone, uSlab;
        uniform float uSea, uBump;
        varying vec3 vWp; varying float vSlope; varying float vAlt;
      ` +
        sh.fragmentShader
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
           float rock = smoothstep(0.26, 0.70, vSlope);
           float alp  = smoothstep(0.80, 0.96, vAlt - rock * 0.05);
           vec3 c1 = texture2D(uDirt,  vWp.xz * 0.0345).rgb;
           vec3 c1b= texture2D(uDirt,  vWp.zx * 0.0417).rgb;
           c1 = mix(c1, c1b, 0.5);
           vec3 c2 = texture2D(uStone, vWp.xz * 0.0750).rgb;
           vec3 c2b= texture2D(uStone, vWp.zx * 0.0930).rgb;
           c2 = mix(c2, c2b, 0.5);
           vec3 c3 = texture2D(uSlab,  vWp.xz * 0.1250).rgb;
           vec3 c4 = texture2D(uDirt,  vWp.xz * 0.2900).rgb;
           vec3 det = mix(c1, c2, rock);
           det = mix(det, mix(c2, c3, 0.35), alp);
           det = mix(det, det * (0.55 + 0.9 * dot(c4, vec3(0.333))), 0.35);
           float detH = dot(det, vec3(0.299,0.587,0.114));
           float dl = max(0.20, dot(det, vec3(0.299,0.587,0.114)));
           vec3 base = diffuseColor.rgb;
           float bl = max(0.06, dot(base, vec3(0.299,0.587,0.114)));
           vec3 mod = det / dl;
           diffuseColor.rgb = base * mix(vec3(1.0), mod, 0.75)
                                   * mix(1.0, clamp(dl / 0.42, 0.55, 1.55), 0.60);
           vec3 stoneHue = mod * bl;
           diffuseColor.rgb = mix(diffuseColor.rgb, stoneHue,
                                  clamp(rock * 0.55 + alp * 0.50, 0.0, 0.75));
           float shore = 1.0 - smoothstep(0.0, 3.0, vWp.y - uSea);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.20,1.06,0.82), shore*0.65);
           `,
          )
          .replace(
            '#include <normal_fragment_maps>',
            `{
             float bumpFade = (1.0 - smoothstep(50.0, 240.0, length(vWp - cameraPosition))) * uBump;
             if (bumpFade > 0.001) {
               vec2 dH = vec2( dFdx(detH), dFdy(detH) ) * bumpFade;
               vec3 sX = dFdx( -vViewPosition );
               vec3 sY = dFdy( -vViewPosition );
               vec3 R1 = cross( sY, normal ), R2 = cross( normal, sX );
               float fDet = dot( sX, R1 ) * faceDirection;
               normal = normalize( abs( fDet ) * normal - sign( fDet ) * ( dH.x * R1 + dH.y * R2 ) );
             }
           }`,
          );
    };
  }
  scene.add(world.group);

  const env0 = G.env ? G.env.raw(meta.regions[0].name, G.timeOfDay * 24) : null;
  G.water = createWater(world, env0);
  scene.add(G.water.mesh);

  G.sky = createSky(scene);

  G.sun = new THREE.DirectionalLight(0xffffff, 1.6);
  G.sun.castShadow = true;
  G.sun.shadow.mapSize.set(2048, 2048);
  {
    const sc = G.sun.shadow.camera;
    sc.near = 10;
    sc.far = 900;
    sc.left = -90;
    sc.right = 90;
    sc.top = 90;
    sc.bottom = -90;
  }
  G.sun.shadow.bias = -0.0006;
  G.sun.shadow.normalBias = 0.35;
  G.sun.shadow.radius = 6;
  scene.add(G.sun);
  G.sun.target.position.set(0, 0, 0);
  scene.add(G.sun.target);

  G.ambient = new THREE.AmbientLight(0xbfd0e0, 0.35);
  scene.add(G.ambient);
  G.hemi = new THREE.HemisphereLight(0x9db8d2, 0x3a4a33, 0.35);
  scene.add(G.hemi);

  scene.fog = new THREE.Fog(0xa8bdd0, 500, 5200);

  G.pmrem = new THREE.PMREMGenerator(G.renderer);
  G.envScene = new THREE.Scene();
  G.envScene.add(new THREE.Mesh(G.sky.mesh.geometry, G.sky.mat));
  G.envRT = null;
  G._envIBLTimer = 99;
  {
    const bounce = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0x6a7a58, side: THREE.BackSide }),
    );
    bounce.position.y = -5600;
    G.envScene.add(bounce);
  }

  const rtSize = new THREE.Vector2();
  G.renderer.getSize(rtSize);
  const composerRT = new THREE.WebGLRenderTarget(rtSize.x, rtSize.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  G.composer = new EffectComposer(G.renderer, composerRT);
  G.composer.addPass(new RenderPass(scene, G.camera));
  G.gtao = new GTAOPass(scene, G.camera, rtSize.x, rtSize.y);
  G.gtao.output = GTAOPass.OUTPUT.Default;
  G.gtao.blendIntensity = 0.85;
  G.gtao.updateGtaoMaterial({
    radius: 0.4,
    distanceExponent: 2.0,
    thickness: 1.2,
    scale: 1.1,
    samples: 12,
    screenSpaceRadius: false,
    distanceFallOff: 1.0,
  });
  G._gtaoHidden = () => {
    const out = [G.sky.mesh, G.water.mesh];
    for (const e of G.world.chunks.values()) if (e.veg) out.push(e.veg);
    return out;
  };
  const gtaoRender = G.gtao.render.bind(G.gtao);
  G.gtao.render = function (...args) {
    const hidden = G._gtaoHidden();
    for (const o of hidden) o.visible = false;
    gtaoRender(...args);
    for (const o of hidden) o.visible = true;
  };
  G.composer.addPass(G.gtao);
  G.bloom = new UnrealBloomPass(new THREE.Vector2(rtSize.x, rtSize.y), 0.18, 0.6, 0.85);
  G.composer.addPass(G.bloom);
  G.composer.addPass(new OutputPass());
  G.fxaa = new ShaderPass(FXAAShader);
  setFXAAResolution();
  G.composer.addPass(G.fxaa);

  addEventListener('resize', () => {
    G.camera.aspect = innerWidth / innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(innerWidth, innerHeight);
    G.composer.setSize(innerWidth, innerHeight);
    G.gtao.setSize(innerWidth, innerHeight);
    G.bloom.setSize(innerWidth, innerHeight);
    setFXAAResolution();
  });
  bindInput();
}

function setFXAAResolution() {
  const pr = G.renderer.getPixelRatio();
  G.fxaa.material.uniforms['resolution'].value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
}

const _sunPos = new V3();
function updateSunShadow() {
  if (!G.player) return;
  const pp = G.player.obj.position;
  _sunPos.copy(pp).addScaledVector(G.sunDir, 380);
  G.sun.position.copy(_sunPos);
  G.sun.target.position.copy(pp);
  G.sun.target.updateMatrixWorld();
}

const _lastIBLDir = new V3();
function updateEnvironmentIBL(dt) {
  if (!G.pmrem) return;
  G._envIBLTimer += dt;
  if (G._envIBLTimer < 12) return;
  G._envIBLTimer = 0;
  _lastIBLDir.copy(G.sunDir);
  const old = G.envRT;
  G.envRT = G.pmrem.fromScene(G.envScene, 0.04, 10, 12000);
  G.scene.environment = G.envRT.texture;
  if (old) old.dispose();
}

// ================= 生成四主角、偃甲、七章剧情 NPC/Boss、建筑与妖兽 =================
function spawnActors() {
  const [sx, sy, sz] = G.engine.position;
  spawnPartyHeroes(sx, sz);
  spawnPuppetCompanion(sx, sz);
  spawnTelegraphRing();
  spawnStoryWorldObjects();
  spawnPropsFromPhysics();
  spawnMonsterCamps();
  spawnPickups();
}

function spawnPartyHeroes(sx, sz) {
  G.partyActors = [];
  HERO_DEFS.forEach((h, idx) => {
    const ch = makeChar(h.model);
    if (!ch) return;
    const ox = sx + (idx === 0 ? 0 : Math.cos(idx * 2.1) * 2.4);
    const oz = sz + (idx === 0 ? 0 : Math.sin(idx * 2.1) * 2.4);
    ch.group.position.set(ox, G.engine.physics.heightAt(ox, oz), oz);
    ch.group.rotation.order = 'YXZ';
    enableShadows(ch.group);
    const label = makeLabelSprite(h.name, '#ffe9ad', `${h.title} · ${h.astral_totem}`);
    const s = ch.group.scale.x || 1;
    label.scale.set(1.9 / s, 0.71 / s, 1);
    label.position.y = (ch.height + 0.55) / s;
    ch.group.add(label);
    G.scene.add(ch.group);

    const ap = new AnimPlayer(ch.parts, G.anims);
    ap.setSpeed(0);
    const actor = {
      idx,
      def: h,
      obj: ch.group,
      parts: ch.parts,
      height: ch.height,
      ap,
      label,
      speed: 0,
      vy: 0,
      grounded: true,
      hp: h.base_hp,
      maxHp: h.base_hp,
      xp: 0,
      lvl: 10,
      xpNext: 100,
      swim: false,
      alive: true,
      yawFace: 0,
    };
    G.partyActors.push(actor);
  });
  G.player = G.partyActors[0];
}

function spawnPuppetCompanion(sx, sz) {
  const { group, legs, body } = buildBeast(0xd4a24c, 0.78);
  group.position.set(sx + 1.8, G.engine.physics.heightAt(sx + 1.8, sz + 1.5), sz + 1.5);
  const lbl = makeLabelSprite('竹笋包子号', '#ffd76e', '助战偃甲');
  lbl.position.y = 2.1;
  group.add(lbl);
  group.visible = false;
  G.scene.add(group);
  G.puppetMesh = { group, legs, body, label: lbl };
}

function spawnTelegraphRing() {
  const geo = new THREE.RingGeometry(1.2, 5.5, 36);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff3020,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  G.scene.add(mesh);
  G.telegraphRing = mesh;
}

function spawnStoryWorldObjects() {
  for (const wo of G.engine.worldObjects) {
    if (wo.id === 'altar_grand_ending') continue;
    const [wx, wy, wz] = wo.pos;
    if (wo.kind === 'npc' || wo.kind === 'boss') {
      const modelId = wo.model === '106' ? '107' : wo.model || '107';
      const ch = makeChar(modelId);
      if (ch) {
        ch.group.position.set(wx, wy, wz);
        if (wo.kind === 'boss') ch.group.scale.multiplyScalar(1.25);
        enableShadows(ch.group);
        const color = wo.kind === 'boss' ? '#ff8a7a' : '#ffe9ad';
        const sub = wo.kind === 'boss' ? '剧情首领 (按 F 决战)' : '主线人物 (按 F 交谈)';
        const label = makeLabelSprite(wo.name, color, sub);
        const s = ch.group.scale.x || 1;
        label.scale.set(2.1 / s, 0.76 / s, 1);
        label.position.y = (ch.height + 0.6) / s;
        ch.group.add(label);
        G.scene.add(ch.group);
        const ap = new AnimPlayer(ch.parts, G.anims);
        ap.setSpeed(0);
        G.npcs.push({
          id: wo.id,
          def: {
            id: wo.id,
            name: wo.name,
            role: sub,
            face:
              NPC_DEFS.find((n) => wo.name.includes(n.name))?.face || 'assets/ui/face/face_107.png',
            line: wo.name,
          },
          obj: ch.group,
          parts: ch.parts,
          ap,
          region: wo.region,
          pos: new V3(wx, wy, wz),
          woRef: wo,
        });
      }
    } else {
      // 机关 / 零件箱 / 祭坛 / 星海忆念记忆碑 光柱标记
      const grp = new THREE.Group();
      const tint =
        wo.kind === 'mechanism' ? 0x63b3ed : wo.kind === 'echo' ? 0x5ef0c4 : 0xf6ad55;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 5.5, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      beam.position.y = 2.75;
      grp.add(beam);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.3, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5, metalness: 0.3 }),
      );
      base.position.y = 0.45;
      grp.add(base);
      const subTxt =
        wo.kind === 'echo' ? '星海忆念 · 按 F 聆听原版支线' : '按 F 交互 / 破阵';
      const lbl = makeLabelSprite(wo.name, wo.kind === 'echo' ? '#7fffe0' : '#ffd76e', subTxt);
      lbl.position.y = 3.6;
      grp.add(lbl);
      grp.position.set(wx, wy, wz);
      G.scene.add(grp);
      G.storyActors.push({ id: wo.id, obj: grp, woRef: wo });
    }
  }
}

// 直接复用 engine.physics.placedProps 摆放 3D 建筑与桥梁，保证 3D 渲染与 OBB 碰撞 100% 同步
function spawnPropsFromPhysics() {
  if (!G.props || !G.props.length) return;
  const byName = new Map();
  for (const p of G.props) byName.set(p.name, p);

  let placed = 0;
  for (const entry of G.engine.physics.placedProps) {
    const propDef = byName.get(entry.name) || G.props[0];
    if (!propDef) continue;
    const m = makeProp(propDef);
    m.position.set(entry.x, entry.y, entry.z);
    m.rotation.y = entry.rot;
    m.scale.setScalar(entry.scale);
    enableShadows(m);
    G.scene.add(m);
    (G.propObjs || (G.propObjs = [])).push(m);
    placed++;
  }
  console.log('[props] synced with WorldPhysics:', placed);
}

const CAMPS_PER_REGION = 3;
function spawnMonsterCamps() {
  const rng = mulberry(20260918);
  const palettes = [
    [0x5a4a6a, 0xd8cfb8],
    [0x6a3a2a, 0xd8b06a],
    [0x2f5a4a, 0xcfe0c8],
    [0x8a5a2a, 0xe8d9b0],
    [0x44506a, 0xb8c8d8],
  ];
  for (const r of G.meta.regions) {
    for (let c = 0; c < CAMPS_PER_REGION; c++) {
      let mx = r.cx,
        mz = r.cz,
        ok = false;
      for (let t = 0; t < 80; t++) {
        const x = r.cx + (rng() - 0.5) * r.w * 0.85;
        const z = r.cz + (rng() - 0.5) * r.h * 0.85;
        const h = G.world.heightAt(x, z);
        if (h > G.world.sea + 1.5 && G.world.slopeAt(x, z) < 0.4) {
          mx = x;
          mz = z;
          ok = true;
          break;
        }
      }
      if (!ok) continue;
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const pal = palettes[Math.floor(rng() * palettes.length)];
        const x = mx + (rng() - 0.5) * 26,
          z = mz + (rng() - 0.5) * 26;
        const h = G.world.heightAt(x, z);
        if (h < G.world.sea + 1) continue;
        const lvl = 1 + Math.floor(rng() * 3) + (r.biome === 'mountain' ? 2 : 0);
        const { group, legs, body } = buildBeast(pal[0], 0.9 + rng() * 0.7);
        group.position.set(x, h, z);
        G.scene.add(group);
        enableShadows(group);
        const spr = makeLabelSprite('', '#fff', '');
        spr.material.map.image.dataset.name = beastName(rng);
        spr.material.map.image.dataset.lvl = lvl;
        spr.position.y = 1.6 * group.scale.y + 0.9;
        group.add(spr);
        const m = {
          obj: group,
          legs,
          body,
          spr,
          lvl,
          hp: 60 + lvl * 30,
          maxHp: 60 + lvl * 30,
          dmg: 6 + lvl * 4,
          speed: 0,
          state: 'idle',
          home: new V3(x, h, z),
          target: new V3(x, h, z),
          think: 0,
          atkCd: 0,
          icon: G.cfg.monsters[Math.floor(rng() * G.cfg.monsters.length)],
          xp: 30 + lvl * 22,
        };
        updateHpSprite(spr, 1);
        G.monsters.push(m);
      }
    }
  }
}

function beastName(rng) {
  const a = ['赤', '幽', '玄', '霜', '岚', '墨', '苍', '血'];
  const b = ['狼', '豹', '罴', '蛟', '狐', '兕', '魈', '熊'];
  return a[Math.floor(rng() * a.length)] + b[Math.floor(rng() * b.length)];
}

const PICKUP_KINDS = [
  { kind: 'herb', name: '凝碧灵草', iconIdx: 0, tint: 0x7fc86a },
  { kind: 'ore', name: '精铁齿轮', iconIdx: 1, tint: 0xb8c8d8 },
  { kind: 'treasure', name: '昭明残片', iconIdx: 2, tint: 0xe8c86a },
];
function spawnPickups() {
  const rng = mulberry(555);
  const loader = new THREE.TextureLoader();
  for (const r of G.meta.regions) {
    const n = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < n; i++) {
      let x, z, h;
      for (let t = 0; t < 40; t++) {
        x = r.cx + (rng() - 0.5) * r.w * 0.9;
        z = r.cz + (rng() - 0.5) * r.h * 0.9;
        h = G.world.heightAt(x, z);
        if (h > G.world.sea + 1 && G.world.slopeAt(x, z) < 0.45) break;
      }
      if (h === undefined || h < G.world.sea + 1) continue;
      const kind = PICKUP_KINDS[Math.floor(rng() * PICKUP_KINDS.length)];
      const icon = `assets/ui/item/item_${String(Math.floor(rng() * G.meta.ui.items)).padStart(2, '0')}.png`;
      const grp = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: kind.tint,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      beam.position.y = 1.6;
      grp.add(beam);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.035, 6, 20),
        new THREE.MeshBasicMaterial({ color: kind.tint }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      grp.add(ring);
      const tex = loader.load(icon);
      tex.colorSpace = THREE.SRGBColorSpace;
      const ico = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
      ico.scale.set(0.8, 0.8, 1);
      ico.position.y = 1.1;
      grp.add(ico);
      grp.position.set(x, h, z);
      G.scene.add(grp);
      G.pickups.push({
        obj: grp,
        kind: kind.kind,
        name: kind.name,
        icon,
        ring,
        beam,
        taken: false,
      });
    }
  }
}

// ================= 玩家、小队同伴与 AI 自动巡航更新 =================
const _f = new V3(),
  _np = new V3();
const MOVE_SPEED = 4.2;
const SPRINT_SPEED = 6.3;

function switchActiveHero(index) {
  const idx = Number(index);
  if (idx < 0 || idx >= G.partyActors.length) return;
  // 若玩家手动按 1-4，确保该主角已入队以便随时体验四主角操控
  G.engine.party[idx].in_team = true;
  G.engine.switchLeader(idx);
  const prev = G.player;
  const next = G.partyActors[idx];
  if (prev && next && prev !== next) {
    next.obj.position.copy(prev.obj.position);
    next.obj.rotation.y = prev.obj.rotation.y;
    next.yawFace = prev.yawFace;
  }
  G.player = next;
  const heroState = G.engine.party[idx];
  toast(`切换主控领队：${heroState.name}（${heroState.title} · 星蕴${heroState.astral_totem}）`);
  refreshStats();
  renderPartyBar();
}

function toggleAutoPilot(forceState) {
  G.autoPilot = forceState !== undefined ? forceState : !G.autoPilot;
  const btn = $('btnAutoPilot');
  if (btn) {
    btn.classList.toggle('on', G.autoPilot);
    btn.textContent = G.autoPilot ? '🤖 AI 巡航中 (按方向键接管)' : '🤖 AI 自动巡航 (P)';
  }
  toast(
    G.autoPilot
      ? '🤖 已开启 AI 自动巡航：自动寻路九域、造偃甲、破机关、战沈夜！'
      : '已由真人玩家接管操控',
  );
}

function updatePlayer(dt) {
  const p = G.player;
  const phys = G.engine.physics;
  if (!p || !p.alive) return;

  // 若按下任何方向键，立即由真人接管 AI 自动巡航
  const manualMove = G.keys['w'] || G.keys['s'] || G.keys['a'] || G.keys['d'];
  if (manualMove && G.autoPilot) {
    toggleAutoPilot(false);
  }

  let turnRate = 0;
  if (G.autoPilot) {
    const res = G.engine.stepAutoPilot(dt, 55.0);
    if (res && res.moved) {
      p.obj.position.set(res.x, res.y, res.z);
      p.yawFace = res.yaw;
      p.speed = SPRINT_SPEED;
    } else {
      p.speed = 0;
      if (res && res.event) {
        handleEngineEvent(res);
      }
    }
    if (G.engine.leaderIdx !== p.idx && G.partyActors[G.engine.leaderIdx]) {
      G.player = G.partyActors[G.engine.leaderIdx];
    }
  } else {
    let target = (G.keys['shift'] ? SPRINT_SPEED : MOVE_SPEED) * (p.swim ? 0.55 : 1);
    let ix = 0,
      iz = 0;
    if (G.keys['w']) iz -= 1;
    if (G.keys['s']) iz += 1;
    if (G.keys['a']) ix -= 1;
    if (G.keys['d']) ix += 1;
    const moving = ix || iz;
    if (!moving) target = 0;
    if (!p.grounded && !p.swim) target *= 0.85;

    const accel = (p.grounded ? (target > p.speed ? 11 : 13) : 5) * dt;
    p.speed += Math.max(-accel, Math.min(accel, target - p.speed));
    if (p.speed < 0.02) p.speed = 0;

    if (moving && p.speed > 0) {
      const a = Math.atan2(-ix, -iz);
      const dir = G.yaw + a;
      _f.set(Math.sin(dir), 0, Math.cos(dir));
      p.yawFace = Math.atan2(-_f.x, -_f.z);
      const nx = p.obj.position.x + _f.x * p.speed * dt;
      const nz = p.obj.position.z + _f.z * p.speed * dt;
      // 使用 WorldPhysics 2D OBB 建筑阻挡 + 沿墙滑动 + 陡坡阻挡
      const stepRes = phys.stepMovement(p.obj.position.x, p.obj.position.z, nx, nz, true);
      p.obj.position.x = stepRes.x;
      p.obj.position.z = stepRes.z;
    }
  }

  // 平滑转身
  {
    let d = p.yawFace - p.obj.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = d * Math.min(1, dt * 12);
    p.obj.rotation.y += step;
    turnRate = dt > 0 ? step / dt : 0;
  }

  // 地形 + 桥梁高度抬升 + 游泳
  const x = p.obj.position.x,
    z = p.obj.position.z;
  const gh = phys.heightAt(x, z);
  const inWater = gh < phys.sea - 0.9;
  p.swim = inWater;
  if (inWater) {
    const targetY = phys.sea - 0.75;
    p.obj.position.y += (targetY - p.obj.position.y) * Math.min(1, dt * 6);
    p.vy = 0;
    p.grounded = true;
  } else {
    if (p.grounded && G.keys[' ']) {
      p.vy = 8.2;
      p.grounded = false;
      if (p.ap) p.ap.playAction('jump', { fadeIn: 0.06, fadeOut: 0.18, rate: 1.1, hold: true });
    }
    p.vy -= 22 * dt;
    p.obj.position.y += p.vy * dt;
    if (p.obj.position.y <= gh) {
      if (!p.grounded && p.ap) p.ap.releaseAction();
      p.obj.position.y = gh;
      p.vy = 0;
      p.grounded = true;
    }
  }
  if (p.swim) p.obj.position.y += Math.sin(perfNow() * 1.6) * 0.02;

  // 同步坐标回 engine_core
  G.engine.position = [Number(x.toFixed(2)), Number(p.obj.position.y.toFixed(2)), Number(z.toFixed(2))];
  G.engine._updateRegionDiscovery(x, z);

  if (p.ap) {
    p.ap.setSpeed(p.speed);
    p.ap.update(dt);
  }

  // 身体倾斜
  {
    const accNow = (p.speed - (p.lastSpeed || 0)) / Math.max(dt, 1e-4);
    p.leanA =
      (p.leanA || 0) +
      (THREE.MathUtils.clamp(-accNow * 0.008, -0.12, 0.12) - (p.leanA || 0)) * Math.min(1, dt * 4);
    p.leanT =
      (p.leanT || 0) +
      (THREE.MathUtils.clamp(turnRate * 0.5, -0.12, 0.12) - (p.leanT || 0)) * Math.min(1, dt * 5);
    const air = !p.grounded && !p.swim ? 0.4 : 1;
    p.obj.rotation.x = p.leanA * air;
    p.obj.rotation.z = p.leanT * air;
    p.lastSpeed = p.speed;
  }

  G.attackCd = Math.max(0, G.attackCd - dt);
  G.skillCd = Math.max(0, G.skillCd - dt);
  G.dodgeCd = Math.max(0, G.dodgeCd - dt);
  G.ultCd = Math.max(0, G.ultCd - dt);
  G.engine.step(1, dt);

  // 更新其余 3 名在队同伴跟随与自动助战
  updatePartyCompanions(dt);

  // 区域发现提示
  const reg = phys.regionAt(x, z);
  if (reg && !G.discovered.has(reg.name)) {
    G.discovered.add(reg.name);
    announceRegion(reg.disp);
    saveGame();
  }
}

function updatePartyCompanions(dt) {
  const leaderPos = G.player.obj.position;
  const phys = G.engine.physics;
  G.partyActors.forEach((actor, idx) => {
    if (actor === G.player) {
      actor.obj.visible = true;
      return;
    }
    const memberState = G.engine.party[idx];
    if (!memberState || !memberState.in_team) {
      actor.obj.visible = false;
      return;
    }
    actor.obj.visible = true;
    const angle = G.player.obj.rotation.y + (idx === 1 ? 2.4 : idx === 2 ? -2.4 : Math.PI);
    const tx = leaderPos.x + Math.sin(angle) * 2.8;
    const tz = leaderPos.z + Math.cos(angle) * 2.8;
    const dx = tx - actor.obj.position.x;
    const dz = tz - actor.obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 16) {
      actor.obj.position.set(tx, phys.heightAt(tx, tz), tz);
      actor.speed = 0;
    } else if (dist > 0.8) {
      const sp = dist > 4 ? SPRINT_SPEED : MOVE_SPEED;
      actor.obj.position.x += (dx / dist) * sp * dt;
      actor.obj.position.z += (dz / dist) * sp * dt;
      actor.obj.position.y = phys.heightAt(actor.obj.position.x, actor.obj.position.z);
      actor.obj.rotation.y = Math.atan2(-dx, -dz);
      actor.speed = sp;
    } else {
      actor.speed = 0;
    }
    if (actor.ap) {
      actor.ap.setSpeed(actor.speed);
      actor.ap.update(dt);
    }
  });

  // 更新助战偃甲位置与动画
  if (G.puppetMesh) {
    const activePuppet = G.engine.puppets.active_puppet;
    if (activePuppet) {
      G.puppetMesh.group.visible = true;
      const t = perfNow();
      const px = leaderPos.x + Math.cos(t * 1.4) * 2.2;
      const pz = leaderPos.z + Math.sin(t * 1.4) * 2.2;
      G.puppetMesh.group.position.set(px, phys.heightAt(px, pz) + 0.1, pz);
      G.puppetMesh.group.rotation.y = t * 1.4 + Math.PI / 2;
      animateBeast(G.puppetMesh, 4.0, t);
    } else {
      G.puppetMesh.group.visible = false;
    }
  }

  // 更新 Boss 红圈 AOE 预警环
  if (G.telegraphRing) {
    if (G.engine.combat.active && G.engine.combat.telegraph_active) {
      G.telegraphRing.visible = true;
      G.telegraphRing.position.set(leaderPos.x, leaderPos.y + 0.18, leaderPos.z);
      const pulse = 0.85 + Math.sin(perfNow() * 10) * 0.15;
      G.telegraphRing.scale.setScalar(pulse);
    } else {
      G.telegraphRing.visible = false;
    }
  }
}

// ================= 四主角即时动作战斗触发 =================
function performCombatMove(action) {
  const p = G.player;
  if (!p || !p.alive) return;
  if (action === 'attack' && G.attackCd > 0) return;
  if (action === 'skill' && G.skillCd > 0) return;
  if (action === 'dodge' && G.dodgeCd > 0) return;
  if (action === 'ultimate' && G.ultCd > 0) return;

  if (action === 'attack' || action === 'heavy') G.attackCd = 0.42;
  if (action === 'skill') G.skillCd = 2.0;
  if (action === 'dodge') G.dodgeCd = 0.8;
  if (action === 'ultimate') G.ultCd = 3.5;

  if (p.ap) {
    if (action === 'dodge') {
      p.ap.playAction('jump', { fadeIn: 0.04, fadeOut: 0.15, rate: 1.5 });
      const fwd = new V3(-Math.sin(p.obj.rotation.y), 0, -Math.cos(p.obj.rotation.y));
      p.obj.position.addScaledVector(fwd, 3.2);
    } else {
      p.ap.playAction('attack', {
        fadeIn: 0.05,
        fadeOut: 0.16,
        rate: action === 'ultimate' ? 1.3 : 1.85,
      });
    }
  }

  // 若处于 Boss 战中，调用确定性内核解算连击/破盾/无敌帧/终结技
  if (G.engine.combat.active) {
    const res = G.engine.combatAction(action);
    handleEngineEvent(res);
    return;
  }

  // 野外妖兽即时挥砍
  let near = null,
    nd = 1e9;
  const range = action === 'skill' || action === 'ultimate' ? 8.5 : 4.2;
  for (const m of G.monsters) {
    if (m.dead || m.hp <= 0) continue;
    const dd = m.obj.position.distanceTo(p.obj.position);
    if (dd <= range + 2.0 && dd < nd) {
      nd = dd;
      near = m;
    }
  }
  if (near) {
    const t = near.obj.position.clone().sub(p.obj.position);
    t.y = 0;
    if (t.lengthSq() > 1e-4) p.obj.rotation.y = Math.atan2(-t.x, -t.z);
  }
  const fwd = new V3(-Math.sin(p.obj.rotation.y), 0, -Math.cos(p.obj.rotation.y));
  const heroState = G.engine.party[G.engine.leaderIdx];
  const baseDmg =
    action === 'ultimate'
      ? heroState.attack * 3.2
      : action === 'heavy' || action === 'skill'
        ? heroState.attack * 2.0
        : heroState.attack;
  let hitAny = false;
  for (const m of G.monsters) {
    if (m.dead || m.hp <= 0) continue;
    const d = m.obj.position.clone().sub(p.obj.position);
    if (d.length() > range + 1.2) continue;
    d.y = 0;
    d.normalize();
    if (action !== 'ultimate' && d.dot(fwd) < -0.2) continue;
    hitAny = true;
    damageMonster(m, Math.round(baseDmg), m.obj.position.clone().add(new V3(0, 1.5, 0)));
  }
  sfx(hitAny ? 'hit' : 'miss');
}

function handleEngineEvent(res) {
  if (!res) return;
  if (res.damage_dealt) {
    showDmg(
      G.player.obj.position.clone().add(new V3(0, 2.4, 0)),
      res.damage_dealt,
      res.event && res.event.includes('ultimate') ? '#ff9f43' : '#ffd76e',
    );
    sfx('hit');
  }
  if (res.combat && res.combat.last_combat_log) {
    toast(res.combat.last_combat_log);
  }
  if (res.dialog && res.dialog.visible) {
    openEngineDialog(res.dialog);
  }
  if (res.sequence && res.sequence.active) {
    toast(`🎬 ${res.sequence.title}：${res.sequence.subtitle}`);
  }
  if (res.game_cleared) {
    toast('🎉 恭喜通关《古剑奇谭二：永夜初晗凝碧天》全部七章主线！');
  }
  refreshStats();
  renderPartyBar();
  updateTracker();
  updateBossHud();
}

function damageMonster(m, dmg, at) {
  m.hp -= dmg;
  m.state = 'chase';
  showDmg(at, dmg);
  updateHpSprite(m.spr, m.hp / m.maxHp);
  if (m.hp <= 0) killMonster(m);
}

function killMonster(m) {
  G.scene.remove(m.obj);
  m.dead = true;
  G.kills++;
  G.engine.puppets.parts_count += 1;
  toast(`击败 ${m.spr.material.map.image.dataset.name} · 获得偃甲齿轮×1`);
  updateTracker();
  saveGame();
}

function damagePlayer(dmg) {
  const hero = G.engine.party[G.engine.leaderIdx];
  if (!hero || G.engine.combat.iframe_timer > 0) return;
  hero.hp = Math.max(10, hero.hp - dmg);
  $('hurt').style.opacity = 0.9;
  setTimeout(() => ($('hurt').style.opacity = 0), 260);
  showDmg(G.player.obj.position.clone().add(new V3(0, 2, 0)), dmg, '#ff7a6a');
  refreshStats();
  renderPartyBar();
}

// ================= 妖兽 AI =================
function updateMonsters(dt) {
  const p = G.player;
  for (const m of G.monsters) {
    if (m.dead) continue;
    const d = p.obj.position.distanceTo(m.obj.position);
    if (d > 600) {
      m.obj.visible = false;
      continue;
    }
    m.obj.visible = true;
    m.think -= dt;
    m.atkCd -= dt;
    const aggro = 19,
      deaggro = 70;
    if (m.state === 'idle' && d < aggro && p.alive) m.state = 'chase';
    if (m.state === 'chase' && (d > deaggro || !p.alive)) m.state = 'return';

    let sp = 0;
    if (m.state === 'idle') {
      if (m.think <= 0) {
        m.think = 2 + Math.random() * 4;
        m.target.set(
          m.home.x + (Math.random() - 0.5) * 24,
          0,
          m.home.z + (Math.random() - 0.5) * 24,
        );
      }
      sp = 1.2;
    } else if (m.state === 'chase') {
      m.target.copy(p.obj.position);
      sp = 5.2;
      if (d < 2.4 && m.atkCd <= 0 && p.alive) {
        m.atkCd = 2.0;
        damagePlayer(Math.max(3, m.dmg - 4));
      }
    } else {
      m.target.copy(m.home);
      sp = 4;
      if (m.obj.position.distanceTo(m.home) < 3) m.state = 'idle';
    }
    const dir = _np.copy(m.target).sub(m.obj.position);
    dir.y = 0;
    const dl = dir.length();
    if (dl > 1.2) {
      dir.normalize();
      m.obj.position.addScaledVector(dir, sp * dt);
      m.obj.rotation.y = Math.atan2(dir.x, dir.z);
      m.speed = sp;
    } else m.speed = 0;
    const gh = G.world.heightAt(m.obj.position.x, m.obj.position.z);
    m.obj.position.y += (Math.max(gh, G.world.sea - 0.9) - m.obj.position.y) * Math.min(1, dt * 8);
    if (m.speed > 0) animateBeast(m, m.speed, perfNow());
  }
  G.monsters = G.monsters.filter((m) => !m.dead);
}

// ================= NPC 待机 =================
const _npcDt = { v: 0 };
function updateNPCs(now) {
  const dt = Math.max(0.001, Math.min(0.05, now - (_npcDt.v || now - 0.016)));
  _npcDt.v = now;
  for (const n of G.npcs) {
    if (n.obj.position.distanceTo(G.player.obj.position) > 360) {
      n.obj.visible = false;
      continue;
    }
    n.obj.visible = true;
    if (n.ap) n.ap.update(dt);
  }
}

// ================= 昼夜 =================
const _fogC = new THREE.Color(),
  _tmpC = new THREE.Color();
function updateDayNight(dt) {
  G.timeOfDay = (G.timeOfDay + dt / 600) % 1;
  const hour = G.timeOfDay * 24;
  const env = G.env
    ? G.env.sample(
        G.world,
        G.player ? G.player.obj.position.x : 0,
        G.player ? G.player.obj.position.z : 0,
        hour,
        dt,
      )
    : null;
  const sd = env && env.sunDir ? env.sunDir : [0.577, 0.577, 0.577];
  const azim = Math.atan2(sd[2], sd[0]);
  const noonElev = Math.asin(Math.max(0.08, Math.min(0.97, sd[1])));
  const t = (hour - 6) / 12;
  const e = t < 0 || t > 1 ? -0.42 : Math.sin(t * Math.PI) * noonElev;
  const sunDir = new V3(
    Math.cos(azim) * Math.cos(e),
    Math.sin(e),
    Math.sin(azim) * Math.cos(e),
  ).normalize();
  G.sunDir = sunDir;
  G.sun.castShadow = sunDir.y > 0.02;
  updateSunShadow();

  G.sky.mat.uniforms.uSunDir.value.copy(sunDir);
  G.sun.position.copy(sunDir).multiplyScalar(1000);

  if (env) {
    const amb = env.light.ambient,
      dif = env.light.diffuse,
      sl = env.sun;
    const aMul = env.light.ambientMul !== undefined ? env.light.ambientMul : 1;
    const dMul = env.light.diffuseMul !== undefined ? env.light.diffuseMul : 1;
    G.ambient.color.setRGB(amb[0], amb[1], amb[2]);
    const dayF = Math.max(0, Math.min(1, sunDir.y * 2.5 + 0.1));
    G.ambient.intensity = 0.25 + 0.45 * dayF + 0.1 * Math.min(2.0, aMul);
    G.sun.color.setRGB(dif[0], dif[1], dif[2]);
    G.sun.intensity =
      Math.min(4.2, 0.55 + 0.65 * (sl.lum !== undefined ? sl.lum : 1.0)) *
      Math.min(2.0, dMul) *
      (0.2 + 0.8 * Math.max(0.0, sunDir.y * 2.4 + 0.25));
    G.hemi.color.setRGB(dif[0], dif[1], dif[2]);
    G.hemi.groundColor.setRGB(amb[0] * 0.8, amb[1] * 0.8, amb[2] * 0.8);
    G.hemi.intensity = 0.15 + 0.45 * dayF + 0.08 * Math.min(1.5, aMul);

    const f = env.fog;
    const fm = f.colorMul !== undefined ? f.colorMul : 1;
    _fogC.setRGB(f.color[0] * fm, f.color[1] * fm, f.color[2] * fm);
    _tmpC.setRGB(env.sky.bottom[0], env.sky.bottom[1], env.sky.bottom[2]);
    _fogC.lerp(_tmpC, 0.45);
    G.scene.fog.color.copy(_fogC);
    const fi = Math.max(0.02, f.intensity !== undefined ? f.intensity : 0.3);
    G.scene.fog.near = 900 + (2600 * fi) / (1 + fi);
    G.scene.fog.far = G.scene.fog.near + 5200 + (3600 * fi) / (1 + fi);
    G.renderer.setClearColor(_fogC);

    const su = G.sky.mat.uniforms;
    su.uTop.value.setRGB(env.sky.top[0], env.sky.top[1], env.sky.top[2]);
    su.uMid.value.setRGB(env.sky.middle[0], env.sky.middle[1], env.sky.middle[2]);
    su.uBot.value.setRGB(env.sky.bottom[0], env.sky.bottom[1], env.sky.bottom[2]);
    su.uLum.value = env.sky.lumScale !== undefined ? env.sky.lumScale : 0.2;
    su.uInscatter.value = env.sky.inscatter !== undefined ? env.sky.inscatter : 0.3;
    const sn = env.sun;
    su.uSunColor.value.setRGB(
      sn.color[0] * 0.35 + env.sky.top[0] * 0.65,
      sn.color[1] * 0.35 + env.sky.top[1] * 0.65,
      sn.color[2] * 0.35 + env.sky.top[2] * 0.65,
    );
    su.uSunLum.value = sn.lum !== undefined ? sn.lum : 1.0;
    su.uSunSize.value = sn.size !== undefined ? sn.size : 4.0;
    su.uCloud.value.setRGB(env.cloud.color[0], env.cloud.color[1], env.cloud.color[2]);
    su.uCloudAlpha.value = env.cloud.alpha || 0;
    su.uCloudCurve.value = env.cloud.curve || 0.2;

    const wu = G.water.mat.uniforms;
    wu.uSkyHorizon.value.setRGB(
      env.sky.middle[0] * 0.7 + env.sky.bottom[0] * 0.3,
      env.sky.middle[1] * 0.7 + env.sky.bottom[1] * 0.3,
      env.sky.middle[2] * 0.7 + env.sky.bottom[2] * 0.3,
    );
    G.water.mat.uniforms.uSunDir.value.copy(sunDir);
  }

  updateEnvironmentIBL(dt);
  vegTime.value = perfNow();
  G.sky.mat.uniforms.uTime.value = perfNow();
  G.water.mat.uniforms.uTime.value = perfNow();
  const hh = Math.floor(hour),
    mm = Math.floor((hour % 1) * 60);
  const icon = sunDir.y > 0 ? '☀' : '☾';
  $('clock').textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ================= 交互与对话 =================
function updateInteract() {
  const p = G.player;
  let hint = '',
    near = null;
  for (const n of G.npcs) {
    if (p.obj.position.distanceTo(n.obj.position) < 5.5) {
      near = { type: 'npc', o: n };
      hint = `按 F 与 ${n.def.name} 交互`;
      break;
    }
  }
  if (!near) {
    for (const sa of G.storyActors) {
      if (p.obj.position.distanceTo(sa.obj.position) < 5.5) {
        near = { type: 'story', o: sa };
        hint = `按 F 触发【${sa.woRef.name}】`;
        break;
      }
    }
  }
  if (!near) {
    for (const pk of G.pickups) {
      if (pk.taken) continue;
      if (p.obj.position.distanceTo(pk.obj.position) < 3.0) {
        near = { type: 'pickup', o: pk };
        hint = `按 F 采集 ${pk.name}`;
        break;
      }
    }
  }
  G.nearNPC = near && near.type === 'npc' ? near.o : null;
  G.nearStoryObj = near && near.type === 'story' ? near.o : null;
  G.nearPickup = near && near.type === 'pickup' ? near.o : null;
  $('hint').textContent = hint;
  $('hint').style.opacity = hint ? 1 : 0;
}

function interact() {
  if (G.dialogOpen && G.engine.dialog.visible) {
    // 若当前处于多分支抉择且按 F，默认选第 1 项并继续
    if (
      G.engine.dialog.line_index + 1 >= G.engine.dialog.total_lines &&
      G.engine.story.pending_branch &&
      !G.engine.story.branches_chosen[G.engine.story.pending_branch.id]
    ) {
      const bRes = G.engine.chooseBranch(G.engine.story.pending_branch.id, 0);
      handleEngineEvent(bRes);
      return;
    }
    const sRes = G.engine.stepDialog();
    if (!sRes.dialog || !sRes.dialog.visible) {
      closeDialog();
    } else {
      handleEngineEvent(sRes);
    }
    return;
  }
  if (G.dialogOpen) {
    closeDialog();
    G.engine.interact();
    return;
  }
  if (G.nearNPC) {
    const res = G.engine.interact(G.nearNPC.id);
    handleEngineEvent(res);
  } else if (G.nearStoryObj) {
    const res = G.engine.interact(G.nearStoryObj.id);
    handleEngineEvent(res);
  } else if (G.nearPickup) {
    takePickup(G.nearPickup);
  } else {
    const res = G.engine.interact();
    handleEngineEvent(res);
  }
}

function takePickup(pk) {
  pk.taken = true;
  G.scene.remove(pk.obj);
  G.engine.puppets.parts_count += 1;
  G.engine._addItem(3099, pk.name, 1);
  toast(`采集 ${pk.name}（偃甲零件+1）`);
  sfx('pick');
  updateTracker();
  saveGame();
}

function openEngineDialog(dlg) {
  G.dialogOpen = true;
  $('dialog').style.display = 'block';
  $('cinemaTop').classList.add('on');
  $('cinemaBottom').classList.add('on');

  const cut = G.engine.cutscene || {};
  $('cinemaSceneTitle').textContent =
    (dlg.scene_title || '永夜初晗 · 剧情演绎') + (dlg.subtitle ? ` ｜ ${dlg.subtitle}` : '');
  $('cinemaPoem').textContent = dlg.poem || cut.poem || '';
  $('cutsceneShotBadge').textContent = `🎥 机位：${cut.shot_name || '越肩特写'} · 切镜 #${cut.camera_cuts || 1}`;

  const roleKey = String(dlg.role_id || 101);
  const npcDef =
    NPC_DEFS.find((n) => n.id === roleKey || dlg.speaker.includes(n.name)) || NPC_DEFS[0];
  $('dlgPortrait').src =
    (G.portraits && (G.portraits[roleKey] || G.portraits[npcDef.id])) ||
    `assets/ui/face/face_${roleKey}.png`;

  const cgEl = $('dlgStoryCg');
  if (cgEl) {
    cgEl.src = dlg.story_cg || cut.story_cg || 'assets/ui/story/story_00.png';
  }

  $('dlgName').textContent = dlg.speaker || '乐无异';
  $('dlgTitleTag').textContent =
    (dlg.speaker_title ? `· ${dlg.speaker_title}` : '') +
    (dlg.emotion ? ` 【${dlg.emotion}】` : '');
  $('dlgLineCounter').textContent =
    dlg.total_lines > 0
      ? `台词 ${Math.min(dlg.line_index + 1, dlg.total_lines)} / ${dlg.total_lines}`
      : '';
  $('dlgText').textContent = dlg.text;

  // 触发说话角色的 3D 骨骼演出动作
  if (cut.anim && cut.anim !== 'idle' && G.player && G.player.ap) {
    G.player.ap.playAction(cut.anim === 'jump' ? 'jump' : 'attack', {
      fadeIn: 0.08,
      fadeOut: 0.22,
      rate: 1.2,
    });
  }

  // 多分支对话选项渲染
  const brBox = $('dlgBranches');
  brBox.innerHTML = '';
  const pendingBr = G.engine.story.pending_branch;
  const atLastLine = (dlg.line_index || 0) + 1 >= (dlg.total_lines || 1);
  if (pendingBr && atLastLine && !G.engine.story.branches_chosen[pendingBr.id]) {
    brBox.style.display = 'flex';
    const promptDiv = document.createElement('div');
    promptDiv.style.cssText = 'color:#ffe49e;font-size:13px;font-weight:600;margin-bottom:4px';
    promptDiv.textContent = pendingBr.prompt;
    brBox.appendChild(promptDiv);
    pendingBr.options.forEach((opt, idx) => {
      const btn = document.createElement('div');
      btn.className = 'branchBtn';
      btn.textContent = opt.label;
      btn.onclick = () => {
        const res = G.engine.chooseBranch(pendingBr.id, idx);
        handleEngineEvent(res);
      };
      brBox.appendChild(btn);
    });
  } else {
    brBox.style.display = 'none';
  }

  const opts = $('dlgOpts');
  opts.innerHTML = '';
  const nextBtn = document.createElement('div');
  nextBtn.className = 'btn';
  nextBtn.textContent =
    (dlg.line_index || 0) + 1 < (dlg.total_lines || 1) ? '下一句 · 切镜 (F)' : '完成对白 (F)';
  nextBtn.onclick = () => interact();
  opts.appendChild(nextBtn);

  if ((dlg.line_index || 0) + 1 < (dlg.total_lines || 1)) {
    const skipBtn = document.createElement('div');
    skipBtn.className = 'btn';
    skipBtn.style.opacity = '0.78';
    skipBtn.textContent = '跳过本幕';
    skipBtn.onclick = () => {
      closeDialog();
      G.engine.interact();
    };
    opts.appendChild(skipBtn);
  }
}

function closeDialog() {
  G.dialogOpen = false;
  $('dialog').style.display = 'none';
  $('cinemaTop').classList.remove('on');
  $('cinemaBottom').classList.remove('on');
  if (G.camera && G.camera.fov !== 55) {
    G.camera.fov = 55;
    G.camera.updateProjectionMatrix();
  }
}

// ================= HUD 与系统面板 =================
function refreshStats() {
  const hero = G.engine.party[G.engine.leaderIdx] || G.engine.party[0];
  const heroKey = String(hero.role_id || hero.id || '');
  $('portrait').src = (G.portraits && G.portraits[heroKey]) || hero.face;
  $('pname').textContent = `${hero.name} · ${hero.title}`;
  $('hpBar').style.width = (hero.hp / hero.max_hp) * 100 + '%';
  $('hpTxt').textContent = `${Math.ceil(hero.hp)} / ${hero.max_hp}`;
  $('totemTxt').textContent = `星蕴·${hero.astral_totem}(${hero.element}) ｜ 武器:${hero.equipped_weapon}`;
  $('xpBar').style.width = hero.morale + '%';
  $('xpTxt').textContent = `战意 ${hero.morale}%`;
  $('lvl').textContent = hero.level;
}

function renderPartyBar() {
  const bar = $('partyBar');
  if (!bar) return;
  bar.innerHTML = '';
  G.engine.party.forEach((m, idx) => {
    const mKey = String(m.role_id || m.id || '');
    const faceUrl = (G.portraits && G.portraits[mKey]) || m.face;
    const d = document.createElement('div');
    d.className = `pcard ${idx === G.engine.leaderIdx ? 'active' : ''} ${!m.in_team ? 'locked' : ''}`;
    d.innerHTML = `
      <img src="${faceUrl}">
      <div class="pinfo">
        <div class="ptop">
          <span><b>[${idx + 1}] ${m.name}</b> · ${m.astral_totem}</span>
          <span>Lv.${m.level}</span>
        </div>
        <div class="php"><div style="width:${Math.round((m.hp / m.max_hp) * 100)}%"></div></div>
      </div>
    `;
    d.onclick = () => switchActiveHero(idx);
    bar.appendChild(d);
  });
}

function updateBossHud() {
  const c = G.engine.combat;
  const el = $('bossHud');
  if (!el) return;
  if (!c.active) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  $('bossName').textContent = `⚔ ${c.enemy_name}`;
  $('bossHpNum').textContent = `HP ${c.enemy_hp} / ${c.enemy_max_hp}`;
  $('bossHpBar').style.width = Math.max(0, (c.enemy_hp / c.enemy_max_hp) * 100) + '%';
  $('bossShieldBar').style.width =
    c.shield_max_hp > 0 ? Math.max(0, (c.shield_hp / c.shield_max_hp) * 100) + '%' : '0%';
  $('bossTelegraph').textContent = c.telegraph_active
    ? `⚠ 危险红圈预警：【${c.telegraph_name}】—— 立即按 C / 右键 施展 0.45s 无敌帧闪避！`
    : c.shield_broken
      ? '✨ 护盾已击破！按 U 释放星蕴终结技【金刚力士 / 流光 / 太极 / 山鬼】！'
      : '🛡 敌方拥有护盾，按 K 重击破盾 或 G 格挡反击！';
}

function updateTracker() {
  const el = $('questList');
  if (!el) return;
  el.innerHTML = '';
  const curStage = G.engine.quest_stage;
  CHAPTER_QUESTS.forEach((q) => {
    const done = curStage >= q.maxStage;
    const active = curStage >= q.minStage && curStage < q.maxStage;
    const d = document.createElement('div');
    d.className = 'q';
    d.style.opacity = done ? '0.65' : active ? '1.0' : '0.45';
    d.innerHTML = `${done ? '<span class="done">✔</span>' : active ? '▶' : '·'} <b style="color:${active ? '#f0dfae' : '#c3ceda'}">${q.title}</b><br><span style="color:#8fa0b5">${q.desc}</span>`;
    el.appendChild(d);
  });
}

function renderSystemPanel() {
  const box = $('sysContent');
  if (!box) return;
  const e = G.engine;
  box.innerHTML = `
    <div style="margin-bottom:14px">
      <h3 style="color:#f0dfae;font-size:14px;margin-bottom:6px">一、四象星蕴定式盘（剩余星魄：${e.astral.star_souls}）</h3>
      ${e.party
        .map(
          (p) => `
        <div class="prow">
          <span><b>${p.name}</b> · 星蕴【${p.astral_totem}·${p.element}】 (已注入 ${p.astral_points} 星魄 ｜ 终结技：【${p.ultimate_name}】${p.ultimate_unlocked ? '✔' : '未解锁'})</span>
          <span class="miniBtn" data-astral="${p.role_id}">注入星魄 +2</span>
        </div>`,
        )
        .join('')}
    </div>
    <div style="margin-bottom:14px;border-top:1px solid rgba(255,255,255,.12);padding-top:10px">
      <h3 style="color:#f0dfae;font-size:14px;margin-bottom:6px">二、乐无异偃甲工坊（齿轮零件：${e.puppets.parts_count} ｜ 当前助战：${e.puppets.active_puppet || '无'}）</h3>
      ${Object.values(PUPPET_DEFS)
        .map(
          (pd) => `
        <div class="prow">
          <span><b>【${pd.name}】</b> (DPS:${pd.dps}) —— ${pd.desc}</span>
          <span class="miniBtn" data-puppet="${pd.id}">${e.puppets.crafted.includes(pd.id) ? '已制造 (切换出战)' : '打造偃甲'}</span>
        </div>`,
        )
        .join('')}
    </div>
    <div style="border-top:1px solid rgba(255,255,255,.12);padding-top:10px">
      <h3 style="color:#f0dfae;font-size:14px;margin-bottom:6px">三、桃源仙居（灵草收获：${e.home.herbs_harvested} ｜ 木作：${e.home.woodwork_crafted.length} ｜ 料理：${e.home.dishes_cooked.length}）</h3>
      <div class="prow">
        <span>仙居农田：种植并收获【凝碧灵草】×4</span>
        <span class="miniBtn" data-home="plant">灵草收获</span>
      </div>
      <div class="prow">
        <span>鲁班木作：制作【神机鲁班匣】（产出偃甲零件×4）</span>
        <span class="miniBtn" data-home="woodwork">鲁班木作</span>
      </div>
      <div class="prow">
        <span>仙居庖厨：烹制【竹笋包子·叫花鸡全席】（全队生命+40、攻击+8）</span>
        <span class="miniBtn" data-home="cook">烹饪料理</span>
      </div>
    </div>
  `;
  box.querySelectorAll('[data-astral]').forEach((btn) => {
    btn.onclick = () => {
      e.allocateAstral(Number(btn.dataset.astral), 2);
      toast('✨ 星蕴注入成功，属性提升并领悟星蕴终结技！');
      renderSystemPanel();
      refreshStats();
    };
  });
  box.querySelectorAll('[data-puppet]').forEach((btn) => {
    btn.onclick = () => {
      e.craftPuppet(btn.dataset.puppet);
      toast(`🤖 偃甲【${PUPPET_DEFS[btn.dataset.puppet].name}】已出战协同攻击！`);
      renderSystemPanel();
      updateTracker();
    };
  });
  box.querySelectorAll('[data-home]').forEach((btn) => {
    btn.onclick = () => {
      e.homeAction(btn.dataset.home);
      toast('🏡 桃源仙居经营完成！');
      renderSystemPanel();
      refreshStats();
      updateTracker();
    };
  });
}

function announceRegion(name) {
  const el = $('regionName');
  el.textContent = name;
  el.style.opacity = 1;
  setTimeout(() => (el.style.opacity = 0), 2600);
  toast(`踏入地域：${name}`);
}

let toastTimer = 0;
function toast(txt) {
  const el = $('toast');
  if (!el) return;
  el.textContent = txt;
  el.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.style.opacity = 0), 3000);
}

function showDmg(pos, n, color = '#ffd76e') {
  const v = pos.clone().project(G.camera);
  if (v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'dmg';
  el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px';
  el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
  el.style.color = color;
  el.textContent = n;
  $('dmgLayer').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function buildHotbar() {
  const hb = $('hotbar');
  hb.innerHTML = '';
  HOTBAR_SKILLS.forEach((sk, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    const icon = G.cfg.skills[sk.iconIdx % G.cfg.skills.length] || G.cfg.skills[0];
    s.innerHTML = `<img src="${icon}"><span class="sname">${sk.name}</span><span class="key">${sk.key}</span><div class="cd" id="cd${i}" style="display:none"></div>`;
    s.onclick = () => performCombatMove(sk.action);
    hb.appendChild(s);
  });
}

function updateHotbarCd() {
  HOTBAR_SKILLS.forEach((sk, i) => {
    const el = $('cd' + i);
    if (!el) return;
    const raw =
      sk.action === 'attack' || sk.action === 'heavy'
        ? G.attackCd
        : sk.action === 'skill'
          ? G.skillCd
          : sk.action === 'dodge'
            ? G.dodgeCd
            : sk.action === 'ultimate'
              ? G.ultCd
              : 0;
    const ratio = Math.min(1, raw / sk.cd);
    if (ratio > 0) {
      el.style.display = 'block';
      el.style.height = ratio * 100 + '%';
    } else el.style.display = 'none';
  });
}

function renderInventory() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  const list = G.engine.inventory.items;
  for (let i = 0; i < Math.max(24, Math.ceil(list.length / 8) * 8); i++) {
    const c = document.createElement('div');
    const it = list[i];
    if (it) {
      c.className = 'icell';
      const ico = G.cfg.items[i % G.cfg.items.length];
      c.innerHTML = `<img src="${ico}"><span class="cnt">${it.count}</span>`;
      c.title = it.name;
    } else c.className = 'icell empty';
    grid.appendChild(c);
  }
  $('invStats').innerHTML = `
    <div class="prow"><span>当前主线章节</span><span>${G.engine.getCurrentQuest().title} (stage=${G.engine.quest_stage})</span></div>
    <div class="prow"><span>已合成偃甲</span><span>${G.engine.puppets.crafted.join(', ') || '暂无'}</span></div>
    <div class="prow"><span>探索九域</span><span>${G.engine.discoveredRegions.size} / 9</span></div>
  `;
}

// ================= 小地图 =================
let mmcCtx = null,
  mapImg = null;
function initMinimap() {
  mmcCtx = $('mmc').getContext('2d');
  mapImg = new Image();
  mapImg.src = './assets/world.colormap.png';
}
function drawMinimap() {
  if (!mapImg || !mapImg.complete || !mmcCtx) return;
  const c = mmcCtx,
    S = 392;
  const p = G.player.obj.position;
  const view = 900;
  const u = (x) => (x - G.world.originX) / G.world.worldW;
  const v = (z) => (z - G.world.originZ) / G.world.worldH;
  const sx = u(p.x) * mapImg.width,
    sy = v(p.z) * mapImg.height;
  const cropW = (view / G.world.worldW) * mapImg.width;
  const cropH = (view / G.world.worldH) * mapImg.height;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath();
  c.arc(S / 2, S / 2, S / 2, 0, 7);
  c.clip();
  c.drawImage(mapImg, sx - cropW / 2, sy - cropH / 2, cropW, cropH, 0, 0, S, S);
  c.restore();
  const reg = G.world.regionAt(p.x, p.z);
  c.font = '600 20px "Microsoft YaHei"';
  c.textAlign = 'center';
  c.shadowColor = '#000';
  c.shadowBlur = 4;
  c.fillStyle = '#f0e6c8';
  if (reg) c.fillText(reg.disp, S / 2, 30);
  c.save();
  c.translate(S / 2, S / 2);
  c.rotate(-G.yaw + Math.PI);
  c.fillStyle = '#ffe9ad';
  c.beginPath();
  c.moveTo(0, -10);
  c.lineTo(7, 8);
  c.lineTo(0, 4);
  c.lineTo(-7, 8);
  c.closePath();
  c.fill();
  c.restore();
}

function openBigMap() {
  const reg = G.world.regionAt(G.player.obj.position.x, G.player.obj.position.z);
  const img = $('bigmap');
  if (reg) {
    img.src = `./assets/mapimg/${reg.name}.png`;
    $('mapInfo').textContent = `${reg.disp} —— 尺幅约 ${Math.round(reg.w)} × ${Math.round(reg.h)} 米（原版舆图）`;
  } else {
    img.src = './assets/world.colormap.png';
    $('mapInfo').textContent = '九域山河全图';
  }
  showPanel('mapPanel');
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach((p) => (p.style.display = 'none'));
  if (id) {
    $(id).style.display = 'block';
    G.panelOpen = id;
  } else G.panelOpen = null;
}

function saveGame() {
  try {
    G.engine.saveCheckpoint('browser_autosave');
    localStorage.setItem(
      'shx.save.gj2',
      JSON.stringify(G.engine.checkpoints.get('browser_autosave')),
    );
  } catch (e) {}
}

function loadGame() {
  try {
    const raw = JSON.parse(localStorage.getItem('shx.save.gj2'));
    if (!raw) return false;
    G.engine.checkpoints.set('browser_autosave', raw);
    G.engine.loadCheckpoint('browser_autosave');
    const [x, y, z] = G.engine.position;
    G.player.obj.position.set(x, y, z);
    return true;
  } catch (e) {
    return false;
  }
}

let actx = null;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    const o = actx.createOscillator(),
      g = actx.createGain();
    o.connect(g);
    g.connect(actx.destination);
    if (kind === 'hit') {
      o.frequency.value = 180;
      o.type = 'square';
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t);
      o.stop(t + 0.13);
    } else if (kind === 'miss') {
      o.frequency.value = 500;
      o.type = 'triangle';
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.start(t);
      o.stop(t + 0.09);
    } else if (kind === 'pick') {
      o.frequency.value = 660;
      o.type = 'sine';
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t);
      o.stop(t + 0.3);
    }
  } catch (e) {}
}

// ================= 剧本台词与 3D 过场运镜鉴赏器面板 =================
function renderTheaterPanel() {
  const box = $('theaterContent');
  if (!box) return;
  const e = G.engine;
  const st = e.story;
  const sceneEntries = Object.values(STORY_SCRIPTS);

  box.innerHTML = `
    <div style="margin-bottom:14px;background:rgba(201,169,97,.1);border:1px solid rgba(201,169,97,.35);border-radius:6px;padding:10px 14px">
      <div class="prow" style="margin:2px 0">
        <span><b>📜 剧本进度</b>：已演出的原版剧目 ${st.scenes_viewed.length} / ${sceneEntries.length} 幕 ｜ 已读原版台词 <b>${st.lines_read}</b> 句 ｜ 电影镜头切镜 <b>${e.cutscene.camera_cuts}</b> 次</span>
      </div>
      <div class="prow" style="margin:2px 0">
        <span><b>💖 同伴羁绊好感</b>：闻人羽(${st.affection[102]}) · 夏夷则(${st.affection[103]}) · 阿阮(${st.affection[104]}) · 谢衣/初七(${st.affection[106]})</span>
      </div>
      <div class="prow" style="margin:2px 0">
        <span><b>☯ 道心倾向</b>：仁心(${st.alignment.benevolence}) · 坚毅(${st.alignment.resolve}) · 洞明(${st.alignment.insight}) ｜ 星海忆念支线：${st.echoes_discovered.length} / ${SIDE_ECHOES.length}</span>
      </div>
    </div>

    <div style="margin-bottom:14px">
      <h3 style="color:#f0dfae;font-size:14px;margin-bottom:8px">一、《古剑奇谭二》12 场主线原版剧本名场面（点击立即触发 3D 运镜实机演出）</h3>
      ${sceneEntries
        .map(
          (sc) => `
        <div class="prow" style="border-bottom:1px solid rgba(255,255,255,.07);padding:5px 0">
          <span>
            <b style="color:#ffe49e">${sc.title}</b> <span style="color:#8fa0b5;font-size:12px">(${sc.subtitle} · ${sc.lines.length}句台词${sc.branch_id ? ' · 含多分支抉择' : ''})</span><br>
            <span style="color:#a8b8c8;font-size:12px;font-style:italic">“${sc.poem}”</span>
          </span>
          <span class="miniBtn" data-play-scene="${sc.id}">🎥 实机运镜演绎</span>
        </div>`,
        )
        .join('')}
    </div>

    <div style="border-top:1px solid rgba(255,255,255,.15);padding-top:10px">
      <h3 style="color:#7fffe0;font-size:14px;margin-bottom:8px">二、九域【星海忆念 · 原版支线】记忆回响（共 ${SIDE_ECHOES.length} 处）</h3>
      ${SIDE_ECHOES.map(
        (ec) => `
        <div class="prow" style="border-bottom:1px solid rgba(255,255,255,.06);padding:4px 0">
          <span><b>${ec.name}</b> <span style="color:#8fa0b5;font-size:12px">[区域:${ec.region}] ${st.echoes_discovered.includes(ec.id) ? '✔已收集' : ''}</span></span>
          <span class="miniBtn" data-play-echo="${ec.id}">✨ 聆听忆念</span>
        </div>`,
      ).join('')}
    </div>
  `;

  box.querySelectorAll('[data-play-scene]').forEach((btn) => {
    btn.onclick = () => {
      const sid = btn.dataset.playScene;
      showPanel(null);
      const res = e.playScript(sid);
      handleEngineEvent(res);
    };
  });

  box.querySelectorAll('[data-play-echo]').forEach((btn) => {
    btn.onclick = () => {
      const eid = btn.dataset.playEcho;
      const ec = SIDE_ECHOES.find((x) => x.id === eid);
      if (ec && G.player) {
        const y = e.physics.heightAt(ec.pos[0], ec.pos[1]);
        G.player.obj.position.set(ec.pos[0], y, ec.pos[1]);
        e.position = [ec.pos[0], y, ec.pos[1]];
      }
      showPanel(null);
      const res = e.triggerEcho(eid, true);
      handleEngineEvent(res);
    };
  });
}

// ================= 输入绑定 =================
function bindInput() {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    G.keys[k] = true;
    if (G.state !== 'play') return;

    // 若处于多分支剧情抉择界面，按 1/2/3 直接选择对应剧情分支
    if (
      G.dialogOpen &&
      G.engine.dialog.visible &&
      G.engine.story.pending_branch &&
      G.engine.dialog.line_index + 1 >= G.engine.dialog.total_lines &&
      !G.engine.story.branches_chosen[G.engine.story.pending_branch.id]
    ) {
      if (k === '1' || k === '2' || k === '3') {
        const res = G.engine.chooseBranch(G.engine.story.pending_branch.id, Number(k) - 1);
        handleEngineEvent(res);
        return;
      }
    }

    if (k === '1') switchActiveHero(0);
    if (k === '2') switchActiveHero(1);
    if (k === '3') switchActiveHero(2);
    if (k === '4') switchActiveHero(3);
    if (k === 'f' || (G.dialogOpen && k === ' ')) interact();
    if (k === 'j') performCombatMove('attack');
    if (k === 'k') performCombatMove('heavy');
    if (k === 'l') performCombatMove('skill');
    if (k === 'c') performCombatMove('dodge');
    if (k === 'g') performCombatMove('guard');
    if (k === 'u') performCombatMove('ultimate');
    if (k === 'p') toggleAutoPilot();
    if (k === 'v') {
      renderTheaterPanel();
      showPanel(G.panelOpen === 'theaterPanel' ? null : 'theaterPanel');
    }
    if (k === 'y') {
      renderSystemPanel();
      showPanel(G.panelOpen === 'sysPanel' ? null : 'sysPanel');
    }
    if (k === 'i') {
      renderInventory();
      showPanel(G.panelOpen === 'invPanel' ? null : 'invPanel');
    }
    if (k === 'm') {
      if (G.panelOpen === 'mapPanel') showPanel(null);
      else openBigMap();
    }
    if (k === 'h') showPanel(G.panelOpen === 'helpPanel' ? null : 'helpPanel');
    if (k === 'escape') {
      if (G.dialogOpen) closeDialog();
      else showPanel(null);
    }
  });
  addEventListener('keyup', (e) => (G.keys[e.key.toLowerCase()] = false));

  const dom = G.renderer.domElement;
  dom.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      if (G.panelOpen || G.dialogOpen) return;
      G.camDrag = true;
      G.dragMoved = false;
      G.dragStart = [e.clientX, e.clientY];
    } else if (e.button === 2) {
      if (G.state === 'play') performCombatMove('dodge');
    }
  });
  addEventListener('mousemove', (e) => {
    if (G.camDrag) {
      const dx = e.clientX - G.dragStart[0],
        dy = e.clientY - G.dragStart[1];
      if (Math.abs(dx) + Math.abs(dy) > 3) G.dragMoved = true;
      G.yaw -= dx * 0.006;
      G.pitch = Math.max(0.02, Math.min(1.2, G.pitch + dy * 0.005));
      G.dragStart = [e.clientX, e.clientY];
    }
  });
  addEventListener('mouseup', () => {
    if (G.camDrag && !G.dragMoved && G.state === 'play' && !G.panelOpen && !G.dialogOpen) {
      performCombatMove('attack');
    }
    G.camDrag = false;
  });
  dom.addEventListener(
    'wheel',
    (e) => {
      G.dist = Math.max(4, Math.min(26, G.dist + e.deltaY * 0.012));
    },
    { passive: true },
  );
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  $('btnNew').onclick = () => startGame(false, false);
  $('btnAutoStart').onclick = () => startGame(false, true);
  $('btnCont').onclick = () => startGame(true, false);
  $('btnAutoPilot').onclick = () => toggleAutoPilot();
  if ($('btnTheaterTop')) {
    $('btnTheaterTop').onclick = () => {
      renderTheaterPanel();
      showPanel(G.panelOpen === 'theaterPanel' ? null : 'theaterPanel');
    };
  }
  $('btnSystemPanel').onclick = () => {
    renderSystemPanel();
    showPanel(G.panelOpen === 'sysPanel' ? null : 'sysPanel');
  };
  $('btnMapTop').onclick = () => openBigMap();
  $('btnHelpTop').onclick = () => showPanel('helpPanel');
  $('closePanel').onclick = () => showPanel(null);
  $('closePanelSys').onclick = () => showPanel(null);
  if ($('closePanelTheater')) $('closePanelTheater').onclick = () => showPanel(null);
  $('closePanel2').onclick = () => showPanel(null);
  $('closePanel3').onclick = () => showPanel(null);
}

function startGame(cont, startAutoPilot = false) {
  $('title').style.display = 'none';
  $('hud').style.display = 'block';
  G.state = 'play';
  if (cont) loadGame();
  initMinimap();
  refreshStats();
  renderPartyBar();
  updateTracker();
  buildHotbar();
  if (startAutoPilot) toggleAutoPilot(true);
  const reg = G.world.regionAt(G.player.obj.position.x, G.player.obj.position.z);
  if (reg) announceRegion(reg.disp);
  lastSave = perfNow();
  requestAnimationFrame(loop);
}

// ================= 主循环 =================
let lastT = 0,
  lastSave = 0;
function perfNow() {
  return performance.now() / 1000;
}

function loop(t) {
  requestAnimationFrame(loop);
  const now = t / 1000;
  let dt = Math.min(0.05, now - (lastT || now));
  lastT = now;

  if (G.state !== 'play') return;

  updatePlayer(dt);
  updateNPCs(now);
  updateMonsters(dt);
  updateDayNight(dt);
  updateInteract();
  updateHotbarCd();
  updateBossHud();

  const p = G.player.obj.position;
  if (G.dialogOpen && G.engine.dialog.visible && G.engine.cutscene && G.engine.cutscene.active) {
    // 电影级 3D 过场运镜导演系统 (CutsceneDirector)
    const cut = G.engine.cutscene;
    const targetFov = cut.fov || 40;
    if (Math.abs(G.camera.fov - targetFov) > 0.1) {
      G.camera.fov += (targetFov - G.camera.fov) * Math.min(1, dt * 6);
      G.camera.updateProjectionMatrix();
    }
    let focusPos = p;
    if (cut.focus === 'npc' && G.nearNPC && G.nearNPC.obj) {
      focusPos = G.nearNPC.obj.position;
    }
    const baseYaw = G.player.obj.rotation.y + Math.PI + now * (cut.orbitSpeed || 0.08);
    const dist = cut.dist || 3.4;
    const side = cut.sideOffset || 0;
    const cx = focusPos.x + Math.sin(baseYaw) * dist + Math.cos(baseYaw) * side;
    const cz = focusPos.z + Math.cos(baseYaw) * dist - Math.sin(baseYaw) * side;
    const cy = focusPos.y + (cut.height || 1.6);
    const ch = G.world.heightAt(cx, cz);
    const shakeX = cut.shake ? (Math.sin(now * 38) * cut.shake * 0.15) : 0;
    const shakeY = cut.shake ? (Math.cos(now * 44) * cut.shake * 0.12) : 0;
    G.camera.position.lerp(
      _np.set(cx + shakeX, Math.max(cy + shakeY, ch + 0.65), cz),
      Math.min(1, dt * 4.5),
    );
    G.camera.lookAt(focusPos.x, focusPos.y + (cut.lookHeight || 1.42), focusPos.z);
  } else {
    if (Math.abs(G.camera.fov - 55) > 0.2) {
      G.camera.fov += (55 - G.camera.fov) * Math.min(1, dt * 6);
      G.camera.updateProjectionMatrix();
    }
    const cx = p.x - Math.sin(G.yaw) * Math.cos(G.pitch) * G.dist;
    const cz = p.z - Math.cos(G.yaw) * Math.cos(G.pitch) * G.dist;
    const cy = p.y + 2 + Math.sin(G.pitch) * G.dist;
    const ch = G.world.heightAt(cx, cz);
    G.camera.position.lerp(_np.set(cx, Math.max(cy, ch + 1.2), cz), Math.min(1, dt * 10));
    G.camera.lookAt(p.x, p.y + (G.player.height || 1.8) * 0.85, p.z);
  }

  G.world.update(p.x, p.z);

  if (now - lastSave > 20) {
    lastSave = now;
    saveGame();
  }

  drawMinimap();
  G.composer.render();
}
