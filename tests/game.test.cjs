'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.cjs');

function lineUp(game, gap = 40) {
  const { player, enemy } = game.api.state();
  player.x = 300; enemy.x = 300 + gap; player.y = enemy.y = 280;
  player.vx = player.vy = enemy.vx = enemy.vy = 0;
  return { player, enemy };
}

function winByPin(game, winner = 'player') {
  const fighters = lineUp(game);
  const attacker = fighters[winner];
  const defender = fighters[winner === 'player' ? 'enemy' : 'player'];
  defender.invuln = 0;
  assert.equal(game.api.dealHit(attacker, defender, defender.hp), true);
  game.api.grab(attacker, defender);
  assert.ok(game.api.state().pin, 'a close grab starts a pin after the knockout');
  game.advance(3.2);
}

test('countdown starts at three and can be paused without skipping the start', () => {
  const game = boot();
  game.click('startButton');
  assert.equal(game.byId.get('countdown').textContent, '3');
  game.advance(0.4);
  game.keyTap('KeyP');
  const countdown = game.api.state().countdown;
  assert.equal(game.api.state().mode, 'paused');
  game.advance(8);
  assert.equal(game.api.state().countdown, countdown);
  game.click('resumeButton');
  assert.equal(game.api.state().mode, 'countdown');
  const beforeReady = game.api.state().player.x;
  game.keyDown('KeyD');
  game.advance(3);
  assert.equal(game.api.state().mode, 'playing');
  assert.equal(game.byId.get('countdown').classList.contains('hidden'), true);
  assert.ok(game.api.state().player.x > beforeReady, 'a direction held through READY remains active');
  game.keyUp('KeyD');
});

test('local versus gives each player independent controls and never drives the second player with AI', () => {
  const game = boot(); game.start('versus');
  const { player, enemy } = game.api.state();
  const p1x = player.x, p2x = enemy.x;
  game.advance(4);
  assert.equal(player.x, p1x); assert.equal(enemy.x, p2x);
  assert.equal(player.hp, player.def.hp); assert.equal(enemy.hp, enemy.def.hp);
  game.keyDown('KeyD'); game.advance(0.25); game.keyUp('KeyD');
  assert.ok(player.x > p1x); assert.equal(enemy.x, p2x);
  const playerAfterMove = player.x;
  game.keyDown('ArrowLeft'); game.advance(0.25); game.keyUp('ArrowLeft');
  assert.equal(player.x, playerAfterMove); assert.ok(enemy.x < p2x);
  assert.equal(player.controller, 0); assert.equal(enemy.controller, 1);
});

test('releasing touch does not cancel a held keyboard input; pointer cancellation stops touch movement', () => {
  const game = boot(); game.start('versus');
  const right = game.document.querySelector('[data-control="right"]');
  game.keyDown('KeyD');
  game.dispatch(right, 'pointerdown', { pointerId: 7 });
  game.advance(0.1);
  game.dispatch(right, 'pointerup', { pointerId: 7 });
  const afterTouchRelease = game.api.state().player.x;
  game.advance(0.1);
  assert.ok(game.api.state().player.x > afterTouchRelease, 'keyboard is still held');
  game.keyUp('KeyD');
  const afterKeyboardRelease = game.api.state().player.x;
  game.advance(0.1);
  assert.equal(game.api.state().player.x, afterKeyboardRelease);
  game.dispatch(right, 'pointerdown', { pointerId: 8 });
  game.advance(0.1);
  game.dispatch(right, 'pointercancel', { pointerId: 8 });
  const cancelledAt = game.api.state().player.x;
  game.advance(0.2);
  assert.equal(game.api.state().player.x, cancelledAt);
  assert.equal(right.classList.contains('pressed'), false);
});

test('melee attacks respect range and cooldowns', () => {
  const game = boot(); game.start('versus');
  let { player, enemy } = lineUp(game, 200);
  const hp = enemy.hp;
  game.api.punch(player, enemy); game.api.grab(player, enemy);
  assert.equal(enemy.hp, hp); assert.equal(game.api.state().pin, null);
  game.advance(0.6);
  ({ player, enemy } = lineUp(game));
  game.api.punch(player, enemy);
  assert.ok(enemy.hp < hp);
  const afterFirst = enemy.hp;
  game.api.punch(player, enemy);
  assert.equal(enemy.hp, afterFirst, 'a second immediate punch cannot bypass its cooldown');
});

test('specials cost sixty energy, have a windup, and can be interrupted', () => {
  const game = boot(); game.start('versus');
  const { player, enemy } = lineUp(game, 100);
  player.energy = 59;
  game.api.special(player, enemy);
  assert.equal(player.cast, 0); assert.equal(game.api.state().projectiles.length, 0);
  game.advance(0.4); player.energy = 100;
  game.api.special(player, enemy);
  assert.equal(player.energy, 40); assert.ok(player.cast > 0);
  assert.equal(game.api.state().projectiles.length, 0, 'the projectile does not appear before the telegraph');
  game.api.special(player, enemy); assert.equal(player.energy, 40);
  game.api.dealHit(enemy, player, 5);
  game.advance(0.8);
  assert.equal(player.cast, 0); assert.equal(game.api.state().projectiles.length, 0);
});

test('a beetle charge stops when its owner is hit and cannot overwrite knockback', () => {
  const game = boot(); game.api.selectFighter(3); game.start('versus');
  const { player, enemy } = lineUp(game, 300);
  game.api.special(player, enemy);
  game.api.updateFighter(player, enemy, 0.36);
  assert.equal(game.api.state().projectiles.length, 1);
  game.api.updateProjectiles(1 / 60);
  game.api.dealHit(enemy, player, 5);
  const positionAtHit = player.x;
  game.api.updateProjectiles(1 / 60);
  assert.equal(game.api.state().projectiles.length, 0);
  assert.equal(player.x, positionAtHit, 'the interrupted charge no longer moves its owner');
});

test('projectile destruction and knockback are consistent at thirty and sixty simulation steps per second', () => {
  function simulate(step) {
    const game = boot(); game.start('versus');
    const { player, enemy, buildings } = game.api.state();
    player.x = 200; enemy.x = 650; player.y = enemy.y = 280;
    buildings.length = 0;
    buildings.push({ x: 300, y: 280, w: 35, h: 40, health: 1, destroyed: false });
    game.api.fireSpecial(player, enemy);
    for (let i = 0; i < Math.round(0.5 / step); i++) game.api.updateProjectiles(step);
    const health = buildings[0].health;
    player.vx = 320; player.vy = 70;
    for (let i = 0; i < Math.round(0.5 / step); i++) game.api.updateFighter(player, enemy, step);
    return { health, x: player.x, y: player.y };
  }
  const at60 = simulate(1 / 60), at30 = simulate(1 / 30);
  assert.ok(Math.abs(at60.health - at30.health) < 1e-9);
  assert.ok(Math.abs(at60.x - at30.x) < 1e-9);
  assert.ok(Math.abs(at60.y - at30.y) < 1e-9);
});

test('a knockout only wins after a three-second pin, and a held punch does not block pinning', () => {
  const game = boot(); game.start('versus');
  const { player, enemy } = lineUp(game);
  game.api.dealHit(player, enemy, enemy.hp);
  assert.equal(enemy.down, 7); assert.equal(game.api.state().mode, 'playing');
  game.keyDown('KeyJ'); game.keyDown('KeyK');
  game.advance(0.15);
  assert.ok(game.api.state().pin);
  game.advance(2.5);
  assert.equal(game.api.state().mode, 'playing');
  game.advance(0.7);
  assert.equal(game.api.state().mode, 'result');
  assert.match(game.byId.get('resultTitle').textContent, /1P/);
  assert.equal(game.byId.get('resultOverlay').classList.contains('hidden'), false);
});

for (const [name, defenderName, code] of [['1P', 'player', 'KeyJ'], ['2P', 'enemy', 'Comma']]) {
  test(`${name} needs eight fresh attack presses to escape; auto-repeat is not counted`, () => {
    const game = boot(); game.start('versus');
    const fighters = lineUp(game);
    const defender = fighters[defenderName], attacker = fighters[defenderName === 'player' ? 'enemy' : 'player'];
    game.api.dealHit(attacker, defender, defender.hp);
    game.api.beginPin(attacker, defender);
    game.keyDown(code); game.advance(0.12);
    for (let i = 0; i < 10; i++) { game.keyDown(code, true); game.advance(1 / 60); }
    assert.ok(game.api.state().pin); assert.equal(game.api.state().pin.escapes, 1);
    game.keyUp(code);
    for (let i = 0; i < 6; i++) game.keyTap(code);
    assert.ok(game.api.state().pin, 'seven taps are insufficient');
    game.keyTap(code); game.advance(0.05);
    assert.equal(game.api.state().pin, null); assert.equal(defender.down, 0);
    assert.ok(defender.hp > 0); assert.ok(defender.invuln > 0);
  });
}

test('an unpinned monster stands back up after seven seconds, never wins or loses just from zero health', () => {
  const game = boot(); game.start('versus');
  const { player, enemy } = lineUp(game, 150);
  game.api.dealHit(player, enemy, enemy.hp);
  game.advance(6.8);
  assert.ok(enemy.down > 0); assert.equal(enemy.hp, 0);
  game.advance(0.4);
  assert.equal(enemy.down, 0); assert.equal(enemy.hp, Math.ceil(enemy.def.hp * 0.22));
  assert.equal(game.api.state().mode, 'playing');
});

test('pause, browser blur, and page hiding freeze combat and clear both players input', () => {
  const game = boot(); game.start('versus');
  for (const trigger of ['pause', 'blur', 'hidden']) {
    game.keyDown('KeyD'); game.keyDown('ArrowLeft'); game.advance(0.1);
    if (trigger === 'pause') game.click('pauseButton');
    if (trigger === 'blur') game.dispatch(game.window, 'blur');
    if (trigger === 'hidden') { game.document.hidden = true; game.dispatch(game.document, 'visibilitychange'); }
    const state = game.api.state();
    const snapshot = { elapsed: state.elapsed, x1: state.player.x, x2: state.enemy.x };
    assert.equal(state.mode, 'paused');
    assert.ok(state.controlSources.every(map => map.size === 0));
    game.advance(3);
    assert.equal(game.api.state().elapsed, snapshot.elapsed);
    assert.equal(state.player.x, snapshot.x1); assert.equal(state.enemy.x, snapshot.x2);
    game.document.hidden = false; game.click('resumeButton'); game.advance(0.1);
    assert.equal(state.player.x, snapshot.x1); assert.equal(state.enemy.x, snapshot.x2);
  }
});

test('closing help resumes a running game but does not resume an already-paused game', () => {
  const game = boot(); game.start('versus');
  game.click('helpButton');
  assert.equal(game.api.state().mode, 'paused'); assert.equal(game.byId.get('helpDialog').open, true);
  game.click('gotIt'); assert.equal(game.api.state().mode, 'playing');
  game.click('pauseButton'); game.click('settingsButton'); game.click('closeSettings');
  assert.equal(game.api.state().mode, 'paused');
  game.click('resumeButton'); assert.equal(game.api.state().mode, 'playing');
});

test('arcade advances through all three distinct cities, carries total score, and restarts cleanly after completion', () => {
  const game = boot(); game.start('arcade');
  const themes = [], opponents = [];
  let previousScore = 0;
  for (let index = 0; index < 3; index++) {
    const state = game.api.state();
    assert.equal(state.stageIndex, index); themes.push(state.buildings[0].theme); opponents.push(state.enemy.def.id);
    winByPin(game);
    assert.equal(game.api.state().mode, 'result'); assert.ok(game.api.state().score > previousScore);
    previousScore = game.api.state().score;
    assert.equal(game.api.state().pendingNext, index < 2);
    if (index < 2) {
      game.click('againButton');
      assert.equal(game.api.state().score, previousScore);
      assert.equal(game.api.state().player.hp, game.api.state().player.def.hp);
      assert.equal(game.api.state().pin, null); game.advance(3.2);
    }
  }
  assert.equal(new Set(themes).size, 3); assert.equal(new Set(opponents).size, 3);
  assert.equal(game.api.state().completedRuns, 1);
  assert.match(game.byId.get('resultKicker').textContent, /COMPLETE/);
  assert.ok(Number(game.storage.get('kaiju-city-best-v2')) >= previousScore);
  game.click('againButton');
  assert.equal(game.api.state().stageIndex, 0); assert.equal(game.api.state().score, 0);
  assert.equal(game.api.state().pin, null); assert.equal(game.api.state().runElapsed, 0);
});

test('losing a later arcade stage retries from the first city rather than carrying a stale victory', () => {
  const game = boot(); game.start('arcade'); winByPin(game);
  game.click('againButton'); game.advance(3.2);
  assert.equal(game.api.state().stageIndex, 1);
  winByPin(game, 'enemy');
  assert.equal(game.api.state().pendingNext, false); assert.equal(game.api.state().runFinished, true);
  game.click('againButton');
  assert.equal(game.api.state().stageIndex, 0); assert.equal(game.api.state().score, 0);
  assert.equal(game.api.state().player.hp, game.api.state().player.def.hp);
});

test('a versus rematch cycles arenas while resetting both players and round stats', () => {
  const game = boot(); game.start('versus'); winByPin(game, 'enemy');
  assert.match(game.byId.get('resultTitle').textContent, /2P/);
  const previousTheme = game.api.state().buildings[0].theme;
  game.click('againButton');
  const state = game.api.state();
  assert.notEqual(state.buildings[0].theme, previousTheme);
  assert.equal(state.score, 0); assert.equal(state.maxCombo, 0);
  assert.equal(state.player.hp, state.player.def.hp); assert.equal(state.enemy.hp, state.enemy.def.hp);
  assert.equal(state.player.controller, 0); assert.equal(state.enemy.controller, 1);
});

test('practice has no timeout, a passive dummy, regenerating energy, and repeatable pins', () => {
  const game = boot(); game.start('practice');
  let { player, enemy } = game.api.state();
  const dummyPosition = { x: enemy.x, y: enemy.y };
  player.energy = 0;
  game.advance(100);
  assert.equal(game.api.state().mode, 'playing'); assert.ok(game.api.state().elapsed > 90);
  assert.equal(enemy.x, dummyPosition.x); assert.equal(enemy.y, dummyPosition.y);
  assert.equal(player.hp, player.def.hp); assert.equal(player.energy, 100);
  winByPin(game);
  assert.equal(game.api.state().mode, 'playing'); assert.equal(game.api.state().pin, null);
  assert.equal(game.api.state().enemy.hp, game.api.state().enemy.def.hp);
  game.click('practiceResetButton');
  ({ player, enemy } = game.api.state());
  assert.equal(game.api.state().elapsed, 0); assert.equal(game.api.state().score, 0);
  assert.equal(player.hp, player.def.hp); assert.equal(enemy.hp, enemy.def.hp);
});

test('round timeout compares health percentages and lets an in-progress pin finish', () => {
  const game = boot(); game.start('versus');
  let { player, enemy } = game.api.state();
  player.hp = player.def.hp * 0.5; enemy.hp = enemy.def.hp * 0.4;
  game.advance(90);
  assert.equal(game.api.state().mode, 'result'); assert.match(game.byId.get('resultTitle').textContent, /1P/);
  game.click('againButton'); game.advance(3.2); game.advance(88.8);
  ({ player, enemy } = lineUp(game));
  game.api.dealHit(player, enemy, enemy.hp); game.api.grab(player, enemy);
  game.advance(1.2);
  assert.ok(game.api.state().elapsed >= 90); assert.ok(game.api.state().pin);
  assert.equal(game.api.state().mode, 'playing');
  game.advance(2.1);
  assert.equal(game.api.state().mode, 'result'); assert.match(game.byId.get('resultReason').textContent, /压制/);
});

test('very short action taps fire once on the next tick without leaking through pause or pinning', () => {
  const attackGame = boot(); attackGame.start('versus');
  let { player, enemy } = lineUp(attackGame);
  const initialHp = enemy.hp;
  attackGame.keyDown('KeyJ'); attackGame.keyUp('KeyJ');
  assert.equal(enemy.hp, initialHp, 'input is processed by the simulation, not by the DOM handler');
  attackGame.advance(1 / 60);
  assert.ok(enemy.hp < initialHp, 'a tap shorter than one frame still attacks');
  const afterTap = enemy.hp;
  attackGame.advance(0.8);
  assert.equal(enemy.hp, afterTap, 'the released action is consumed once');

  const specialGame = boot(); specialGame.start('versus');
  ({ player, enemy } = lineUp(specialGame, 300));
  player.energy = 100;
  specialGame.keyDown('KeyL'); specialGame.keyUp('KeyL');
  specialGame.advance(1 / 60);
  assert.equal(player.energy, 40); assert.ok(player.cast > 0);
  specialGame.advance(2);
  player.energy = 100;
  specialGame.advance(4);
  assert.equal(player.energy, 100); assert.equal(player.cast, 0);
  assert.equal(specialGame.api.state().projectiles.length, 0);

  const pauseGame = boot(); pauseGame.start('versus');
  ({ player, enemy } = lineUp(pauseGame));
  const beforePause = enemy.hp;
  pauseGame.keyDown('KeyJ'); pauseGame.keyUp('KeyJ');
  pauseGame.click('pauseButton'); pauseGame.click('resumeButton');
  pauseGame.advance(0.2);
  assert.equal(enemy.hp, beforePause); assert.equal(player.attackCd, 0);

  const pinGame = boot(); pinGame.start('versus');
  ({ player, enemy } = lineUp(pinGame));
  pinGame.api.dealHit(enemy, player, player.hp);
  pinGame.api.beginPin(enemy, player); pinGame.advance(0.1);
  for (let i = 0; i < 8; i++) {
    pinGame.keyDown('KeyJ'); pinGame.keyUp('KeyJ'); pinGame.advance(1 / 60);
  }
  assert.equal(pinGame.api.state().pin, null);
  pinGame.advance(0.1);
  assert.equal(player.attackCd, 0, 'escape taps must not become attacks after the pin ends');
  assert.equal(player.pose, 'idle');
});
