// ISEKAI: milestone 1 core prototype.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Input, isTouch } from './input.js';
import { World, heightAt } from './world.js';
import { buildCharacter, captureGrip } from './characters.js';
import { Player } from './player.js';
import { spawnSlimes } from './enemies.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';

const quality = isTouch
  ? { pixelRatio: Math.min(devicePixelRatio, 1.5), shadows: true, shadowSize: 1024, dense: false }
  : { pixelRatio: Math.min(devicePixelRatio, 2), shadows: true, shadowSize: 2048, dense: true };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(quality.pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Third-person orbit camera with collision-free smoothing and screen shake.
class CameraRig {
  constructor(cam) { this.cam = cam; this.yaw = 0; this.pitch = 0.32; this.dist = isTouch ? 6.2 : 5.6; this.shakeT = 0; this.target = new THREE.Vector3(); }
  shake(a) { this.shakeT = Math.max(this.shakeT, a); }
  update(dt, input, focus) {
    this.yaw -= input.look.dx; this.pitch = THREE.MathUtils.clamp(this.pitch + input.look.dy, -0.15, 1.05);
    this.target.lerp(focus.clone().add(new THREE.Vector3(0, 1.5, 0)), 1 - Math.pow(0.0001, dt));
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist);
    const p = this.target.clone().add(off);
    p.y = Math.max(p.y, heightAt(p.x, p.z) + 0.4);
    this.cam.position.copy(p);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const s = this.shakeT * 0.6;
      this.cam.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    this.cam.lookAt(this.target);
  }
}

const loadFill = document.getElementById('load-fill');
const loadText = document.getElementById('load-text');
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => { loadFill.style.width = (loaded / total * 100) + '%'; };
const loader = new GLTFLoader(manager);
loader.setMeshoptDecoder(MeshoptDecoder);

async function boot() {
  const [jasperG, a1, a2, natureG] = await Promise.all([
    loader.loadAsync('assets/models/jasper.glb'),
    loader.loadAsync('assets/models/anims1.glb'),
    loader.loadAsync('assets/models/anims2.glb'),
    loader.loadAsync('assets/models/nature.glb'),
  ]);
  loadText.textContent = 'Player One detected...';
  const clips = [...a1.animations, ...a2.animations];
  const idle = clips.find(c => c.name === 'Idle_Loop');

  const world = new World(scene, natureG, quality);
  const effects = new Effects(scene);
  const rig = new CameraRig(camera);
  const hud = new Hud(camera);
  const enemies = spawnSlimes(scene);
  let hitStop = 0;
  let kills = 0;
  const ctx = {
    world, effects, hud, enemies, camera: rig,
    hitStop: t => { hitStop = Math.max(hitStop, t); },
    onKill: () => {
      kills++;
      if (kills === 3) hud.objective('Tip: block (Q) right as a slime lunges to PARRY and stun it.');
      if (kills === 8) hud.objective('Starter Meadow cleared! (Slimes respawn for practice.)');
    },
  };
  const jasper = buildCharacter(jasperG, 'jasper', idle);
  jasper.grip = captureGrip(jasper.root, clips.find(c => c.name === 'Sword_Idle'));
  const player = new Player(jasper, clips, scene, ctx);
  rig.yaw = player.facing + Math.PI;

  const input = new Input(canvas);
  document.getElementById('loading').classList.add('hidden');
  hud.show();
  hud.system('> PLAYER ONE DETECTED\n> WELCOME TO ASTER', 3.2);
  if (!isTouch) setTimeout(() => hud.system('> Click the screen to look around', 2.5), 3600);

  const clock = new THREE.Clock();
  let t = 0;
  renderer.setAnimationLoop(() => {
    let dt = Math.min(clock.getDelta(), 1 / 20);
    t += dt;
    input.update();
    if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }
    player.update(dt, input, rig.yaw);
    for (const e of enemies) {
      const atk = e.update(dt, t, player, world);
      if (atk && player.pos.distanceTo(e.pos) < 2.1) player.damage(atk.damage, atk.from, atk.enemy);
    }
    // Bodies don't overlap: push Jasper and slimes apart.
    for (const e of enemies) {
      if (!e.alive || !player.alive) continue;
      const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z, d = Math.hypot(dx, dz), min = 1.0;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2, nx = dx / d, nz = dz / d;
        player.pos.x += nx * push; player.pos.z += nz * push;
        if (e.frozen <= 0) { e.pos.x -= nx * push; e.pos.z -= nz * push; } else { player.pos.x += nx * push; player.pos.z += nz * push; }
      }
    }
    effects.update(dt);
    world.update(dt, t, player.pos);
    rig.update(dt, input, player.pos);
    // Fade slimes that get between the camera and Jasper.
    for (const e of enemies) {
      const near = camera.position.distanceTo(e.group.position) < 3.2;
      e.mat.opacity += ((near ? 0.25 : 0.92) - e.mat.opacity) * Math.min(1, dt * 10);
    }
    hud.update(dt, player);
    input.endFrame();
    renderer.render(scene, camera);
  });
  window.__game = { player, enemies, rig, scene, renderer };
}

boot().catch(err => {
  console.error(err);
  loadText.textContent = 'Failed to load: ' + err.message;
});
