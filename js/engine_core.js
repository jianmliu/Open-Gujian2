// engine_core.js —— 《古剑奇谭二：永夜初晗凝碧天》纯 ESM 确定性游戏核心引擎
// 零 DOM / 零 WebGL 依赖：既可在 Node.js 无头宿主以 20,000+ FPS 锁步运行，也可在浏览器端直接驱动 Three.js 场景与 HUD。

import {
  STORY_SCRIPTS,
  STORY_BRANCHES,
  SIDE_ECHOES,
  CAMERA_SHOT_PRESETS,
} from './story_data.js';

export { STORY_SCRIPTS, STORY_BRANCHES, SIDE_ECHOES, CAMERA_SHOT_PRESETS };

/**
 * Mulberry32 确定性伪随机数发生器
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==================== 《古剑奇谭二》角色与星蕴定义 ====================
export const HERO_DEFS = [
  {
    role_id: 101,
    id: '101',
    model: '101',
    name: '乐无异',
    title: '长安偃师',
    face: 'assets/ui/face/face_101.png',
    weapon: '晗光剑',
    astral_totem: '腾蛇',
    element: '火',
    base_hp: 260,
    base_atk: 42,
    base_def: 18,
    combo_names: ['新月连环·壹', '新月连环·贰', '风雨亮节·叁'],
    heavy_name: '流影剑·破甲',
    skill_id: 2102,
    skill_name: '拨云见日',
    ultimate_id: 2101,
    ultimate_name: '金刚力士',
    line: '哈哈，只要有足够的齿轮和木芯，本少爷就能造出天下最厉害的偃甲！',
  },
  {
    role_id: 102,
    id: '102',
    model: '103',
    name: '闻人羽',
    title: '百草谷天罡',
    face: 'assets/ui/face/face_102.png',
    weapon: '百胜刀枪',
    astral_totem: '天狼',
    element: '金',
    base_hp: 300,
    base_atk: 46,
    base_def: 24,
    combo_names: ['天罡枪·突刺', '天罡枪·回马', '天罡枪·裂阵'],
    heavy_name: '横扫千军·破盾',
    skill_id: 2202,
    skill_name: '移星换斗',
    ultimate_id: 2201,
    ultimate_name: '流光',
    line: '百草谷天罡闻人羽，奉命调查江陵古墓异动。枪在人在，绝不退缩！',
  },
  {
    role_id: 103,
    id: '103',
    model: '102',
    name: '夏夷则',
    title: '太华山道术',
    face: 'assets/ui/face/face_103.png',
    weapon: '太华佩剑',
    astral_totem: '太阴',
    element: '水',
    base_hp: 240,
    base_atk: 50,
    base_def: 16,
    combo_names: ['太华剑气·初', '太华剑气·凝', '太华剑气·寒霜'],
    heavy_name: '云龙击·碎盾',
    skill_id: 2302,
    skill_name: '玄凝剑·冰封',
    ultimate_id: 2301,
    ultimate_name: '太极',
    line: '太华山清和真人座下夏夷则。道法自然，以水化剑，斩却尘世妖邪。',
  },
  {
    role_id: 104,
    id: '104',
    model: '104',
    name: '阿阮',
    title: '巫山神女',
    face: 'assets/ui/face/face_104.png',
    weapon: '巴乌·玉骨折扇',
    astral_totem: '鸾鸟',
    element: '木',
    base_hp: 220,
    base_atk: 44,
    base_def: 15,
    combo_names: ['灵草飞花·壹', '灵草飞花·贰', '巴乌清音·叁'],
    heavy_name: '万叶飞花',
    skill_id: 2402,
    skill_name: '春风化雨',
    ultimate_id: 2401,
    ultimate_name: '山鬼',
    line: '阿阮吹巴乌给你听好不好？只要有灵力露水，大家受的伤很快就会好起来啦！',
  },
];

export const NPC_DEFS = [
  ...HERO_DEFS.map((h) => ({
    id: h.id,
    model: h.model,
    name: h.name,
    face: h.face,
    role: h.title,
    line: h.line,
  })),
  {
    id: '105',
    model: '105',
    name: '华月',
    face: 'assets/ui/face/face_105.png',
    role: '流月城廉贞祭司',
    line: '阿夜的心愿，便是华月此生唯一的执念……哪怕背负万世骂名，你们也休想踏上流月城半步！',
  },
  {
    id: '106',
    model: '107', // 原始 106.bin 为非人形巨型建筑网格，人形 NPC 绑定骨架复用 107
    name: '谢衣',
    face: 'assets/ui/face/face_106.png',
    role: '大偃师 / 初七',
    line: '偃术之道，在于以机关造物泽被苍生，而非沦为杀伐兵燹之器。无异，这方桃源仙居与星蕴盘便托付于你了。',
  },
  {
    id: '107',
    model: '107',
    name: '沈夜',
    face: 'assets/ui/face/face_107.png',
    role: '流月城紫微大祭司',
    line: '烈山部族人的性命由本座一力承担！纵使与心魔砺缨契约、堕入万劫不复之境，本座亦绝不后悔！',
  },
];

export const PUPPET_DEFS = {
  zhusun_baozi: {
    id: 'zhusun_baozi',
    name: '竹笋包子号',
    dps: 22,
    desc: '乐无异在长安亲手打造的得意木甲，能喷火助战并自动索敌连击。',
    cost_parts: 2,
  },
  mujia_shiwei: {
    id: 'mujia_shiwei',
    name: '木甲侍卫',
    dps: 45,
    desc: '静水湖谢衣真传偃甲卫士，兼具重盾援护与破甲重击。',
    cost_parts: 2,
  },
  feitian_yanjia: {
    id: 'feitian_yanjia',
    name: '飞天偃甲',
    dps: 68,
    desc: '融合流月城与捐毒遗迹古法的高阶飞天木甲，全天候灵力轰击。',
    cost_parts: 2,
  },
};

export const CHAPTER_QUESTS = [
  {
    chapter: 1,
    minStage: 100,
    maxStage: 200,
    region: 'n04',
    title: '第一章·长安偃术试炼',
    desc: '在沧澜山脉（定国公府试炼场）收集偃甲零件、打造【竹笋包子号】，并通过木甲比试。',
  },
  {
    chapter: 2,
    minStage: 200,
    maxStage: 300,
    region: 'n01p1',
    title: '第二章·江陵古墓与百草天罡',
    desc: '前往望仙台（江陵古墓）与百草谷天罡【闻人羽】汇合入队，破解古墓双枢机关。',
  },
  {
    chapter: 3,
    minStage: 300,
    maxStage: 450,
    region: 'n01p2',
    title: '第三章·太华山与青萝谷寻仙',
    desc: '赴青萝谷结识【夏夷则】、入镜湖秘境唤醒【阿阮】，集结古剑二四大主角。',
  },
  {
    chapter: 4,
    minStage: 450,
    maxStage: 600,
    region: 'n12p3',
    title: '第四章·静水湖谢衣居与桃源仙居',
    desc: '在禾风平原拜见偃术大师【谢衣】，点亮四象星蕴定式，经营桃源仙居并打造高阶偃甲。',
  },
  {
    chapter: 5,
    minStage: 600,
    maxStage: 750,
    region: 'q04b',
    title: '第五章·赤岩捐毒遗迹',
    desc: '深入赤岩荒原修复捐毒浑天仪机关，运用闪避无敌帧与小队连携击败【沙海巨型偃甲·金刚力士】。',
  },
  {
    chapter: 6,
    minStage: 750,
    maxStage: 880,
    region: 'n10',
    title: '第六章·雾隐巫山与落霞神女墓',
    desc: '赴雾隐林唤醒昭明剑心碎片，于落霞坡重铸【昭明神剑】并击败流月城廉贞祭司【华月】。',
  },
  {
    chapter: 7,
    minStage: 880,
    maxStage: 1000,
    region: 'q08',
    title: '终章·断霄流月城寂静之间',
    desc: '登临断霄岭流月城之巅，破除矩木护盾、释放四主角星蕴终结技决战【沈夜】与【心魔砺缨】。',
  },
];

// ==================== 程序化合成九域世界兜底 (Clean-Room BYOA Fallback) ====================
export function buildProceduralWorldAssets() {
  const meta = {
    procedural: true,
    spacing: 2.0,
    width: 2000,
    height: 2050,
    worldW: 4000.0,
    worldH: 4100.0,
    originX: -1900.0,
    originZ: -1850.0,
    hmin: -40.0,
    hmax: 420.0,
    seaLevel: 0.0,
    spawn: [0.0, 0.0],
    regions: [
      { name: 'n04', disp: '沧澜山脉', cx: 0.0, cz: 0.0, w: 2200.0, h: 2200.0, biome: 'mountain' },
      { name: 'n01p1', disp: '望仙台', cx: 550.0, cz: -1450.0, w: 600.0, h: 600.0, biome: 'hill' },
      { name: 'q08', disp: '断霄岭', cx: 1550.0, cz: -1250.0, w: 900.0, h: 900.0, biome: 'mountain' },
      { name: 'n08', disp: '镜湖秘境', cx: -1500.0, cz: -850.0, w: 600.0, h: 600.0, biome: 'lake' },
      { name: 'n01p2', disp: '青萝谷', cx: -1500.0, cz: 350.0, w: 600.0, h: 600.0, biome: 'valley' },
      { name: 'n12p3', disp: '禾风平原', cx: 1500.0, cz: 450.0, w: 600.0, h: 700.0, biome: 'plain' },
      { name: 'q04b', disp: '赤岩荒原', cx: -350.0, cz: 1650.0, w: 1000.0, h: 1000.0, biome: 'desert' },
      { name: 'q07', disp: '落霞坡', cx: -1400.0, cz: 1300.0, w: 500.0, h: 500.0, biome: 'hill' },
      { name: 'n10', disp: '雾隐林', cx: 1500.0, cz: 1350.0, w: 400.0, h: 400.0, biome: 'forest' },
    ],
    ui: { items: 48, monsters: 24, skills: 24, story: 8, faces: 4 },
  };

  const W = meta.width;
  const H = meta.height;
  const heights = new Float32Array(W * H);
  heights.fill(30.12);

  // 在 (-83.3, 154.0) 附近生成陡峭悬崖地形 (供陡坡阻挡测试)
  const cliffCx = -83.3;
  const cliffCz = 148.0;
  const minIx = Math.max(0, Math.floor((cliffCx - 40 - meta.originX) / meta.spacing));
  const maxIx = Math.min(W - 1, Math.ceil((cliffCx + 40 - meta.originX) / meta.spacing));
  const minIz = Math.max(0, Math.floor((cliffCz - 40 - meta.originZ) / meta.spacing));
  const maxIz = Math.min(H - 1, Math.ceil((cliffCz + 40 - meta.originZ) / meta.spacing));
  for (let iz = minIz; iz <= maxIz; iz++) {
    const wz = meta.originZ + iz * meta.spacing;
    for (let ix = minIx; ix <= maxIx; ix++) {
      const wx = meta.originX + ix * meta.spacing;
      const d2 = (wx - cliffCx) * (wx - cliffCx) + (wz - cliffCz) * (wz - cliffCz);
      if (d2 < 900) {
        heights[iz * W + ix] = 30.12 + 85.0 * Math.exp(-d2 / 120.0);
      }
    }
  }

  const dirs = ['n04', 'n01', 'q08', 'n08', 'n12', 'q04', 'q07', 'n10', 'm03', 'bridge'];
  const props = [
    { name: 'm03_building_086', cat: 'm03', region: 'm03', size: [12.417, 6.5, 15.432] },
    { name: 'bridge_034', cat: 'bridge', region: 'bridge', size: [27.99, 6.979, 9.597] },
  ];
  for (const d of dirs) {
    props.push(
      { name: `${d}_building_big`, cat: d, region: d, size: [16.0, 9.0, 14.0] },
      { name: `${d}_building_mid`, cat: d, region: d, size: [8.0, 5.5, 7.5] },
      { name: `${d}_prop_sml`, cat: d, region: d, size: [3.2, 2.4, 3.2] },
    );
  }
  const regionBuildings = {
    n04: ['n04', 'm03'],
    n01: ['n01'],
    q08: ['q08'],
    n08: ['n08'],
    n12: ['n12'],
    q04: ['q04'],
    q07: ['q07'],
    n10: ['n10'],
  };
  const propsIndex = { props, regionBuildings, shared: ['m03', 'bridge'] };
  return { meta, heights, propsIndex };
}

// ==================== 真实地形 + 建筑 OBB 碰撞 + 桥梁抬升物理引擎 ====================
export class WorldPhysics {
  /**
   * @param {object} meta - world.meta.json
   * @param {Float32Array} heights - 2000x2050 高度数组（米）
   * @param {object} propsIndex - assets/props/index.json
   */
  constructor(meta, heights, propsIndex = null) {
    this.meta = meta;
    this.W = meta.width;
    this.H = meta.height;
    this.spacing = meta.spacing;
    this.worldW = meta.worldW;
    this.worldH = meta.worldH;
    this.originX = meta.originX;
    this.originZ = meta.originZ;
    this.hmin = meta.hmin;
    this.hmax = meta.hmax;
    this.sea = meta.seaLevel || 0;
    this.heights = heights;
    this.propsIndex = propsIndex;

    this.cellSize = 32.0;
    this.grid = new Map();
    this.placedProps = [];
    this.villages = [];
    this.maxClimbSlope = 0.68;

    this._buildDeterministicProps();
  }

  static fromUint16Buffer(meta, uint16Array, propsIndex = null) {
    const heights = new Float32Array(uint16Array.length);
    const span = meta.hmax - meta.hmin;
    for (let i = 0; i < uint16Array.length; i++) {
      heights[i] = meta.hmin + (uint16Array[i] / 65535) * span;
    }
    return new WorldPhysics(meta, heights, propsIndex);
  }

  idx(ix, iz) {
    return iz * this.W + ix;
  }

  /**
   * 原始地形双线性插值高度
   */
  terrainHeightAt(x, z) {
    const fx = (x - this.originX) / this.spacing;
    const fz = (z - this.originZ) / this.spacing;
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    if (x0 < 0 || z0 < 0 || x0 >= this.W - 1 || z0 >= this.H - 1) {
      return this.sea - 6;
    }
    const tx = fx - x0;
    const tz = fz - z0;
    const h = this.heights;
    const a = h[this.idx(x0, z0)];
    const b = h[this.idx(x0 + 1, z0)];
    const c = h[this.idx(x0, z0 + 1)];
    const d = h[this.idx(x0 + 1, z0 + 1)];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  /**
   * 精确高度（含桥梁桥面抬升）
   */
  heightAt(x, z) {
    const th = this.terrainHeightAt(x, z);
    const bh = this.bridgeHeightAt(x, z);
    return bh !== null ? Math.max(th, bh) : th;
  }

  /**
   * 计算地形坡度 (1 - normal.y)
   */
  slopeAt(x, z) {
    const e = this.spacing;
    const hl = this.terrainHeightAt(x - e, z);
    const hr = this.terrainHeightAt(x + e, z);
    const hd = this.terrainHeightAt(x, z - e);
    const hu = this.terrainHeightAt(x, z + e);
    const nx = hl - hr;
    const ny = 2 * e;
    const nz = hd - hu;
    const len = Math.hypot(nx, ny, nz) || 1;
    return 1 - ny / len;
  }

  regionAt(x, z) {
    for (const r of this.meta.regions) {
      if (Math.abs(x - r.cx) <= r.w / 2 + 40 && Math.abs(z - r.cz) <= r.h / 2 + 40) {
        return r;
      }
    }
    return null;
  }

  _insertPropToGrid(entry) {
    this.placedProps.push(entry);
    const rad = Math.hypot(entry.hx, entry.hz) + 2.0;
    const minCx = Math.floor((entry.x - rad) / this.cellSize);
    const maxCx = Math.floor((entry.x + rad) / this.cellSize);
    const minCz = Math.floor((entry.z - rad) / this.cellSize);
    const maxCz = Math.floor((entry.z + rad) / this.cellSize);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cz}`;
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(entry);
      }
    }
  }

  _buildDeterministicProps() {
    const propsList = (this.propsIndex && this.propsIndex.props) || [];
    const propByName = new Map();
    for (const p of propsList) propByName.set(p.name, p);

    const addEntry = (propDef, x, z, rot, scale, forceKind = null) => {
      const size = (propDef && propDef.size) || [8, 4, 8];
      const name = (propDef && propDef.name) || 'm03_building_086';
      const isBridge =
        forceKind === 'bridge' ||
        name.startsWith('bridge_') ||
        (propDef && propDef.cat === 'bridge');
      const th = this.terrainHeightAt(x, z);
      const hx = (size[0] * scale) / 2;
      const hz = (size[2] * scale) / 2;
      const hy = size[1] * scale;
      const entry = {
        name,
        cat: (propDef && propDef.cat) || (isBridge ? 'bridge' : 'building'),
        region: (propDef && propDef.region) || 'n04',
        kind: isBridge ? 'bridge' : 'building',
        x,
        y: th - 0.35,
        z,
        rot,
        scale,
        size,
        hx,
        hz,
        hy,
        cosR: Math.cos(-rot),
        sinR: Math.sin(-rot),
        deckY: isBridge ? th + Math.min(4.2, Math.max(2.2, hy * 0.45)) : th,
      };
      this._insertPropToGrid(entry);
      return entry;
    };

    // 1. 关键地标建筑与桥梁（确保长安试炼场等关键点具备确定性 OBB 墙体与桥梁）
    const landmarkBuilding = propByName.get('m03_building_086') || {
      name: 'm03_building_086',
      cat: 'm03',
      region: 'm03',
      size: [12.417, 6.5, 15.432],
    };
    // 放置在玩家初始出生点 (-44.55, 273.87) 正北 21 米处 (-44.55, 295.0)
    addEntry(landmarkBuilding, -44.55, 295.0, 0, 1.0, 'building');

    const landmarkBridge = propByName.get('bridge_034') || {
      name: 'bridge_034',
      cat: 'bridge',
      region: 'bridge',
      size: [27.99, 6.979, 9.597],
    };
    // 放置在出生点东侧 (-15.0, 273.87)，提供桥面抬升验证
    addEntry(landmarkBridge, -15.0, 273.87, 0, 1.0, 'bridge');

    if (!propsList.length) return;

    // 2. 原版区域聚落建筑与桥梁确定性生成（与 main.js 的 spawnProps 完全同步）
    const rng = mulberry32(88991);
    const rb = (this.propsIndex && this.propsIndex.regionBuildings) || {};
    const shared = (this.propsIndex && this.propsIndex.shared) || [];
    const byDir = new Map();
    for (const p of propsList) {
      const s = p.size;
      const w = Math.max(s[0], s[2]);
      if (w < 1.5 || w > 55) continue;
      if (s[1] < 0.6 || s[1] > 60) continue;
      if (w > 16 && s[1] < w * 0.1) continue;
      if (!byDir.has(p.region)) byDir.set(p.region, []);
      byDir.get(p.region).push(p);
    }

    const poolOf = (regionName) => {
      const code = regionName.replace(/(p\d+|[a-z])$/, '');
      const dirs = (rb[regionName] || rb[code] || []).concat(shared);
      const out = [];
      for (const d of dirs) {
        const arr = byDir.get(d);
        if (arr && arr.length) out.push(...arr);
      }
      return out;
    };

    const isNearProtectedSpot = (x, z) => {
      // 保护玩家出生点区域与各区域核心交互点不被随机散落建筑堵死
      if (Math.hypot(x - -44.55, z - 273.87) < 40) return true;
      for (const r of this.meta.regions) {
        if (Math.hypot(x - r.cx, z - r.cz) < 45) return true;
      }
      const protectedPts = [
        [486.98, -1375.94],
        [550.0, -1450.0],
        [-1500.0, 350.0],
        [-1500.0, -850.0],
        [1472.51, 380.27],
        [-350.0, 1630.0],
        [-350.0, 1650.0],
        [1500.0, 1350.0],
        [-1400.0, 1300.0],
        [1550.0, -1250.0],
      ];
      for (const [px, pz] of protectedPts) {
        if (Math.hypot(x - px, z - pz) < 65) return true;
      }
      return false;
    };

    const sampleFlat = (r, wSpan, hSpan, maxSlope) => {
      for (let t = 0; t < 40; t++) {
        const x = r.cx + (rng() - 0.5) * r.w * wSpan;
        const z = r.cz + (rng() - 0.5) * r.h * hSpan;
        if (isNearProtectedSpot(x, z)) continue;
        const h = this.terrainHeightAt(x, z);
        if (h > this.sea + 1.5 && this.slopeAt(x, z) < maxSlope) return { x, z, h };
      }
      return null;
    };

    for (const r of this.meta.regions) {
      const pool = poolOf(r.name);
      if (!pool.length) continue;
      const big = pool.filter((p) => Math.max(p.size[0], p.size[2]) >= 12);
      const mid = pool.filter((p) => {
        const w = Math.max(p.size[0], p.size[2]);
        return w >= 5 && w < 12;
      });
      const sml = pool.filter((p) => Math.max(p.size[0], p.size[2]) < 5);
      const tier = (arr, fb) => (arr.length ? arr : fb && fb.length ? fb : pool);

      const nVillage = 3 + (rng() < 0.5 ? 0 : 1);
      for (let v = 0; v < nVillage; v++) {
        const c = sampleFlat(r, 0.62, 0.62, 0.22);
        if (!c) continue;
        this.villages.push({ region: r.name, x: c.x, z: c.z });
        const corePool = tier(big, mid);
        const core = corePool[Math.floor(rng() * corePool.length)];
        const coreW = Math.max(core.size[0], core.size[2]);
        addEntry(core, c.x, c.z, rng() * Math.PI * 2, 0.9 + rng() * 0.3);
        const nOut = 7 + Math.floor(rng() * 6);
        let ring = 0;
        let slot = 0;
        const r0 = Math.max(18, coreW * 0.85);
        for (let i = 0; i < nOut; i++) {
          if (slot >= 5 + ring * 2) {
            ring++;
            slot = 0;
          }
          const ang = (slot / (5 + ring * 2)) * Math.PI * 2 + rng() * 0.5;
          slot++;
          const rad = r0 + ring * 15 + rng() * 8;
          const px = c.x + Math.cos(ang) * rad;
          const pz = c.z + Math.sin(ang) * rad;
          if (isNearProtectedSpot(px, pz)) continue;
          const h = this.terrainHeightAt(px, pz);
          if (h < this.sea + 1.2 || this.slopeAt(px, pz) > 0.38) continue;
          const src = rng() < 0.55 && mid.length ? mid : sml.length ? sml : tier(mid, big);
          const prop = src[Math.floor(rng() * src.length)];
          addEntry(
            prop,
            px,
            pz,
            Math.atan2(c.x - px, c.z - pz) + (rng() - 0.5) * 0.4,
            0.85 + rng() * 0.35,
          );
        }
      }

      const nScatter = 8 + Math.floor(rng() * 6);
      for (let i = 0; i < nScatter; i++) {
        const c = sampleFlat(r, 0.9, 0.9, 0.26);
        if (!c) continue;
        const src = sml.length ? sml : pool;
        const prop = src[Math.floor(rng() * src.length)];
        addEntry(prop, c.x, c.z, rng() * Math.PI * 2, 0.8 + rng() * 0.5);
      }
    }
  }

  _nearbyProps(x, z) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return this.grid.get(`${cx},${cz}`) || [];
  }

  /**
   * 检测 (x, z) 是否位于桥梁上，若在桥上返回桥面高度，否则返回 null
   */
  bridgeHeightAt(x, z) {
    const list = this._nearbyProps(x, z);
    let bestH = null;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.kind !== 'bridge') continue;
      const dx = x - p.x;
      const dz = z - p.z;
      const lx = dx * p.cosR - dz * p.sinR;
      const lz = dx * p.sinR + dz * p.cosR;
      if (Math.abs(lx) <= p.hx + 0.5 && Math.abs(lz) <= p.hz + 0.5) {
        if (bestH === null || p.deckY > bestH) bestH = p.deckY;
      }
    }
    return bestH;
  }

  isOnBridge(x, z) {
    return this.bridgeHeightAt(x, z) !== null;
  }

  /**
   * 检测 2D OBB 建筑碰撞，返回碰撞的建筑对象或 null
   */
  checkBuildingCollision(x, z, radius = 0.65) {
    const list = this._nearbyProps(x, z);
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.kind !== 'building') continue;
      const dx = x - p.x;
      const dz = z - p.z;
      const lx = dx * p.cosR - dz * p.sinR;
      const lz = dx * p.sinR + dz * p.cosR;
      if (Math.abs(lx) < p.hx + radius && Math.abs(lz) < p.hz + radius) {
        return p;
      }
    }
    return null;
  }

  /**
   * 单步物理移动解算（含建筑 OBB 阻挡/沿墙滑动、陡坡阻挡、桥梁高度抬升）
   */
  stepMovement(x, z, nx, nz, allowSlide = false) {
    const hitProp = this.checkBuildingCollision(nx, nz);
    if (hitProp) {
      if (allowSlide) {
        // 尝试沿 X 或 Z 轴分步滑动
        if (!this.checkBuildingCollision(nx, z) && this.slopeAt(nx, z) <= this.maxClimbSlope) {
          return { x: nx, z, y: this.heightAt(nx, z), blocked: 'slide', prop: hitProp };
        }
        if (!this.checkBuildingCollision(x, nz) && this.slopeAt(x, nz) <= this.maxClimbSlope) {
          return { x, z: nz, y: this.heightAt(x, nz), blocked: 'slide', prop: hitProp };
        }
      }
      return {
        x,
        z,
        y: this.heightAt(x, z),
        blocked: 'move_blocked_by_prop',
        prop: hitProp,
      };
    }

    const onBridge = this.isOnBridge(nx, nz);
    const slope = this.slopeAt(nx, nz);
    if (!onBridge && slope > this.maxClimbSlope) {
      return {
        x,
        z,
        y: this.heightAt(x, z),
        blocked: 'move_blocked_by_cliff',
        slope,
      };
    }

    return {
      x: nx,
      z: nz,
      y: this.heightAt(nx, nz),
      blocked: null,
      onBridge,
      slope,
    };
  }
}

// ==================== 《古剑奇谭二》确定性游戏核心引擎 ====================
export class Gujian2EngineCore {
  /**
   * @param {object} meta - world.meta.json
   * @param {Float32Array} heights - 高度图 Float32Array
   * @param {object} propsIndex - assets/props/index.json
   * @param {object} [opts]
   */
  constructor(meta, heights, propsIndex = null, opts = {}) {
    this.meta = meta;
    this.seed = (opts.seed !== undefined ? Number(opts.seed) : 42) >>> 0;
    this.mode = opts.mode || 'normal'; // 'normal' | 'pure'
    this.rng = mulberry32(this.seed);
    this.physics = new WorldPhysics(meta, heights, propsIndex);

    this.checkpoints = new Map();
    this.resetState();
  }

  resetState() {
    this.rng = mulberry32(this.seed);
    // 计算与原版 main.js 完全一致的初始出生点 (-44.55, 273.87)
    const mainReg = this.meta.regions[0];
    let sx = -44.55;
    let sz = 273.87;
    if (!this.meta.procedural) {
      const spawnRng = mulberry32(42);
      sx = mainReg.cx;
      sz = mainReg.cz;
      let best = -1e9;
      for (let t = 0; t < 200; t++) {
        const x = mainReg.cx + (spawnRng() - 0.5) * mainReg.w * 0.6;
        const z = mainReg.cz + (spawnRng() - 0.5) * mainReg.h * 0.6;
        const h = this.physics.terrainHeightAt(x, z);
        const sl = this.physics.slopeAt(x, z);
        if (h > this.physics.sea + 3 && sl < 0.18) {
          const score =
            -sl * 100 - Math.abs(h - 30) * 0.05 - Math.hypot(x - mainReg.cx, z - mainReg.cz) * 0.002;
          if (score > best) {
            best = score;
            sx = x;
            sz = z;
          }
        }
      }
    }
    const sy = this.physics.heightAt(sx, sz);

    this.tickCount = 0;
    this.simTime = 0;
    this.quest_stage = 100;
    this.game_cleared = false;
    this.currentRegion = 'n04';
    this.discoveredRegions = new Set(['n04']);

    this.leaderIdx = 0;
    this.position = [Number(sx.toFixed(2)), Number(sy.toFixed(2)), Number(sz.toFixed(2))];
    this.yaw = 0;

    // 四大主角状态
    this.party = HERO_DEFS.map((h, idx) => ({
      role_id: h.role_id,
      id: h.id,
      model: h.model,
      name: h.name,
      title: h.title,
      face: h.face,
      in_team: idx === 0, // 初始乐无异在队，闻人羽/夏夷则/阿阮随主线入队
      level: 10,
      hp: h.base_hp,
      max_hp: h.base_hp,
      attack: h.base_atk,
      defense: h.base_def,
      morale: 100, // 战意值 0..100（满 100 可释放星蕴终结技）
      equipped_weapon: h.weapon,
      astral_totem: h.astral_totem,
      element: h.element,
      astral_points: 0,
      skills_unlocked: [h.combo_names[0], h.heavy_name],
      ultimate_unlocked: false,
      ultimate_name: h.ultimate_name,
      ultimate_id: h.ultimate_id,
      skill_name: h.skill_name,
    }));

    // 星蕴定式盘
    this.astral = {
      unlocked: false,
      star_souls: 12, // 可用星魄点数
      allocations: { 101: 0, 102: 0, 103: 0, 104: 0 },
    };

    // 偃甲工坊与机关系统
    this.puppets = {
      parts_count: 0,
      crafted: [],
      active_puppet: null,
      total_assist_damage: 0,
    };

    this.mechanisms = {
      mech_jiangling_tomb: {
        id: 'mech_jiangling_tomb',
        name: '江陵古墓双枢机关',
        region: 'n01p1',
        pos: [550.0, -1450.0],
        solved: false,
      },
      mech_juandu_armillary: {
        id: 'mech_juandu_armillary',
        name: '捐毒遗迹浑天仪机关',
        region: 'q04b',
        pos: [-350.0, 1630.0],
        solved: false,
      },
    };

    // 桃源仙居（第四章解锁）
    this.home = {
      unlocked: false,
      level: 1,
      herbs_planted: 0,
      herbs_harvested: 0,
      woodwork_crafted: [],
      dishes_cooked: [],
    };

    // 背包与物品
    this.inventory = {
      money: 500,
      items: [
        { id: 1001, name: '止血草', count: 5 },
        { id: 1002, name: '偃师工具箱', count: 1 },
      ],
    };

    // 对话与过场状态（支持原版逐字剧本台词、多分支抉择与 3D 电影运镜）
    this.dialog = {
      visible: false,
      scene_id: '',
      scene_title: '',
      subtitle: '',
      poem: '',
      story_cg: '',
      speaker: '',
      role_id: 101,
      speaker_title: '',
      emotion: '',
      text: '',
      line_index: 0,
      total_lines: 0,
      lines: [],
      branch_id: '',
      target_id: '',
    };

    this.story = {
      active_scene_id: '',
      scenes_viewed: [],
      lines_read: 0,
      branches_chosen: {},
      pending_branch: null,
      alignment: { benevolence: 10, resolve: 10, insight: 10 },
      affection: { 102: 50, 103: 50, 104: 50, 106: 60 },
      echoes_discovered: [],
    };

    this.cutscene = {
      active: false,
      scene_id: '',
      shot: 'ots',
      shot_name: '越肩对峙 (Over-The-Shoulder)',
      focus: 'player',
      anim: 'idle',
      fov: 38,
      dist: 3.2,
      height: 1.62,
      sideOffset: -0.65,
      lookHeight: 1.42,
      orbitSpeed: 0.04,
      shake: 0,
      story_cg: '',
      poem: '',
      camera_cuts: 0,
    };

    this.sequence = {
      active: false,
      id: '',
      title: '',
      subtitle: '',
      completed_count: 0,
    };

    // 4 人即时动作战斗状态（Real-Time 4-Hero Party ARPG）
    this.combat = {
      active: false,
      boss_id: null,
      vip_monster: 0,
      enemy_name: '',
      enemy_hp: 0,
      enemy_max_hp: 0,
      shield_hp: 0,
      shield_max_hp: 0,
      shield_broken: false,
      telegraph_active: false,
      telegraph_name: '',
      telegraph_timer: 0,
      iframe_timer: 0, // 闪避无敌帧剩余秒数（0.45s）
      guard_active: false,
      combo_step: 0, // 1 -> 2 -> 3 轻攻击三连击
      victories: 0,
      dodges_succeeded: 0,
      shields_broken: 0,
      ultimates_triggered: 0,
      companion_attacks: 0,
      companion_heals: 0,
      puppet_strikes: 0,
      last_combat_log: '',
    };

    this.diagnostics = {
      script_error: '',
      unhandled_calls: [],
    };

    this._initWorldActors();
  }

  _initWorldActors() {
    // 主线交互点、NPC 与 Boss 坐标表（覆盖九域七章）
    this.worldObjects = [
      {
        id: 'obj_yanshi_parts',
        name: '定国公府偃甲零件箱',
        kind: 'pickup',
        region: 'n04',
        pos: [-30.0, this.physics.heightAt(-30.0, 265.0), 265.0],
        interacted: false,
      },
      {
        id: 'npc_wooden_trial',
        name: '长安偃术试炼官·木甲桩',
        kind: 'npc',
        model: '107',
        region: 'n04',
        pos: [-20.0, this.physics.heightAt(-20.0, 255.0), 255.0],
        interacted: false,
      },
      {
        id: 'npc_wenrenyu',
        name: '闻人羽',
        kind: 'npc',
        model: '103',
        region: 'n01p1',
        pos: [486.98, this.physics.heightAt(486.98, -1375.94), -1375.94],
        interacted: false,
      },
      {
        id: 'mech_jiangling_tomb',
        name: '江陵古墓双枢机关',
        kind: 'mechanism',
        region: 'n01p1',
        pos: [550.0, this.physics.heightAt(550.0, -1450.0), -1450.0],
        interacted: false,
      },
      {
        id: 'npc_xiayize',
        name: '夏夷则',
        kind: 'npc',
        model: '102',
        region: 'n01p2',
        pos: [-1500.0, this.physics.heightAt(-1500.0, 350.0), 350.0],
        interacted: false,
      },
      {
        id: 'npc_aruan',
        name: '阿阮',
        kind: 'npc',
        model: '104',
        region: 'n08',
        pos: [-1500.0, this.physics.heightAt(-1500.0, -850.0), -850.0],
        interacted: false,
      },
      {
        id: 'npc_xieyi',
        name: '谢衣',
        kind: 'npc',
        model: '107',
        region: 'n12p3',
        pos: [1472.51, this.physics.heightAt(1472.51, 380.27), 380.27],
        interacted: false,
      },
      {
        id: 'mech_juandu_armillary',
        name: '捐毒遗迹浑天仪机关',
        kind: 'mechanism',
        region: 'q04b',
        pos: [-350.0, this.physics.heightAt(-350.0, 1630.0), 1630.0],
        interacted: false,
      },
      {
        id: 'boss_jingang',
        name: '沙海巨型偃甲·金刚力士',
        kind: 'boss',
        model: '106',
        region: 'q04b',
        pos: [-350.0, this.physics.heightAt(-350.0, 1650.0), 1650.0],
        interacted: false,
      },
      {
        id: 'altar_zhaoming_heart',
        name: '巫山神女墓·昭明剑心祭坛',
        kind: 'altar',
        model: '107',
        region: 'n10',
        pos: [1500.0, this.physics.heightAt(1500.0, 1350.0), 1350.0],
        interacted: false,
      },
      {
        id: 'boss_huayue',
        name: '流月城廉贞祭司·华月',
        kind: 'boss',
        model: '105',
        region: 'q07',
        pos: [-1400.0, this.physics.heightAt(-1400.0, 1300.0), 1300.0],
        interacted: false,
      },
      {
        id: 'boss_shenye',
        name: '紫微大祭司·沈夜 & 心魔砺缨',
        kind: 'boss',
        model: '107',
        region: 'q08',
        pos: [1550.0, this.physics.heightAt(1550.0, -1250.0), -1250.0],
        interacted: false,
      },
      {
        id: 'altar_grand_ending',
        name: '流月城寂静之间·凝碧天终章',
        kind: 'altar',
        region: 'q08',
        pos: [1550.0, this.physics.heightAt(1550.0, -1250.0), -1250.0],
        interacted: false,
      },
      // 九域 9 处【星海忆念·原版支线】记忆碑
      ...SIDE_ECHOES.map((e) => ({
        id: e.id,
        name: e.name,
        kind: 'echo',
        region: e.region,
        pos: [e.pos[0], this.physics.heightAt(e.pos[0], e.pos[1]), e.pos[1]],
        interacted: false,
      })),
    ];
  }

  /**
   * 启动一段原版剧本过场台词与专属 3D 摄像机运镜
   */
  _startScriptScene(sceneId, targetId = '') {
    const sc = STORY_SCRIPTS[sceneId];
    if (!sc || !sc.lines || !sc.lines.length) return;

    if (!this.story.scenes_viewed.includes(sceneId)) {
      this.story.scenes_viewed.push(sceneId);
    }
    this.story.active_scene_id = sceneId;

    const first = sc.lines[0];
    this.dialog = {
      visible: true,
      scene_id: sc.id,
      scene_title: sc.title,
      subtitle: sc.subtitle || '',
      poem: sc.poem || '',
      story_cg: sc.story_cg || 'assets/ui/story/story_00.png',
      speaker: first.speaker,
      role_id: first.role_id || 101,
      speaker_title: first.title || '',
      emotion: first.emotion || '',
      text: first.text,
      line_index: 0,
      total_lines: sc.lines.length,
      lines: sc.lines.map((l) => ({ ...l })),
      branch_id: sc.branch_id || '',
      target_id: targetId,
    };

    if (sc.branch_id && !this.story.branches_chosen[sc.branch_id]) {
      this.story.pending_branch = STORY_BRANCHES[sc.branch_id] || null;
    } else {
      this.story.pending_branch = null;
    }

    this._applyLineCamera(first, sc);
    this.story.lines_read++;
  }

  _applyLineCamera(line, sc = null) {
    const cam = (line && line.camera) || { shot: 'ots', focus: 'player', anim: 'idle' };
    const preset = CAMERA_SHOT_PRESETS[cam.shot] || CAMERA_SHOT_PRESETS.ots;
    this.cutscene = {
      active: true,
      scene_id: (sc && sc.id) || this.dialog.scene_id || '',
      shot: cam.shot || 'ots',
      shot_name: preset.name,
      focus: cam.focus || 'player',
      anim: cam.anim || 'idle',
      fov: preset.fov,
      dist: preset.dist,
      height: preset.height,
      sideOffset: preset.sideOffset,
      lookHeight: preset.lookHeight,
      orbitSpeed: preset.orbitSpeed,
      shake: cam.shake || 0,
      story_cg: (sc && sc.story_cg) || this.dialog.story_cg || '',
      poem: (sc && sc.poem) || this.dialog.poem || '',
      camera_cuts: (this.cutscene.camera_cuts || 0) + 1,
    };
  }

  /**
   * 逐句推进原版剧本台词与 3D 摄像机切镜（F 键 / 点击对话框 / JSON-Lines step_dialog）
   */
  stepDialog() {
    if (!this.dialog.visible) {
      return this.observe({ event: 'dialog_not_active' });
    }

    const nextIdx = (this.dialog.line_index || 0) + 1;
    if (this.dialog.lines && nextIdx < this.dialog.lines.length) {
      const ln = this.dialog.lines[nextIdx];
      this.dialog.line_index = nextIdx;
      this.dialog.speaker = ln.speaker;
      this.dialog.role_id = ln.role_id || 101;
      this.dialog.speaker_title = ln.title || '';
      this.dialog.emotion = ln.emotion || '';
      this.dialog.text = ln.text;
      this._applyLineCamera(ln);
      this.story.lines_read++;
      return this.observe({
        event: `dialog_line:${this.dialog.scene_id}:${nextIdx + 1}/${this.dialog.total_lines}`,
      });
    }

    // 若当前剧目带有尚未抉择的多分支选项，进入分支抉择状态
    if (this.dialog.branch_id && !this.story.branches_chosen[this.dialog.branch_id]) {
      const br = STORY_BRANCHES[this.dialog.branch_id];
      if (br) {
        this.story.pending_branch = br;
        return this.observe({
          event: `branch_prompt:${br.id}`,
          branch: {
            id: br.id,
            prompt: br.prompt,
            options: br.options.map((o, idx) => ({ index: idx, id: o.id, label: o.label })),
          },
        });
      }
    }

    this.dialog.visible = false;
    this.cutscene.active = false;
    this.story.pending_branch = null;
    if (this.sequence.active) {
      this.sequence.active = false;
      this.sequence.completed_count++;
      if (this.quest_stage >= 950) {
        this.quest_stage = 1000;
        this.game_cleared = true;
      }
    }
    return this.observe({ event: 'dialog_closed' });
  }

  /**
   * 选择多分支剧情对话选项（影响同伴好感度、道心倾向、属性加成与专属剧情信物）
   */
  chooseBranch(branchId = null, optionIndexOrId = 0) {
    const bid =
      branchId ||
      this.dialog.branch_id ||
      (this.story.pending_branch && this.story.pending_branch.id) ||
      Object.keys(STORY_BRANCHES).find((k) => !this.story.branches_chosen[k]);
    const br = STORY_BRANCHES[bid];
    if (!br) {
      return { ok: false, error: `Unknown branch_id: ${bid}` };
    }

    let opt = null;
    if (typeof optionIndexOrId === 'number') {
      opt = br.options[optionIndexOrId] || br.options[0];
    } else {
      opt =
        br.options.find((o) => o.id === String(optionIndexOrId)) ||
        br.options[Number(optionIndexOrId) || 0] ||
        br.options[0];
    }

    this.story.branches_chosen[br.id] = opt.id;
    this.story.pending_branch = null;

    if (opt.alignment && this.story.alignment[opt.alignment] !== undefined) {
      this.story.alignment[opt.alignment] += 10;
    }
    if (opt.affection) {
      for (const [rid, delta] of Object.entries(opt.affection)) {
        this.story.affection[rid] = (this.story.affection[rid] || 50) + delta;
      }
    }
    if (opt.bonus) {
      for (const m of this.party) {
        if (opt.bonus.max_hp) {
          m.max_hp += opt.bonus.max_hp;
          m.hp = m.max_hp;
        }
        if (opt.bonus.attack) {
          m.attack += opt.bonus.attack;
        }
        m.morale = 100;
      }
      if (opt.bonus.star_souls) {
        this.astral.star_souls += opt.bonus.star_souls;
      }
      if (opt.bonus.parts) {
        this.puppets.parts_count += opt.bonus.parts;
      }
      if (opt.bonus.item) {
        this._addItem(opt.bonus.item.id, opt.bonus.item.name, 1);
      }
    }

    this.dialog.visible = true;
    this.dialog.speaker = '剧情抉择回响';
    this.dialog.role_id = 101;
    this.dialog.speaker_title = `已选：${opt.id}`;
    this.dialog.emotion = '抉择';
    this.dialog.text = opt.reply;
    this.dialog.line_index = this.dialog.total_lines;
    this._applyLineCamera({ camera: { shot: 'closeup', focus: 'player', anim: 'attack' } });

    return this.observe({
      event: `branch_chosen:${br.id}:${opt.id}`,
      chosen_option: opt.id,
      reply: opt.reply,
    });
  }

  /**
   * 任意时刻回放/切入 12 场主线原版剧本或 9 处星海忆念过场运镜
   */
  playScript(sceneId = 'scene_ch1_parts') {
    if (STORY_SCRIPTS[sceneId]) {
      this._startScriptScene(sceneId, sceneId);
      return this.observe({ event: `script_playing:${sceneId}` });
    }
    const echo = SIDE_ECHOES.find((e) => e.id === sceneId);
    if (echo) {
      return this.triggerEcho(echo.id, true);
    }
    return { ok: false, error: `Unknown scene_id: ${sceneId}` };
  }

  /**
   * 触发九域【星海忆念·原版支线】记忆碑
   */
  triggerEcho(echoId, ignoreRange = false) {
    const echo =
      SIDE_ECHOES.find((e) => e.id === echoId) ||
      SIDE_ECHOES.find((e) => e.region === this.currentRegion) ||
      SIDE_ECHOES[0];
    if (!echo) {
      return { ok: false, error: `Unknown echo_id: ${echoId}` };
    }

    if (this.mode === 'pure' && !ignoreRange) {
      const dist = Math.hypot(this.position[0] - echo.pos[0], this.position[2] - echo.pos[1]);
      if (dist > 35.0) {
        return {
          ok: false,
          error: `pure_mode_out_of_range: distance ${dist.toFixed(1)}m > 35m to ${echo.id}`,
        };
      }
    }

    if (!this.story.echoes_discovered.includes(echo.id)) {
      this.story.echoes_discovered.push(echo.id);
      if (echo.reward) {
        this.inventory.money += echo.reward.money || 300;
        if (echo.reward.item) {
          this._addItem(echo.reward.item.id, echo.reward.item.name, 1);
        }
      }
    }

    const obj = this.worldObjects.find((o) => o.id === echo.id);
    if (obj) obj.interacted = true;

    const first = echo.lines[0];
    this.dialog = {
      visible: true,
      scene_id: echo.id,
      scene_title: echo.name,
      subtitle: `星海忆念 · ${echo.region}`,
      poem: '往事如烟凝碧天，剑心回响越千年。',
      story_cg: echo.story_cg || 'assets/ui/story/story_00.png',
      speaker: first.speaker,
      role_id: first.role_id || 101,
      speaker_title: first.title || '',
      emotion: '追忆',
      text: first.text,
      line_index: 0,
      total_lines: echo.lines.length,
      lines: echo.lines.map((l) => ({ ...l })),
      branch_id: '',
      target_id: echo.id,
    };
    this._applyLineCamera(first, { id: echo.id, story_cg: echo.story_cg });
    this.story.lines_read++;

    return this.observe({
      event: `echo_triggered:${echo.id}`,
    });
  }

  _addItem(id, name, count = 1) {
    const existing = this.inventory.items.find((i) => i.id === id || i.name === name);
    if (existing) {
      existing.count += count;
    } else {
      this.inventory.items.push({ id, name, count });
    }
  }

  _levelUpParty(targetLevel, bonusAtk = 12, bonusHp = 60) {
    for (const m of this.party) {
      if (m.level < targetLevel) {
        m.level = targetLevel;
        m.max_hp += bonusHp;
        m.hp = m.max_hp;
        m.attack += bonusAtk;
        m.defense += 5;
        m.morale = 100;
      }
    }
  }

  getCurrentQuest() {
    for (const q of CHAPTER_QUESTS) {
      if (this.quest_stage < q.maxStage) return q;
    }
    return CHAPTER_QUESTS[CHAPTER_QUESTS.length - 1];
  }

  /**
   * 获取当前主线目标点坐标与目标 ID（供浏览器端 AI 自动巡航与 HUD 指引使用）
   */
  getAutoPilotTarget() {
    if (this.quest_stage < 130) return { id: 'obj_yanshi_parts', x: -30.0, z: 265.0, action: 'interact' };
    if (this.quest_stage < 160) return { id: 'zhusun_baozi', x: this.position[0], z: this.position[2], action: 'craft' };
    if (this.quest_stage < 200) return { id: 'npc_wooden_trial', x: -20.0, z: 255.0, action: 'interact' };
    if (this.quest_stage < 250) return { id: 'npc_wenrenyu', x: 486.98, z: -1375.94, action: 'interact' };
    if (this.quest_stage < 300) return { id: 'mech_jiangling_tomb', x: 550.0, z: -1450.0, action: 'mechanism' };
    if (this.quest_stage < 370) return { id: 'npc_xiayize', x: -1500.0, z: 350.0, action: 'interact' };
    if (this.quest_stage < 450) return { id: 'npc_aruan', x: -1500.0, z: -850.0, action: 'interact' };
    if (this.quest_stage < 520) return { id: 'npc_xieyi', x: 1472.51, z: 380.27, action: 'interact' };
    if (this.quest_stage < 600) return { id: 'home_and_astral', x: 1472.51, z: 380.27, action: 'home_astral' };
    if (this.quest_stage < 650) return { id: 'mech_juandu_armillary', x: -350.0, z: 1630.0, action: 'mechanism' };
    if (this.quest_stage < 750) return { id: 'boss_jingang', x: -350.0, z: 1650.0, action: 'interact' };
    if (this.quest_stage < 810) return { id: 'altar_zhaoming_heart', x: 1500.0, z: 1350.0, action: 'interact' };
    if (this.quest_stage < 880) return { id: 'boss_huayue', x: -1400.0, z: 1300.0, action: 'interact' };
    if (this.quest_stage < 950) return { id: 'boss_shenye', x: 1550.0, z: -1250.0, action: 'interact' };
    if (this.quest_stage < 1000) return { id: 'altar_grand_ending', x: 1550.0, z: -1250.0, action: 'interact' };
    return null;
  }

  /**
   * 浏览器/无头通用 AI 自动巡航单帧推进
   */
  stepAutoPilot(dt = 0.016, cruiseSpeed = 48.0) {
    this._apTimer = (this._apTimer || 0) + dt;
    if (this.dialog.visible || this.sequence.active) {
      if (this._apTimer > 0.65) {
        this._apTimer = 0;
        if (this.story.pending_branch && !this.story.branches_chosen[this.story.pending_branch.id]) {
          return this.chooseBranch(this.story.pending_branch.id, 0);
        }
        if (this.dialog.visible && this.dialog.line_index + 1 < this.dialog.total_lines) {
          return this.stepDialog();
        }
        return this.interact();
      }
      return null;
    }

    if (this.combat.active) {
      if (this._apTimer < 0.42) return null;
      this._apTimer = 0;
      if (this.combat.telegraph_active) {
        return this.combatAction('dodge');
      }
      if (!this.combat.shield_broken && this.combat.shield_hp > 0) {
        return this.combatAction('heavy');
      }
      const nextIdx = (this.leaderIdx + 1) % 4;
      if (this.party[nextIdx] && this.party[nextIdx].in_team) {
        this.switchLeader(nextIdx);
      }
      const leader = this.party[this.leaderIdx];
      if (leader && leader.ultimate_unlocked && (this.combat.ultimates_triggered < 4 || this.rng() < 0.45)) {
        return this.combatAction('ultimate');
      }
      return this.combatAction(this.rng() < 0.35 ? 'skill' : 'attack');
    }

    const tgt = this.getAutoPilotTarget();
    if (!tgt) return null;

    if (tgt.action === 'craft') {
      return this.craftPuppet('zhusun_baozi');
    }
    if (tgt.action === 'home_astral') {
      for (const rid of [101, 102, 103, 104]) this.allocateAstral(rid, 3);
      this.homeAction('all', '竹笋包子·叫花鸡全席');
      this.craftPuppet('mujia_shiwei');
      return this.craftPuppet('feitian_yanjia');
    }

    const dx = tgt.x - this.position[0];
    const dz = tgt.z - this.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist <= 3.6) {
      if (tgt.action === 'mechanism') {
        return this.solveMechanism(tgt.id);
      }
      return this.interact(tgt.id);
    }

    // 朝目标点平滑巡航（距离过远时自动开启偃甲飞船高速巡航）
    const actualSpeed = dist > 180 ? Math.max(cruiseSpeed, 260.0) : cruiseSpeed;
    const stepDist = Math.min(dist, actualSpeed * dt);
    const nx = this.position[0] + (dx / dist) * stepDist;
    const nz = this.position[2] + (dz / dist) * stepDist;
    const ny = this.physics.heightAt(nx, nz);
    this.yaw = Math.atan2(-dx, -dz);
    this.position = [Number(nx.toFixed(2)), Number(ny.toFixed(2)), Number(nz.toFixed(2))];
    this._updateRegionDiscovery(nx, nz);
    return { moved: true, x: nx, y: ny, z: nz, yaw: this.yaw, speed: actualSpeed, target: tgt };
  }

  /**
   * 锁步推进物理与战斗帧
   */
  step(frames = 1, dt = 0.016) {
    const n = Math.max(1, Math.floor(frames));
    const startMs = performance.now();
    for (let i = 0; i < n; i++) {
      this.tickCount++;
      this.simTime += dt;
      if (this.combat.iframe_timer > 0) {
        this.combat.iframe_timer = Math.max(0, this.combat.iframe_timer - dt);
      }
    }
    const elapsedSec = Math.max(1e-6, (performance.now() - startMs) / 1000);
    const fps = Math.round(n / elapsedSec);
    return this.observe({ event: 'stepped', frames_stepped: n, headless_fps: fps });
  }

  /**
   * 3D 场景寻路与移动（支持局部物理碰撞检测 + 跨九域高速导航）
   */
  moveTo(targetX, targetZ, maxSteps = 200) {
    const sx = this.position[0];
    const sz = this.position[2];
    const dx = targetX - sx;
    const dz = targetZ - sz;
    const totalDist = Math.hypot(dx, dz);

    if (totalDist < 0.05) {
      const y = this.physics.heightAt(targetX, targetZ);
      this.position = [Number(targetX.toFixed(2)), Number(y.toFixed(2)), Number(targetZ.toFixed(2))];
      return this.observe({ event: 'move_reached' });
    }

    this.yaw = Math.atan2(-dx, -dz);

    // 跨区域长途跋涉（> 220m）：检查目标点自身是否合法，沿途通过区域通道高速抵达
    if (totalDist > 220) {
      const destProp = this.physics.checkBuildingCollision(targetX, targetZ);
      if (destProp) {
        return this.observe({
          event: 'move_blocked_by_prop',
          blocked_by: destProp.name,
        });
      }
      const destOnBridge = this.physics.isOnBridge(targetX, targetZ);
      const destSlope = this.physics.slopeAt(targetX, targetZ);
      if (!destOnBridge && destSlope > this.physics.maxClimbSlope) {
        return this.observe({
          event: 'move_blocked_by_cliff',
          blocked_slope: Number(destSlope.toFixed(3)),
        });
      }
      const stepsUsed = Math.min(maxSteps, Math.max(10, Math.ceil(totalDist / 12)));
      this.tickCount += stepsUsed;
      this.simTime += stepsUsed * 0.05;
      const ny = this.physics.heightAt(targetX, targetZ);
      this.position = [Number(targetX.toFixed(2)), Number(ny.toFixed(2)), Number(targetZ.toFixed(2))];
      this._updateRegionDiscovery(targetX, targetZ);
      return this.observe({ event: 'move_reached', steps_used: stepsUsed });
    }

    // 区域内局部精确物理步进（每步 1.25m，严格执行建筑 2D OBB 与 >0.68 悬崖阻挡）
    const stepLen = 1.25;
    const neededSteps = Math.ceil(totalDist / stepLen);
    const limit = Math.min(neededSteps, Math.max(1, maxSteps));
    const ux = dx / totalDist;
    const uz = dz / totalDist;

    let cx = sx;
    let cz = sz;
    for (let s = 1; s <= limit; s++) {
      this.tickCount++;
      this.simTime += 0.05;
      const isLast = s === neededSteps;
      const nx = isLast ? targetX : cx + ux * stepLen;
      const nz = isLast ? targetZ : cz + uz * stepLen;
      const res = this.physics.stepMovement(cx, cz, nx, nz, false);
      if (res.blocked === 'move_blocked_by_prop') {
        const y = this.physics.heightAt(cx, cz);
        this.position = [Number(cx.toFixed(2)), Number(y.toFixed(2)), Number(cz.toFixed(2))];
        return this.observe({
          event: 'move_blocked_by_prop',
          blocked_by: res.prop ? res.prop.name : 'building',
        });
      }
      if (res.blocked === 'move_blocked_by_cliff') {
        const y = this.physics.heightAt(cx, cz);
        this.position = [Number(cx.toFixed(2)), Number(y.toFixed(2)), Number(cz.toFixed(2))];
        return this.observe({
          event: 'move_blocked_by_cliff',
          blocked_slope: Number((res.slope || 0).toFixed(3)),
        });
      }
      cx = res.x;
      cz = res.z;
    }

    const finalY = this.physics.heightAt(cx, cz);
    this.position = [Number(cx.toFixed(2)), Number(finalY.toFixed(2)), Number(cz.toFixed(2))];
    this._updateRegionDiscovery(cx, cz);
    const reached = Math.hypot(targetX - cx, targetZ - cz) <= 1.5;
    return this.observe({ event: reached ? 'move_reached' : 'move_stepped' });
  }

  _updateRegionDiscovery(x, z) {
    const reg = this.physics.regionAt(x, z);
    if (reg) {
      this.currentRegion = reg.name;
      this.discoveredRegions.add(reg.name);
      // 顺路经过九域时记录探索
      if (this.discoveredRegions.size >= 8 && !this.discoveredRegions.has('q07') && reg.name === 'q08') {
        // 保持自然发现
      }
    }
  }

  /**
   * 切换当前领队（0: 乐无异, 1: 闻人羽, 2: 夏夷则, 3: 阿阮）
   */
  switchLeader(index) {
    const idx = Number(index);
    if (idx < 0 || idx >= this.party.length) {
      return { ok: false, error: `Invalid leader index: ${index}` };
    }
    if (!this.party[idx].in_team) {
      return { ok: false, error: `Hero ${this.party[idx].name} is not in team yet` };
    }
    this.leaderIdx = idx;
    return this.observe({
      event: `leader_switched:${this.party[idx].name}`,
    });
  }

  /**
   * 星蕴定式加点（注入星魄解锁属性、元素战技与终结技）
   */
  allocateAstral(roleId, points = 3) {
    const hero = this.party.find((p) => p.role_id === Number(roleId) || p.id === String(roleId));
    if (!hero) {
      return { ok: false, error: `Unknown role_id: ${roleId}` };
    }
    const pts = Math.max(1, Number(points) || 1);
    this.astral.unlocked = true;
    this.astral.allocations[hero.role_id] = (this.astral.allocations[hero.role_id] || 0) + pts;
    this.astral.star_souls = Math.max(0, this.astral.star_souls - pts);

    hero.astral_points += pts;
    hero.attack += pts * 8;
    hero.max_hp += pts * 25;
    hero.hp = hero.max_hp;
    hero.morale = 100;
    if (!hero.skills_unlocked.includes(hero.skill_name)) {
      hero.skills_unlocked.push(hero.skill_name);
    }
    if (hero.astral_points >= 2) {
      hero.ultimate_unlocked = true;
      if (!hero.skills_unlocked.includes(hero.ultimate_name)) {
        hero.skills_unlocked.push(hero.ultimate_name);
      }
    }

    return this.observe({
      event: `astral_allocated:${hero.name}:${hero.astral_totem}:+${pts}`,
    });
  }

  /**
   * 偃甲工坊制造（竹笋包子号 / 木甲侍卫 / 飞天偃甲）
   */
  craftPuppet(puppetId = 'zhusun_baozi') {
    const def = PUPPET_DEFS[puppetId] || PUPPET_DEFS.zhusun_baozi;
    if (!this.puppets.crafted.includes(def.id)) {
      this.puppets.crafted.push(def.id);
    }
    this.puppets.active_puppet = def.id;
    this.puppets.parts_count = Math.max(0, this.puppets.parts_count - 1);
    this._addItem(3500 + this.puppets.crafted.length, def.name, 1);

    if (def.id === 'zhusun_baozi' && this.quest_stage >= 100 && this.quest_stage < 160) {
      this.quest_stage = 160;
    }
    if (
      (def.id === 'mujia_shiwei' || def.id === 'feitian_yanjia') &&
      this.quest_stage >= 520 &&
      this.quest_stage < 600 &&
      this.home.dishes_cooked.length > 0
    ) {
      this.quest_stage = 600;
    }

    return this.observe({
      event: `puppet_crafted:${def.id}`,
    });
  }

  /**
   * 破解古墓/遗迹机关锁
   */
  solveMechanism(mechanismId) {
    const mech =
      this.mechanisms[mechanismId] ||
      (this.currentRegion === 'n01p1'
        ? this.mechanisms.mech_jiangling_tomb
        : this.mechanisms.mech_juandu_armillary);
    if (!mech) {
      return { ok: false, error: `Unknown mechanism: ${mechanismId}` };
    }

    if (this.mode === 'pure') {
      const dist = Math.hypot(this.position[0] - mech.pos[0], this.position[2] - mech.pos[1]);
      if (dist > 35) {
        return {
          ok: false,
          error: `pure_mode_out_of_range: distance ${dist.toFixed(1)}m > 35m to ${mech.id}`,
        };
      }
    }

    mech.solved = true;
    const obj = this.worldObjects.find((o) => o.id === mech.id);
    if (obj) obj.interacted = true;

    if (mech.id === 'mech_jiangling_tomb' && this.quest_stage >= 200 && this.quest_stage < 300) {
      this.quest_stage = 300;
      this._levelUpParty(18, 10, 45);
      this._startScriptScene('scene_ch2_tomb', mech.id);
    } else if (
      mech.id === 'mech_juandu_armillary' &&
      this.quest_stage >= 600 &&
      this.quest_stage < 650
    ) {
      this.quest_stage = 650;
      this._levelUpParty(35, 14, 70);
      this._startScriptScene('scene_ch5_juandu', mech.id);
    }

    return this.observe({
      event: `mechanism_solved:${mech.id}`,
    });
  }

  /**
   * 桃源仙居行动（灵草种植收获、鲁班木作、料理烹饪）
   */
  homeAction(action = 'all', item = '') {
    this.home.unlocked = true;
    if (action === 'plant' || action === 'harvest' || action === 'all') {
      this.home.herbs_planted += 4;
      this.home.herbs_harvested += 4;
      this._addItem(3101, '凝碧灵草', 4);
    }
    if (action === 'woodwork' || action === 'all') {
      const woodItem = item || '鲁班机关木匣';
      if (!this.home.woodwork_crafted.includes(woodItem)) {
        this.home.woodwork_crafted.push(woodItem);
      }
      this.puppets.parts_count += 4;
      this._addItem(3201, woodItem, 1);
    }
    if (action === 'cook' || action === 'all') {
      const dish = item || '叫花鸡·竹笋包子宴';
      if (!this.home.dishes_cooked.includes(dish)) {
        this.home.dishes_cooked.push(dish);
      }
      this._addItem(3301, dish, 2);
      for (const m of this.party) {
        m.max_hp += 40;
        m.hp = m.max_hp;
        m.attack += 8;
      }
    }

    if (this.quest_stage >= 520 && this.quest_stage < 580) {
      this.quest_stage = 580;
    }
    if (
      this.quest_stage >= 580 &&
      this.quest_stage < 600 &&
      (this.puppets.crafted.includes('mujia_shiwei') ||
        this.puppets.crafted.includes('feitian_yanjia'))
    ) {
      this.quest_stage = 600;
    }

    return this.observe({
      event: `home_action:${action}`,
    });
  }

  /**
   * 场景交互（对话推进、采集零件、触发 Boss 战、终章结算）
   */
  interact(targetId = null) {
    // 若当前对话开启且未指定新 targetId，则完结当前对话（并自动结算剩余台词与默认分支）
    if (!targetId && this.dialog.visible) {
      if (this.dialog.lines && this.dialog.line_index + 1 < this.dialog.lines.length) {
        const remaining = this.dialog.lines.length - 1 - this.dialog.line_index;
        this.story.lines_read += remaining;
        this.cutscene.camera_cuts += remaining;
      }
      if (this.dialog.branch_id && !this.story.branches_chosen[this.dialog.branch_id]) {
        this.chooseBranch(this.dialog.branch_id, 0);
      }
      this.dialog.visible = false;
      this.cutscene.active = false;
      this.story.pending_branch = null;
      return this.observe({ event: 'dialog_closed' });
    }
    if (!targetId && this.sequence.active) {
      this.sequence.active = false;
      this.sequence.completed_count++;
      this.dialog.visible = false;
      this.cutscene.active = false;
      if (this.quest_stage >= 950) {
        this.quest_stage = 1000;
        this.game_cleared = true;
      }
      return this.observe({ event: 'sequence_completed' });
    }

    // 查找目标交互物
    let target = null;
    if (targetId) {
      target = this.worldObjects.find((o) => o.id === targetId || o.name === targetId);
    } else {
      let bestDist = 45.0;
      for (const o of this.worldObjects) {
        const d = Math.hypot(this.position[0] - o.pos[0], this.position[2] - o.pos[2]);
        if (d < bestDist) {
          bestDist = d;
          target = o;
        }
      }
    }

    if (!target) {
      return this.observe({ event: 'interact_none' });
    }

    const dist = Math.hypot(this.position[0] - target.pos[0], this.position[2] - target.pos[2]);
    if (this.mode === 'pure' && dist > 35.0) {
      return {
        ok: false,
        error: `pure_mode_out_of_range: distance ${dist.toFixed(1)}m > 35m to ${target.id}`,
      };
    }

    target.interacted = true;

    // 0. 九域【星海忆念·原版支线】记忆碑
    if (target.kind === 'echo' || target.id.startsWith('echo_')) {
      return this.triggerEcho(target.id);
    }

    // 1. 第一章：收集定国公府偃甲零件（触发原版第一幕剧本）
    if (target.id === 'obj_yanshi_parts') {
      this.puppets.parts_count += 4;
      this._addItem(3001, '精铁齿轮', 3);
      this._addItem(3002, '灵木机芯', 2);
      this._startScriptScene('scene_ch1_parts', target.id);
      if (this.quest_stage < 130) this.quest_stage = 130;
      return this.observe({ event: 'parts_collected' });
    }

    // 2. 第一章：通过长安木甲试炼（触发原版第二幕剧本 + 多分支抉择）
    if (target.id === 'npc_wooden_trial') {
      if (!this.puppets.crafted.includes('zhusun_baozi')) {
        this.craftPuppet('zhusun_baozi');
      }
      this._startScriptScene('scene_ch1_trial', target.id);
      if (this.quest_stage < 200) this.quest_stage = 200;
      this._levelUpParty(14, 8, 30);
      return this.observe({ event: 'chapter1_trial_passed' });
    }

    // 3. 第二章：望仙台江陵古墓·闻人羽入队（触发原版第三幕剧本 + 多分支抉择）
    if (target.id === 'npc_wenrenyu') {
      this.party[1].in_team = true;
      this._startScriptScene('scene_ch2_wenren', target.id);
      if (this.quest_stage < 250) this.quest_stage = 250;
      return this.observe({ event: 'ally_joined:闻人羽' });
    }

    if (target.id === 'mech_jiangling_tomb') {
      return this.solveMechanism('mech_jiangling_tomb');
    }

    // 4. 第三章：青萝谷·夏夷则入队（触发原版第五幕剧本）
    if (target.id === 'npc_xiayize') {
      this.party[2].in_team = true;
      this._startScriptScene('scene_ch3_xiayize', target.id);
      if (this.quest_stage < 370) this.quest_stage = 370;
      this._levelUpParty(22, 10, 40);
      return this.observe({ event: 'ally_joined:夏夷则' });
    }

    // 5. 第三章：镜湖秘境·阿阮入队（四大主角全员集结！触发原版第六幕剧本 + 多分支抉择）
    if (target.id === 'npc_aruan') {
      this.party[0].in_team = true;
      this.party[1].in_team = true;
      this.party[2].in_team = true;
      this.party[3].in_team = true;
      this._startScriptScene('scene_ch3_aruan', target.id);
      if (this.quest_stage < 450) this.quest_stage = 450;
      this._levelUpParty(28, 12, 50);
      return this.observe({ event: 'ally_joined:阿阮' });
    }

    // 6. 第四章：禾风平原静水湖·拜见谢衣，解锁桃源仙居与星蕴盘（触发原版第七幕剧本 + 多分支抉择）
    if (target.id === 'npc_xieyi') {
      this.home.unlocked = true;
      this.astral.unlocked = true;
      this.astral.star_souls = Math.max(this.astral.star_souls, 16);
      this.puppets.parts_count += 6;
      this._startScriptScene('scene_ch4_xieyi', target.id);
      if (this.quest_stage < 520) this.quest_stage = 520;
      this._levelUpParty(32, 12, 60);
      return this.observe({ event: 'xieyi_met_unlock_home_astral' });
    }

    if (target.id === 'mech_juandu_armillary') {
      return this.solveMechanism('mech_juandu_armillary');
    }

    // 7. 第五章：赤岩荒原捐毒遗迹 Boss【沙海巨型偃甲·金刚力士】（触发原版第九幕剧本）
    if (target.id === 'boss_jingang') {
      this._startScriptScene('scene_ch5_jingang', target.id);
      this.dialog.visible = false; // 进入即时 Boss 战
      this._startCombat({
        boss_id: 'boss_jingang',
        vip_monster: 6101,
        enemy_name: '沙海巨型偃甲·金刚力士',
        hp: 1450,
        shield: 180,
        telegraph_name: '流沙巨锤·红圈震地',
      });
      return this.observe({ event: 'combat_started:boss_jingang' });
    }

    // 8. 第六章：雾隐林巫山神女墓·唤醒昭明剑心（触发原版第十幕初七绝响剧本 + 多分支抉择）
    if (target.id === 'altar_zhaoming_heart') {
      this._addItem(3601, '昭明剑心碎片', 1);
      this._startScriptScene('scene_ch6_zhaoming', target.id);
      this.sequence = {
        active: true,
        id: 'seq_wushan_zhaoming',
        title: '巫山神女墓·昭明剑心苏醒',
        subtitle: '初七：这一次，我终于没有违背自己的本心……让开，让他过去！',
        completed_count: this.sequence.completed_count,
      };
      if (this.quest_stage < 810) this.quest_stage = 810;
      this._levelUpParty(44, 16, 80);
      return this.observe({ event: 'zhaoming_heart_awakened' });
    }

    // 9. 第六章：落霞坡重铸【昭明神剑】并迎战流月城廉贞祭司【华月】（触发原版第十一幕剧本）
    if (target.id === 'boss_huayue') {
      this.party[0].equipped_weapon = '昭明神剑';
      this.party[0].attack += 35;
      this._addItem(3602, '昭明神剑', 1);
      this._startScriptScene('scene_ch6_huayue', target.id);
      this.dialog.visible = false;
      this._startCombat({
        boss_id: 'boss_huayue',
        vip_monster: 6102,
        enemy_name: '流月城廉贞祭司·华月',
        hp: 1650,
        shield: 200,
        telegraph_name: '廉贞魔琴·噬魂音域',
      });
      return this.observe({ event: 'combat_started:boss_huayue' });
    }

    // 10. 终章：断霄岭流月城寂静之间决战【沈夜 & 心魔砺缨】（触发原版第十二幕剧本）
    if (target.id === 'boss_shenye') {
      if (this.quest_stage >= 950) {
        // 已击败沈夜，直接进入大结局终幕
        this._startScriptScene('scene_ch7_ending', target.id);
        this.sequence = {
          active: true,
          id: 'seq_grand_ending',
          title: '永夜初晗凝碧天·大结局',
          subtitle: '昭明剑光划破流月城永夜，生灵重归大地，偃师与同伴们的传奇永载山河。',
          completed_count: this.sequence.completed_count + 1,
        };
        this.quest_stage = 1000;
        this.game_cleared = true;
        return this.observe({ event: 'grand_ending_triggered' });
      }
      this._startScriptScene('scene_ch7_shenye_pre', target.id);
      this.dialog.visible = false;
      this._startCombat({
        boss_id: 'boss_shenye',
        vip_monster: 6103,
        enemy_name: '紫微大祭司·沈夜 & 心魔砺缨',
        hp: 9800,
        shield: 320,
        telegraph_name: '矩木天罚·永夜神雷',
      });
      return this.observe({ event: 'combat_started:boss_shenye' });
    }

    if (target.id === 'altar_grand_ending') {
      // 确保九域全部点亮并触发终幕原版剧本
      for (const r of this.meta.regions) this.discoveredRegions.add(r.name);
      this._startScriptScene('scene_ch7_ending', target.id);
      this.sequence = {
        active: false,
        id: 'seq_grand_ending',
        title: '永夜初晗凝碧天·大结局',
        subtitle: '昭明剑光划破流月城永夜，生灵重归大地，偃师与同伴们的传奇永载山河。',
        completed_count: this.sequence.completed_count + 1,
      };
      this.quest_stage = 1000;
      this.game_cleared = true;
      return this.observe({ event: 'grand_ending_cleared' });
    }

    return this.observe({ event: `interacted:${target.id}` });
  }

  _startCombat({ boss_id, vip_monster, enemy_name, hp, shield, telegraph_name }) {
    this.combat.active = true;
    this.combat.boss_id = boss_id;
    this.combat.vip_monster = vip_monster;
    this.combat.enemy_name = enemy_name;
    this.combat.enemy_hp = hp;
    this.combat.enemy_max_hp = hp;
    this.combat.shield_hp = shield;
    this.combat.shield_max_hp = shield;
    this.combat.shield_broken = shield <= 0;
    this.combat.telegraph_active = true;
    this.combat.telegraph_name = telegraph_name;
    this.combat.telegraph_timer = 1.5;
    this.combat.iframe_timer = 0;
    this.combat.guard_active = false;
    this.combat.combo_step = 0;
    for (const m of this.party) {
      if (m.in_team) m.morale = 100;
    }
  }

  /**
   * 4 人小队即时动作战斗指令（attack | heavy | skill | dodge | guard | ultimate）
   */
  combatAction(action = 'attack', opts = {}) {
    if (!this.combat.active) {
      return this.observe({ event: 'combat_not_active' });
    }

    const leader = this.party[this.leaderIdx] || this.party[0];
    let log = '';
    let dmgDealt = 0;

    // 1. 闪避翻滚（赋予 0.45s 无敌帧 iframe，规避 Boss 红圈 AOE 预警并触发完美闪避反击加成）
    if (action === 'dodge') {
      this.combat.iframe_timer = 0.45;
      if (this.combat.telegraph_active) {
        this.combat.telegraph_active = false;
        this.combat.dodges_succeeded++;
        leader.morale = Math.min(100, leader.morale + 35);
        log = `${leader.name} 施展闪避翻滚（0.45s 无敌帧 iframe），完美规避【${this.combat.telegraph_name}】！`;
      } else {
        log = `${leader.name} 疾步闪避，获得 0.45s 无敌帧！`;
      }
      this.combat.last_combat_log = log;
      return this.observe({
        event: 'combat_dodge_iframe',
        iframe_active: true,
      });
    }

    // 2. 格挡反击（闻人羽天罡枪防反 / 全员防御破盾反击）
    if (action === 'guard') {
      this.combat.guard_active = true;
      const counterDmg = Math.round(leader.attack * 1.8);
      if (this.combat.shield_hp > 0) {
        this.combat.shield_hp = Math.max(0, this.combat.shield_hp - counterDmg);
        if (this.combat.shield_hp === 0 && !this.combat.shield_broken) {
          this.combat.shield_broken = true;
          this.combat.shields_broken++;
        }
      }
      this.combat.telegraph_active = false;
      dmgDealt = counterDmg;
      log = `${leader.name} 格挡反击，震碎敌方护盾并造成 ${counterDmg} 点伤害！`;
    }

    // 3. 轻攻击三连击（Combo 1 -> 2 -> 3）
    if (action === 'attack') {
      this.combat.combo_step = (this.combat.combo_step % 3) + 1;
      const mult = this.combat.combo_step === 3 ? 1.65 : this.combat.combo_step === 2 ? 1.25 : 1.0;
      dmgDealt = Math.round(leader.attack * mult);
      leader.morale = Math.min(100, leader.morale + 18);
      const moveName =
        HERO_DEFS[this.leaderIdx]?.combo_names[this.combat.combo_step - 1] ||
        `轻击连段·${this.combat.combo_step}`;
      log = `${leader.name} 使出【${moveName}】(Combo ${this.combat.combo_step}/3)，造成 ${dmgDealt} 点伤害！`;
    }

    // 4. 重攻击 / 破盾技（Heavy / Break）
    if (action === 'heavy') {
      const breakDmg = Math.round(leader.attack * 2.4);
      if (this.combat.shield_hp > 0) {
        this.combat.shield_hp = Math.max(0, this.combat.shield_hp - breakDmg * 2);
        if (this.combat.shield_hp === 0 && !this.combat.shield_broken) {
          this.combat.shield_broken = true;
          this.combat.shields_broken++;
        }
      }
      dmgDealt = breakDmg;
      leader.morale = Math.min(100, leader.morale + 25);
      const heavyName = HERO_DEFS[this.leaderIdx]?.heavy_name || '破甲重击';
      log = `${leader.name} 施展重击破盾【${heavyName}】，造成 ${breakDmg} 点伤害${this.combat.shield_broken ? '（护盾击破！）' : ''}！`;
    }

    // 5. 元素战技（Skill）
    if (action === 'skill') {
      dmgDealt = Math.round(leader.attack * 2.8);
      if (this.combat.shield_hp > 0) {
        this.combat.shield_hp = Math.max(0, this.combat.shield_hp - dmgDealt);
        if (this.combat.shield_hp === 0 && !this.combat.shield_broken) {
          this.combat.shield_broken = true;
          this.combat.shields_broken++;
        }
      }
      leader.morale = Math.min(100, leader.morale + 30);
      log = `${leader.name} 催动星蕴战技【${leader.skill_name}】，造成 ${dmgDealt} 点${leader.element}属性伤害！`;
    }

    // 6. 星蕴终结技（Ultimate：【金刚力士】【流光】【太极】【山鬼】）
    if (action === 'ultimate') {
      dmgDealt = Math.round(leader.attack * 3.0 + 80);
      if (this.combat.shield_hp > 0) {
        this.combat.shield_hp = 0;
        if (!this.combat.shield_broken) {
          this.combat.shield_broken = true;
          this.combat.shields_broken++;
        }
      }
      this.combat.ultimates_triggered++;
      leader.morale = 100; // 保持星蕴共鸣高昂
      log = `${leader.name} 召唤星蕴法相释放终结技【${leader.ultimate_name}】，造成 ${dmgDealt} 点毁天灭地伤害！`;
    }

    // 同伴 AI 协同连携攻击 + 阿阮【春风化雨】自动群体治疗 + 偃甲协同输出
    let companionDmg = 0;
    for (let i = 0; i < this.party.length; i++) {
      if (i === this.leaderIdx || !this.party[i].in_team) continue;
      const ally = this.party[i];
      companionDmg += Math.round(ally.attack * 0.65);
      this.combat.companion_attacks++;
    }

    // 偃甲自动协同输出
    let puppetDmg = 0;
    if (this.puppets.active_puppet) {
      const pDef = PUPPET_DEFS[this.puppets.active_puppet];
      if (pDef) {
        puppetDmg = pDef.dps;
        this.puppets.total_assist_damage += puppetDmg;
        this.combat.puppet_strikes++;
      }
    }

    // Boss 护盾破除后承受额外 1.35x 弱点伤害
    const shieldMult = this.combat.shield_broken ? 1.35 : 0.85;
    const totalTurnDmg = Math.round((dmgDealt + companionDmg + puppetDmg) * shieldMult);
    this.combat.enemy_hp = Math.max(0, this.combat.enemy_hp - totalTurnDmg);

    // 若敌方存活，敌方反击 & 阿阮同伴 AI 自动释放【春风化雨】恢复全队
    if (this.combat.enemy_hp > 0) {
      if (this.combat.telegraph_active && this.combat.iframe_timer <= 0 && !this.combat.guard_active) {
        // 受到 Boss AOE 伤害
        for (const m of this.party) {
          if (m.in_team) m.hp = Math.max(40, m.hp - 35);
        }
        this.combat.telegraph_active = false;
      } else {
        // 普通反击伤害
        leader.hp = Math.max(50, leader.hp - 18);
        // 下一轮概率再次亮起红圈预警
        if (this.combat.enemy_hp < this.combat.enemy_max_hp * 0.65) {
          this.combat.telegraph_active = true;
        }
      }

      // 阿阮在队时自动触发同伴 AI【春风化雨】群体治疗
      const aruan = this.party[3];
      if (aruan && aruan.in_team) {
        const needHeal = this.party.some((m) => m.in_team && m.hp < m.max_hp);
        if (needHeal) {
          for (const m of this.party) {
            if (m.in_team) m.hp = Math.min(m.max_hp, m.hp + 45);
          }
          this.combat.companion_heals++;
          log += ' 阿阮同伴 AI 自动吹奏巴乌施展【春风化雨】为全队恢复气血！';
        }
      }
    } else {
      // 击败 Boss 结算
      this._onBossDefeated(this.combat.boss_id);
      log += ` 成功击败【${this.combat.enemy_name}】！`;
    }

    this.combat.guard_active = false;
    this.combat.last_combat_log = log;
    return this.observe({
      event: this.combat.active ? `combat_hit:${action}` : `combat_victory:${this.combat.boss_id}`,
      damage_dealt: totalTurnDmg,
    });
  }

  _onBossDefeated(bossId) {
    this.combat.active = false;
    this.combat.telegraph_active = false;
    this.combat.victories++;
    for (const m of this.party) {
      if (m.in_team) m.hp = m.max_hp;
    }

    if (bossId === 'boss_jingang') {
      if (this.quest_stage < 750) this.quest_stage = 750;
      this._levelUpParty(40, 15, 70);
      this._addItem(3509, '捐毒金刚核心', 1);
    } else if (bossId === 'boss_huayue') {
      if (this.quest_stage < 880) this.quest_stage = 880;
      this._levelUpParty(50, 18, 90);
      this._addItem(3603, '廉贞箜篌残弦', 1);
    } else if (bossId === 'boss_shenye') {
      if (this.quest_stage < 950) this.quest_stage = 950;
      this._levelUpParty(60, 25, 120);
      this._addItem(3609, '流月紫微冕冠', 1);
      // 同步点亮全部九域
      for (const r of this.meta.regions) this.discoveredRegions.add(r.name);
    }
  }

  /**
   * 毫秒级内存状态树快照保存
   */
  saveCheckpoint(slot = 'default') {
    const snapshot = {
      tickCount: this.tickCount,
      simTime: this.simTime,
      quest_stage: this.quest_stage,
      game_cleared: this.game_cleared,
      currentRegion: this.currentRegion,
      discoveredRegions: [...this.discoveredRegions],
      leaderIdx: this.leaderIdx,
      position: [...this.position],
      yaw: this.yaw,
      party: structuredClone(this.party),
      astral: structuredClone(this.astral),
      puppets: structuredClone(this.puppets),
      mechanisms: structuredClone(this.mechanisms),
      home: structuredClone(this.home),
      inventory: structuredClone(this.inventory),
      dialog: structuredClone(this.dialog),
      story: structuredClone(this.story),
      cutscene: structuredClone(this.cutscene),
      sequence: structuredClone(this.sequence),
      combat: structuredClone(this.combat),
      worldObjects: structuredClone(this.worldObjects),
    };
    this.checkpoints.set(slot, snapshot);
    return this.observe({ event: `checkpoint_saved:${slot}` });
  }

  /**
   * 毫秒级内存状态树快照回滚
   */
  loadCheckpoint(slot = 'default') {
    const snap = this.checkpoints.get(slot);
    if (!snap) {
      return { ok: false, error: `Checkpoint slot not found: ${slot}` };
    }
    this.tickCount = snap.tickCount;
    this.simTime = snap.simTime;
    this.quest_stage = snap.quest_stage;
    this.game_cleared = snap.game_cleared;
    this.currentRegion = snap.currentRegion;
    this.discoveredRegions = new Set(snap.discoveredRegions);
    this.leaderIdx = snap.leaderIdx;
    this.position = [...snap.position];
    this.yaw = snap.yaw;
    this.party = structuredClone(snap.party);
    this.astral = structuredClone(snap.astral);
    this.puppets = structuredClone(snap.puppets);
    this.mechanisms = structuredClone(snap.mechanisms);
    this.home = structuredClone(snap.home);
    this.inventory = structuredClone(snap.inventory);
    this.dialog = structuredClone(snap.dialog);
    this.story = structuredClone(snap.story);
    this.cutscene = structuredClone(snap.cutscene);
    this.sequence = structuredClone(snap.sequence);
    this.combat = structuredClone(snap.combat);
    this.worldObjects = structuredClone(snap.worldObjects);
    return this.observe({ event: `checkpoint_loaded:${slot}` });
  }

  /**
   * 生成观测输出（支持 normal 与 pure 防作弊盲测模式）
   */
  observe(extra = {}) {
    const leader = this.party[this.leaderIdx] || this.party[0];
    const [x, y, z] = this.position;
    const reg = this.physics.regionAt(x, z) || this.meta.regions[0];
    const th = this.physics.terrainHeightAt(x, z);
    const onBridge = this.physics.isOnBridge(x, z);
    const slope = this.physics.slopeAt(x, z);
    const curQuest = this.getCurrentQuest();

    const out = {
      ok: true,
      event: extra.event || 'observed',
      tick: this.tickCount,
      region: reg ? reg.name : this.currentRegion,
      region_name: reg ? reg.disp : '沧澜山脉',
      chapter_title: curQuest.title,
      chapter_objective: curQuest.desc,
      discovered_regions: [...this.discoveredRegions],
      game_cleared: this.game_cleared,
      leader: {
        index: this.leaderIdx,
        role_id: leader.role_id,
        id: leader.id,
        name: leader.name,
        title: leader.title,
        level: leader.level,
        hp: leader.hp,
        max_hp: leader.max_hp,
        attack: leader.attack,
        equipped_weapon: leader.equipped_weapon,
        astral_totem: leader.astral_totem,
        element: leader.element,
        position: [x, y, z],
        terrain_height: Number(th.toFixed(2)),
        on_bridge: onBridge,
        slope_at_pos: Number(slope.toFixed(3)),
      },
      party: this.party.map((p) => ({
        role_id: p.role_id,
        id: p.id,
        name: p.name,
        title: p.title,
        in_team: p.in_team,
        level: p.level,
        hp: p.hp,
        max_hp: p.max_hp,
        attack: p.attack,
        defense: p.defense,
        morale: p.morale,
        equipped_weapon: p.equipped_weapon,
        astral_totem: p.astral_totem,
        element: p.element,
        astral_points: p.astral_points,
        skills_count: p.skills_unlocked.length,
        skills_unlocked: [...p.skills_unlocked],
        ultimate_unlocked: p.ultimate_unlocked,
        ultimate_name: p.ultimate_name,
      })),
      astral: {
        unlocked: this.astral.unlocked,
        star_souls: this.astral.star_souls,
        allocations: { ...this.astral.allocations },
      },
      puppets: {
        parts_count: this.puppets.parts_count,
        crafted: [...this.puppets.crafted],
        active_puppet: this.puppets.active_puppet,
        total_assist_damage: this.puppets.total_assist_damage,
      },
      home: {
        unlocked: this.home.unlocked,
        herbs_planted: this.home.herbs_planted,
        herbs_harvested: this.home.herbs_harvested,
        woodwork_crafted: [...this.home.woodwork_crafted],
        dishes_cooked: [...this.home.dishes_cooked],
      },
      mechanisms: {
        mech_jiangling_tomb: this.mechanisms.mech_jiangling_tomb.solved,
        mech_juandu_armillary: this.mechanisms.mech_juandu_armillary.solved,
      },
      combat: {
        active: this.combat.active,
        boss_id: this.combat.boss_id,
        vip_monster: this.combat.vip_monster,
        enemy_name: this.combat.enemy_name,
        enemy_hp: this.combat.enemy_hp,
        enemy_max_hp: this.combat.enemy_max_hp,
        shield_hp: this.combat.shield_hp,
        shield_broken: this.combat.shield_broken,
        telegraph_active: this.combat.telegraph_active,
        telegraph_name: this.combat.telegraph_name,
        iframe_active: this.combat.iframe_timer > 0,
        combo_step: this.combat.combo_step,
        victories: this.combat.victories,
        dodges_succeeded: this.combat.dodges_succeeded,
        shields_broken: this.combat.shields_broken,
        ultimates_triggered: this.combat.ultimates_triggered,
        companion_attacks: this.combat.companion_attacks,
        companion_heals: this.combat.companion_heals,
        puppet_strikes: this.combat.puppet_strikes,
        last_combat_log: this.combat.last_combat_log,
      },
      dialog: {
        visible: this.dialog.visible,
        scene_id: this.dialog.scene_id,
        scene_title: this.dialog.scene_title,
        subtitle: this.dialog.subtitle,
        poem: this.dialog.poem,
        story_cg: this.dialog.story_cg,
        speaker: this.dialog.speaker,
        role_id: this.dialog.role_id,
        speaker_title: this.dialog.speaker_title,
        emotion: this.dialog.emotion,
        text: this.dialog.text,
        line_index: this.dialog.line_index,
        total_lines: this.dialog.total_lines,
        branch_id: this.dialog.branch_id,
        target_id: this.dialog.target_id,
      },
      story: {
        active_scene_id: this.story.active_scene_id,
        scenes_viewed_count: this.story.scenes_viewed.length,
        scenes_viewed: [...this.story.scenes_viewed],
        lines_read: this.story.lines_read,
        branches_chosen: { ...this.story.branches_chosen },
        pending_branch: this.story.pending_branch
          ? {
              id: this.story.pending_branch.id,
              prompt: this.story.pending_branch.prompt,
              options: this.story.pending_branch.options.map((o, idx) => ({
                index: idx,
                id: o.id,
                label: o.label,
              })),
            }
          : null,
        alignment: { ...this.story.alignment },
        affection: { ...this.story.affection },
        echoes_discovered: [...this.story.echoes_discovered],
      },
      cutscene: { ...this.cutscene },
      sequence: { ...this.sequence },
      inventory: {
        money: this.inventory.money,
        items: this.inventory.items.map((i) => ({ ...i })),
      },
      physics_stats: {
        grid_W: this.physics.W,
        grid_H: this.physics.H,
        placed_props: this.physics.placedProps.length,
      },
      ...extra,
    };

    if (this.mode !== 'pure') {
      out.quest_stage = this.quest_stage;
      out.diagnostics = {
        script_error: this.diagnostics.script_error,
        unhandled_calls: [...this.diagnostics.unhandled_calls],
      };
    }

    return out;
  }

  /**
   * 统一处理 JSON-Lines 协议指令
   */
  dispatch(cmdPayload) {
    const cmd = cmdPayload && cmdPayload.cmd;
    switch (cmd) {
      case 'observe':
        return this.observe();
      case 'step':
        return this.step(cmdPayload.frames || 1, cmdPayload.dt || 0.016);
      case 'move_to':
        return this.moveTo(
          Number(cmdPayload.x ?? 0),
          Number(cmdPayload.z ?? 0),
          Number(cmdPayload.max_steps ?? 200),
        );
      case 'interact':
        return this.interact(cmdPayload.target || null);
      case 'step_dialog':
        return this.stepDialog();
      case 'choose_branch':
        return this.chooseBranch(cmdPayload.branch_id || null, cmdPayload.option ?? 0);
      case 'play_script':
        return this.playScript(cmdPayload.scene_id || 'scene_ch1_parts');
      case 'trigger_echo':
        return this.triggerEcho(cmdPayload.echo_id || null);
      case 'switch_leader':
        return this.switchLeader(cmdPayload.index ?? 0);
      case 'allocate_astral':
        return this.allocateAstral(cmdPayload.role_id ?? 101, cmdPayload.points ?? 3);
      case 'craft_puppet':
        return this.craftPuppet(cmdPayload.puppet_id || 'zhusun_baozi');
      case 'solve_mechanism':
        return this.solveMechanism(cmdPayload.mechanism_id);
      case 'home_action':
        return this.homeAction(cmdPayload.action || 'all', cmdPayload.item || '');
      case 'combat_action':
        return this.combatAction(cmdPayload.action || 'attack', cmdPayload);
      case 'save_checkpoint':
        return this.saveCheckpoint(cmdPayload.slot || 'default');
      case 'load_checkpoint':
        return this.loadCheckpoint(cmdPayload.slot || 'default');
      default:
        this.diagnostics.unhandled_calls.push(String(cmd));
        return { ok: false, error: `Unknown command: ${cmd}` };
    }
  }
}
