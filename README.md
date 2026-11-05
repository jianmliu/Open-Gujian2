# Open-Gujian2

基于原版美术资产，使用 codebuddy vibe coding 用 Three.js 还原的《古剑奇谭二》开放世界探索原型。在 Web 端逼近 UE4 级别的表现：ACES 色调映射 + PCSS 软阴影 + IBL 全局光照 + GTAO + Bloom + 昼夜系统 + 混合动画系统

---

## 功能特性

- **开放世界**：九域大地取自原版真实地形数据（高度图 + 色图 + 法线图），分块流式加载 **（by hy4-preview）**
- **昼夜系统**：由原版场景光照关键帧插值驱动（10 分钟一天），天空 / 雾 / 光照实时变化 **（by hy4-preview）**
- **骨骼动画**：原版 `.xsm` 动画离线烘焙 → 运行时步态混合空间（idle/walk/run/sprint 连续加权）+ 全身动作层（攻击/跳跃），几乎无滑步 **（by Deepseek-v4.1-Flash）**
- **画质管线**：PCSS 接触硬化软阴影、PMREM 环境光（IBL）、GTAO 环境光遮蔽、UnrealBloom 泛光、ACES 色调映射、FXAA **（by GLM-5.3-Flash）**
- **植被 / 水面 / 天空**：交叉面片植被带风摆、原版 `vscene` 参数驱动的水面着色、程序化三段渐变天空 **（by GLM-5.3-Flash）**
- **地形材质**：坡度分层（土/草/石/裸岩）、四张细节贴图双尺度平铺、屏幕空间细节凹凸 **（by GLM-5.3-Flash）**

- **玩法**：《古剑奇谭二：永夜初晗凝碧天》九域七章完整主线（`quest_stage 100 -> 1000`）、四大主角小队即时动作战斗（`1-4` 切换主控、三段连击、重击破盾、闪避无敌帧 `iframe`、四主角星蕴终结技、阿阮 AI 自动治疗）、星蕴定式盘、偃甲工坊（竹笋包子号/木甲侍卫/飞天偃甲）、桃源仙居、真实地形坡度阻挡与聚落建筑 2D OBB 碰撞、桥梁桥面抬升、以及 `P` 键 **🤖 AI 自动巡航**。
- **双端确定性架构 (`js/engine_core.js` + `agent-gujian2`)**：零 DOM / 零 WebGL 确定性核心引擎，既可驱动浏览器 Three.js 3D 渲染，也可在 Node.js 下通过 `bin/agent-gujian2-host.mjs` 以 **20,000+ ~ 2,000,000+ FPS** 运行 JSON-Lines 无头智能体评测（支持 `normal` 与 `pure` 防作弊盲测模式）。

---

## 技术栈

| 层级 | 选型 |
|---|---|
| 渲染 | Three.js（ES Module，`js/three.module.js` + `js/addons/`） |
| 后处理 | EffectComposer + GTAOPass + UnrealBloomPass + OutputPass + FXAAShader |
| 着色器补丁 | 运行时改写 `ShaderChunk` 注入 PCSS / 地形材质逻辑（`pcss.js`、`world.js`） |
| 资产格式 | 原版 XAC（模型）、XSM（动画）、vscene（场景光照）、DDS（贴图） |
| 本地服务 | Python 标准库 `http.server`（修正 `.js` MIME 误判） |
| 资产工具 | Python（烘焙脚本）+ Node.js 浏览器内探针脚本 |

---

## 目录结构

```
webapp/
├── index.html            # 入口页面（加载界面 / 标题 / HUD / 面板）
├── charview.html         # 角色观察器（调试用）
├── propview.html         # 道具观察器（调试用）
├── server.py             # 本地静态服务器（修正 Windows 下 .js MIME）
├── ANIMATION.md          # 骨骼动画系统文档
├── LIGHTING.md           # 光照 / 画质管线文档
├── js/                   # 运行时源码
│   ├── main.js           # 主循环：渲染器 / 后处理 / 昼夜 / 玩法 / HUD
│   ├── world.js          # 地表分块 / 植被 / 水面 / 天空 ShaderMaterial
│   ├── assets.js         # 模型(XAC) / 道具 / 角色构建
│   ├── anim.js           # AnimPlayer：动画加载 / 步态混合 / 动作层
│   ├── entities.js       # 妖兽 / NPC 标签 / 血条精灵
│   ├── env.js            # 解析原版 vscene 输出各时段光照 / 雾 / 天空
│   ├── pcss.js           # 运行时 PCSS 软阴影补丁（副作用，须最先 import）
│   ├── three.module.js   # Three.js 核心
│   └── addons/           # Three.js 后处理 / 着色器插件
├── assets/               # 运行时资源（已烘焙）
│   ├── chars/            # 角色模型 + 烘焙动画 JSON
│   ├── props/            # 道具模型 / 贴图
│   ├── terrain/          # 地形高度图 / 法线 / 色图
│   ├── veg/ mapimg/ ui/  # 植被 / 地图 / UI 立绘
│   └── world.*           # 世界元数据 / 高度图 / 色图 / 法线
└── tools/                # 资产烘焙与回归工具
    ├── build_*.py        # 烘焙地形 / 角色 / 动画 / 道具 / 环境 / 世界
    ├── probe_*.py/.js    # 格式探针 / 滑步 / 朝向 / 步速 回归测试
    ├── *_probe*.py       # DDS / 网格 / XAC / XSM 格式拆解
    └── shot_*.js         # 状态截图 / 验证脚本
```

详细机制见：
- 动画管线、XSM 逆向、滑步标定 👉 [`ANIMATION.md`](./ANIMATION.md)
- 渲染管线 / PCSS / IBL / 昼夜 / 后处理 / 地形材质 👉 [`LIGHTING.md`](./LIGHTING.md)

---

## 运行方式

```bash
# 1. 启动本地 3D 浏览器服务器（默认端口 8461）
python server.py 8461

# 2. 浏览器打开
#    http://127.0.0.1:8461/index.html

# 3. 运行 Node.js 15 步全流程无头基准测试（同时验证 normal 与 pure 盲测模式）
npm test
```

---

## 操作指南

| 操作 | 按键 |
|---|---|
| 移动 | `W` `A` `S` `D` |
| 疾行 | `Shift` |
| 跳跃 | `空格` |
| 切换主控角色（乐无异/闻人羽/夏夷则/阿阮） | `1` `2` `3` `4` |
| 轻攻击三连击 | 鼠标左键 / `J` |
| 重攻击 / 破盾技 | `K` |
| 元素战技 | `U` |
| 闪避翻滚（0.45s 无敌帧 `iframe`） | `L` |
| 格挡反击 | `G` |
| 星蕴终结技（金刚力士/流光/太极/山鬼） | `Q` |
| 采集 / 对话 / 破解机关 | `F` |
| 星蕴 / 偃甲 / 桃源仙居面板 | `Y` |
| 🤖 AI 自动巡航（全自动通关九域七章） | `P`（按任意方向键立即真人接管） |
| 舆图 / 行囊 / 指引 / 关闭 | `M` / `I` / `H` / `Esc` |

九域各有一位故人 NPC，交谈可获得指引与委托任务。

---

## 资产管线（从原版到浏览器）

原版资产不在仓库内，需要运行烘焙脚本，产物输出到 `webapp/assets/`。典型流程：

```bash
# 烘焙地形 / 世界
python tools/build_terrain.py
python tools/build_world.py

# 烘焙角色模型
python tools/build_chars.py

# 烘焙骨骼动画（从 XSM 逆向 → JSON）
python tools/build_anims.py

# 烘焙道具 / 环境光照
python tools/build_props.py
python tools/build_env.py
```

烘焙脚本读取原版破解资产目录下的 `Characters/*.xsm|.xac`、`Terrain/`、`vscene` 等数据，逆向格式后抽稀 / 压缩 / 标定，输出浏览器可直接 `fetch` 的 JSON / 二进制 / PNG。

资产工具同时附带一批**探针与回归脚本**（`probe_xsm.py`、`probe_stride.js`、`probe_contact.js` 等），用于验证动画步速、滑步率、模型朝向等关键指标
