#!/usr/bin/env node
// test/run-headless-bench.mjs —— 《古剑奇谭二：永夜初晗凝碧天》15 步全流程无头基准测试
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const modeIdx = args.indexOf('--mode');
const mode = modeIdx >= 0 && args[modeIdx + 1] ? args[modeIdx + 1] : 'normal';
const seedIdx = args.indexOf('--seed');
const seed = seedIdx >= 0 && args[seedIdx + 1] ? args[seedIdx + 1] : '42';
const extraArgs = [];
if (args.includes('--procedural')) extraArgs.push('--procedural');
const assetsIdx = args.indexOf('--assets-dir');
if (assetsIdx >= 0 && args[assetsIdx + 1]) {
  extraArgs.push('--assets-dir', args[assetsIdx + 1]);
}
const hostScript = path.resolve(__dirname, '../bin/agent-gujian2-host.mjs');

class AgentGujian2Client {
  constructor(scriptPath, runMode, rngSeed) {
    this.proc = spawn(
      process.execPath,
      [scriptPath, '--mode', runMode, '--seed', String(rngSeed), ...extraArgs],
      { stdio: ['pipe', 'pipe', 'inherit'] },
    );
    this.rl = createInterface({ input: this.proc.stdout });
    this.queue = [];
    this.rl.on('line', (line) => {
      if (!line.trim()) return;
      const resolver = this.queue.shift();
      if (resolver) resolver(JSON.parse(line));
    });
  }

  send(payload) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout on ${JSON.stringify(payload)}`)),
        5000,
      );
      this.queue.push((res) => {
        clearTimeout(timer);
        if (!res.ok) {
          return reject(new Error(`RPC error on ${JSON.stringify(payload)}: ${res.error}`));
        }
        resolve(res);
      });
      this.proc.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  close() {
    this.proc.stdin.write('quit\n');
    this.proc.kill();
  }
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log(`  agent-gujian2 Headless Benchmark [mode=${mode}, seed=${seed}] (Open-Gujian2)`);
  console.log('========================================================================');
  const client = new AgentGujian2Client(hostScript, mode, seed);

  const checkStage = (state, expectedStage) => {
    if (mode !== 'pure') {
      assert.equal(state.quest_stage, expectedStage);
      assert.equal(state.diagnostics.script_error, '');
      assert.equal(state.diagnostics.unhandled_calls.length, 0);
    } else {
      assert.equal(state.quest_stage, undefined);
      assert.equal(state.diagnostics, undefined);
    }
  };

  try {
    // Step 1: 真实地形资产加载、初始观测与 20,000+ FPS 锁步基准验证
    const s0 = await client.send({ cmd: 'observe' });
    assert.equal(s0.ok, true);
    assert.equal(s0.region, 'n04');
    assert.equal(s0.region_name, '沧澜山脉');
    assert.equal(s0.leader.name, '乐无异');
    assert.equal(s0.leader.astral_totem, '腾蛇');
    assert.equal(s0.physics_stats.grid_W, 2000);
    assert.equal(s0.physics_stats.grid_H, 2050);
    assert.ok(s0.physics_stats.placed_props >= 200);
    const stepBench = await client.send({ cmd: 'step', frames: 5000, dt: 0.016 });
    assert.ok(stepBench.headless_fps >= 20000, `Expected >= 20000 FPS, got ${stepBench.headless_fps}`);
    checkStage(s0, 100);
    console.log(
      `[PASS] 1. 真实地形高度图 (2000×2050) 与 20,000+ FPS 锁步核心验证: 区域=${s0.region_name}(${s0.region}), 领队=${s0.leader.name}(星蕴:${s0.leader.astral_totem}), 聚落建筑=${s0.physics_stats.placed_props}, 锁步帧率=${stepBench.headless_fps} FPS`,
    );

    // Step 2: 建筑 2D OBB 碰撞阻挡检测 (move_blocked_by_prop)
    const propProbe = await client.send({
      cmd: 'move_to',
      x: -44.55,
      z: 300.0,
      max_steps: 60,
    });
    assert.equal(propProbe.event, 'move_blocked_by_prop');
    assert.ok(propProbe.blocked_by.includes('building'));
    assert.ok(propProbe.leader.position[2] < 288.0);
    console.log(
      `[PASS] 2. 建筑 2D OBB 碰撞阻挡验证 (WorldPhysics): 向北穿墙探测在 z=${propProbe.leader.position[2]}m 处被原版建筑 ${propProbe.blocked_by} 阻挡 (${propProbe.event})`,
    );

    // Step 3: 陡峭悬崖坡度阻挡 (slope > 0.68 -> move_blocked_by_cliff) 与桥梁高度抬升验证 (bridge_*)
    const cliffProbe = await client.send({
      cmd: 'move_to',
      x: -83.3,
      z: 154.0,
      max_steps: 140,
    });
    assert.equal(cliffProbe.event, 'move_blocked_by_cliff');
    assert.ok(cliffProbe.blocked_slope > 0.68);
    // 走上桥梁 (-15.0, 273.87)
    const bridgeProbe = await client.send({
      cmd: 'move_to',
      x: -15.0,
      z: 273.87,
      max_steps: 140,
    });
    assert.equal(bridgeProbe.event, 'move_reached');
    assert.equal(bridgeProbe.leader.on_bridge, true);
    assert.ok(bridgeProbe.leader.position[1] > bridgeProbe.leader.terrain_height + 1.5);
    console.log(
      `[PASS] 3. 陡峭悬崖阻挡与桥梁高度抬升验证: 悬崖阻挡坡度=${cliffProbe.blocked_slope} (>0.68), 桥面抬升高度=${bridgeProbe.leader.position[1]}m (原地形=${bridgeProbe.leader.terrain_height}m)`,
    );

    // Step 4: 第一章·长安偃术试炼 (n04 沧澜山脉/定国公府, stage 100 -> 200)
    const moveParts = await client.send({ cmd: 'move_to', x: -30.0, z: 265.0, max_steps: 60 });
    assert.equal(moveParts.event, 'move_reached');
    const getParts = await client.send({ cmd: 'interact', target: 'obj_yanshi_parts' });
    assert.equal(getParts.event, 'parts_collected');
    checkStage(getParts, 130);

    const craftedBaozi = await client.send({ cmd: 'craft_puppet', puppet_id: 'zhusun_baozi' });
    assert.equal(craftedBaozi.puppets.active_puppet, 'zhusun_baozi');
    checkStage(craftedBaozi, 160);

    const moveTrial = await client.send({ cmd: 'move_to', x: -20.0, z: 255.0, max_steps: 60 });
    assert.equal(moveTrial.event, 'move_reached');
    const passTrial = await client.send({ cmd: 'interact', target: 'npc_wooden_trial' });
    assert.equal(passTrial.dialog.visible, true);
    assert.equal(passTrial.dialog.scene_id, 'scene_ch1_trial');
    assert.ok(passTrial.cutscene.active);
    // 逐句推进原版剧本台词与 3D 摄像机运镜切镜，并执行多分支剧情抉择
    const stepLine2 = await client.send({ cmd: 'step_dialog' });
    assert.equal(stepLine2.dialog.line_index, 1);
    const branchRes = await client.send({
      cmd: 'choose_branch',
      branch_id: 'branch_ch1_departure',
      option: 'opt_ch1_benevolence',
    });
    assert.equal(branchRes.chosen_option, 'opt_ch1_benevolence');
    assert.ok(branchRes.story.affection[106] >= 75);
    const afterTrial = await client.send({ cmd: 'interact' });
    assert.equal(afterTrial.dialog.visible, false);
    checkStage(afterTrial, 200);
    console.log(
      `[PASS] 4. 第一章·长安偃术试炼完成 (stage 100->200): 打造【竹笋包子号】、体验原版逐句台词运镜 (${afterTrial.cutscene.shot_name}) 与分支抉择`,
    );

    // Step 5: 第二章·江陵古墓与百草天罡 (n01p1 望仙台, stage 200 -> 300)
    const moveWenren = await client.send({
      cmd: 'move_to',
      x: 486.98,
      z: -1375.94,
      max_steps: 300,
    });
    assert.equal(moveWenren.event, 'move_reached');
    assert.equal(moveWenren.region, 'n01p1');
    const talkWenren = await client.send({ cmd: 'interact', target: 'npc_wenrenyu' });
    assert.equal(talkWenren.party[1].in_team, true);
    if (talkWenren.dialog.visible) await client.send({ cmd: 'interact' });
    checkStage(talkWenren, 250);

    const moveTombMech = await client.send({
      cmd: 'move_to',
      x: 550.0,
      z: -1450.0,
      max_steps: 100,
    });
    assert.equal(moveTombMech.event, 'move_reached');
    const solvedTomb = await client.send({
      cmd: 'solve_mechanism',
      mechanism_id: 'mech_jiangling_tomb',
    });
    assert.equal(solvedTomb.mechanisms.mech_jiangling_tomb, true);
    checkStage(solvedTomb, 300);
    console.log(
      `[PASS] 5. 第二章·江陵古墓与百草天罡 (stage 200->300): 【闻人羽】入队并破解望仙台古墓双枢机关`,
    );

    // Step 6: 第三章·太华山与青萝谷寻仙 (n01p2 青萝谷 & n08 镜湖秘境, stage 300 -> 450)
    const moveXiayize = await client.send({
      cmd: 'move_to',
      x: -1500.0,
      z: 350.0,
      max_steps: 300,
    });
    assert.equal(moveXiayize.region, 'n01p2');
    const talkXiayize = await client.send({ cmd: 'interact', target: 'npc_xiayize' });
    assert.equal(talkXiayize.party[2].in_team, true);
    if (talkXiayize.dialog.visible) await client.send({ cmd: 'interact' });
    checkStage(talkXiayize, 370);

    const moveAruan = await client.send({
      cmd: 'move_to',
      x: -1500.0,
      z: -850.0,
      max_steps: 300,
    });
    assert.equal(moveAruan.region, 'n08');
    const talkAruan = await client.send({ cmd: 'interact', target: 'npc_aruan' });
    if (talkAruan.dialog.visible) await client.send({ cmd: 'interact' });
    assert.equal(talkAruan.party.every((p) => p.in_team), true);
    checkStage(talkAruan, 450);
    console.log(
      `[PASS] 6. 第三章·青萝谷与镜湖秘境寻仙 (stage 300->450): 【夏夷则】与【阿阮】相继入队，四大主角全员集结 (${talkAruan.party.map((p) => p.name).join(' / ')})`,
    );

    // Step 7: 第四章（上）·静水湖拜见谢衣与四象星蕴定式加点 (n12p3 禾风平原, allocate_astral)
    const moveXieyi = await client.send({
      cmd: 'move_to',
      x: 1472.51,
      z: 380.27,
      max_steps: 400,
    });
    assert.equal(moveXieyi.region, 'n12p3');
    const talkXieyi = await client.send({ cmd: 'interact', target: 'npc_xieyi' });
    if (talkXieyi.dialog.visible) await client.send({ cmd: 'interact' });
    assert.equal(talkXieyi.home.unlocked, true);
    assert.equal(talkXieyi.astral.unlocked, true);
    checkStage(talkXieyi, 520);

    for (const rid of [101, 102, 103, 104]) {
      await client.send({ cmd: 'allocate_astral', role_id: rid, points: 3 });
    }
    const afterAstral = await client.send({ cmd: 'observe' });
    assert.equal(afterAstral.party.every((p) => p.ultimate_unlocked), true);
    console.log(
      `[PASS] 7. 第四章（上）·静水湖谢衣传授星蕴定式: 四主角点亮【腾蛇 / 天狼 / 太阴 / 鸾鸟】星蕴并领悟终结技 (${afterAstral.party.map((p) => p.ultimate_name).join('、')})`,
    );

    // Step 8: 第四章（下）·桃源仙居灵草种植、鲁班木作、料理烹饪与高阶偃甲合成 (stage 520 -> 600)
    await client.send({ cmd: 'home_action', action: 'plant' });
    await client.send({ cmd: 'home_action', action: 'woodwork', item: '神机鲁班匣' });
    await client.send({ cmd: 'home_action', action: 'cook', item: '竹笋包子·叫花鸡全席' });
    await client.send({ cmd: 'craft_puppet', puppet_id: 'mujia_shiwei' });
    const afterHome = await client.send({ cmd: 'craft_puppet', puppet_id: 'feitian_yanjia' });
    assert.equal(afterHome.puppets.crafted.length, 3);
    assert.equal(afterHome.home.herbs_harvested, 4);
    assert.ok(afterHome.home.dishes_cooked.length >= 1);
    checkStage(afterHome, 600);
    console.log(
      `[PASS] 8. 第四章（下）·桃源仙居与偃甲工坊 (stage 520->600): 收获灵草×${afterHome.home.herbs_harvested}、烹制【${afterHome.home.dishes_cooked[0]}】、合成【木甲侍卫】与【飞天偃甲】`,
    );

    // Step 9: 第五章（上）·赤岩荒原捐毒遗迹浑天仪机关修复 (q04b 赤岩荒原, stage 600 -> 650)
    const moveJuandu = await client.send({
      cmd: 'move_to',
      x: -350.0,
      z: 1630.0,
      max_steps: 400,
    });
    assert.equal(moveJuandu.region, 'q04b');
    const solvedJuandu = await client.send({
      cmd: 'solve_mechanism',
      mechanism_id: 'mech_juandu_armillary',
    });
    assert.equal(solvedJuandu.mechanisms.mech_juandu_armillary, true);
    checkStage(solvedJuandu, 650);
    console.log(
      `[PASS] 9. 第五章（上）·赤岩荒原捐毒遗迹机关破解 (stage 600->650): 乐无异修复沙漠浑天仪，唤醒【沙海巨型偃甲·金刚力士】`,
    );

    // Step 10: 第五章（下）·四主角即时动作战斗、0.45s 闪避无敌帧 (iframe) 规避 Boss 红圈 AOE 与轻重连击 (stage 650 -> 750)
    await client.send({ cmd: 'move_to', x: -350.0, z: 1650.0, max_steps: 60 });
    let battleJingang = await client.send({ cmd: 'interact', target: 'boss_jingang' });
    assert.equal(battleJingang.combat.active, true);
    assert.equal(battleJingang.combat.telegraph_active, true);

    // 使用闪避无敌帧规避 Boss 红圈 AOE
    const dodgeRes = await client.send({ cmd: 'combat_action', action: 'dodge' });
    assert.equal(dodgeRes.combat.iframe_active, true);
    assert.equal(dodgeRes.combat.dodges_succeeded, 1);

    // 轻攻击三连击 Combo 1 -> 2 -> 3 + 重击破盾 + 战技击破 Boss
    await client.send({ cmd: 'combat_action', action: 'attack' });
    await client.send({ cmd: 'combat_action', action: 'attack' });
    const combo3 = await client.send({ cmd: 'combat_action', action: 'attack' });
    assert.equal(combo3.combat.combo_step, 3);
    while (battleJingang.combat.active) {
      battleJingang = await client.send({ cmd: 'combat_action', action: 'heavy' });
    }
    assert.equal(battleJingang.combat.victories, 1);
    assert.ok(battleJingang.puppets.total_assist_damage > 0);
    checkStage(battleJingang, 750);
    console.log(
      `[PASS] 10. 第五章（下）·闪避无敌帧 (0.45s iframe) 与三连击击败【金刚力士】 (stage 650->750): 完美闪避=${battleJingang.combat.dodges_succeeded} 次, 偃甲助战伤害=${battleJingang.puppets.total_assist_damage}`,
    );

    // Step 11: 第六章·雾隐巫山唤醒昭明剑心与落霞坡重铸【昭明神剑】击败【华月】 (n10 & q07, stage 750 -> 880)
    const moveWushan = await client.send({
      cmd: 'move_to',
      x: 1500.0,
      z: 1350.0,
      max_steps: 400,
    });
    assert.equal(moveWushan.region, 'n10');
    const wakeHeart = await client.send({ cmd: 'interact', target: 'altar_zhaoming_heart' });
    assert.equal(wakeHeart.sequence.active, true);
    await client.send({ cmd: 'interact' });
    checkStage(wakeHeart, 810);

    const moveLuoxia = await client.send({
      cmd: 'move_to',
      x: -1400.0,
      z: 1300.0,
      max_steps: 400,
    });
    assert.equal(moveLuoxia.region, 'q07');
    let battleHuayue = await client.send({ cmd: 'interact', target: 'boss_huayue' });
    assert.equal(battleHuayue.party[0].equipped_weapon, '昭明神剑');
    assert.equal(battleHuayue.combat.active, true);
    while (battleHuayue.combat.active) {
      battleHuayue = await client.send({ cmd: 'combat_action', action: 'skill' });
    }
    assert.ok(battleHuayue.combat.companion_heals >= 1);
    checkStage(battleHuayue, 880);
    console.log(
      `[PASS] 11. 第六章·雾隐林昭明剑心与落霞坡击败【华月】 (stage 750->880): 重铸【昭明神剑】, 阿阮同伴 AI 自动释放【春风化雨】治疗=${battleHuayue.combat.companion_heals} 次`,
    );

    // Step 12: 终章（上）·断霄岭流月城决战前快照保存与破除沈夜矩木护盾 (q08 断霄岭)
    const moveLiuyue = await client.send({
      cmd: 'move_to',
      x: 1550.0,
      z: -1250.0,
      max_steps: 400,
    });
    assert.equal(moveLiuyue.region, 'q08');
    checkStage(moveLiuyue, 880);

    const saved = await client.send({ cmd: 'save_checkpoint', slot: 'before_shenye' });
    assert.equal(saved.event, 'checkpoint_saved:before_shenye');

    let battleShenye = await client.send({ cmd: 'interact', target: 'boss_shenye' });
    assert.equal(battleShenye.combat.active, true);
    assert.equal(battleShenye.combat.shield_broken, false);

    // 切换闻人羽施展格挡反击与重击破除沈夜矩木护盾
    await client.send({ cmd: 'switch_leader', index: 1 });
    await client.send({ cmd: 'combat_action', action: 'guard' });
    battleShenye = await client.send({ cmd: 'combat_action', action: 'heavy' });
    assert.equal(battleShenye.combat.shield_broken, true);
    console.log(
      `[PASS] 12. 终章（上）·断霄岭流月城决战【沈夜】破除矩木护盾: 闻人羽格挡反击+重击击碎护盾 (累计破盾=${battleShenye.combat.shields_broken} 次)`,
    );

    // Step 13: 终章（中）·四主角无缝切换领队与星蕴终结技四连携击败【沈夜 & 心魔砺缨】 (stage 880 -> 950)
    await client.send({ cmd: 'combat_action', action: 'dodge' });
    for (let idx = 0; idx < 4; idx++) {
      const sw = await client.send({ cmd: 'switch_leader', index: idx });
      assert.equal(sw.leader.index, idx);
      if (sw.combat.active) {
        battleShenye = await client.send({ cmd: 'combat_action', action: 'ultimate' });
      }
    }
    while (battleShenye.combat.active) {
      battleShenye = await client.send({ cmd: 'combat_action', action: 'ultimate' });
    }
    assert.equal(battleShenye.combat.victories, 3);
    assert.ok(battleShenye.combat.ultimates_triggered >= 4);
    assert.equal(battleShenye.party[0].level, 60);
    checkStage(battleShenye, 950);
    console.log(
      `[PASS] 13. 终章（中）·四主角无缝切换与星蕴终结技【金刚力士 / 流光 / 太极 / 山鬼】决战告捷: 全队 Lv.${battleShenye.party[0].level}, 终结技释放=${battleShenye.combat.ultimates_triggered} 次`,
    );

    // Step 14: 终章（下）·触发《永夜初晗凝碧天》大结局通关、原版全剧本演绎与【星海忆念】支线验证 (game_cleared = true, stage = 1000)
    await client.send({ cmd: 'move_to', x: 1525.0, z: -1225.0, max_steps: 60 });
    const echoShenxi = await client.send({ cmd: 'trigger_echo', echo_id: 'echo_q08_shenxi' });
    assert.ok(echoShenxi.story.echoes_discovered.includes('echo_q08_shenxi'));
    await client.send({ cmd: 'interact' });

    await client.send({ cmd: 'move_to', x: 1550.0, z: -1250.0, max_steps: 60 });
    const grandEnding = await client.send({ cmd: 'interact', target: 'altar_grand_ending' });
    assert.equal(grandEnding.game_cleared, true);
    assert.equal(grandEnding.discovered_regions.length, 9);
    assert.ok(grandEnding.story.scenes_viewed_count >= 12);
    assert.ok(grandEnding.story.lines_read >= 30);
    assert.ok(grandEnding.cutscene.camera_cuts >= 25);
    checkStage(grandEnding, 1000);
    console.log(
      `[PASS] 14. 终章（下）·《永夜初晗凝碧天》大结局通关: game_cleared=${grandEnding.game_cleared}, 九域=${grandEnding.discovered_regions.length}/9, 原版剧目=${grandEnding.story.scenes_viewed_count}/12, 台词=${grandEnding.story.lines_read}句, 运镜切镜=${grandEnding.cutscene.camera_cuts}次`,
    );

    // Step 15: 内存快照毫秒级回滚验证 (load_checkpoint)
    const t0 = performance.now();
    const restored = await client.send({ cmd: 'load_checkpoint', slot: 'before_shenye' });
    const restoreMs = (performance.now() - t0).toFixed(2);
    assert.equal(restored.event, 'checkpoint_loaded:before_shenye');
    assert.equal(restored.game_cleared, false);
    checkStage(restored, 880);
    console.log(
      `[PASS] 15. 内存快照毫秒级回滚验证 (save_checkpoint / load_checkpoint): 耗时 ${restoreMs}ms 恢复至沈夜决战前状态`,
    );

    console.log('========================================================================');
    console.log(`  ALL 15/15 GUJIAN-2 CAMPAIGN CHECKS PASSED [mode=${mode}]`);
    console.log('========================================================================');
  } finally {
    client.close();
  }
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
