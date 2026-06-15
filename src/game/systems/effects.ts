import * as THREE from "three";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { FixedPool } from "@/game/utils/pool";

const TRACER_COUNT = 24;
const FLASH_COUNT = 12;
const TRACER_LIFE = 0.08;
const FLASH_LIFE = 0.05;

interface Tracer {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  life: number;
}
interface Flash {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  life: number;
  scale: number;
}

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

/**
 * Pooled gunfire FX — tracers, muzzle flashes, and a shared flash point light.
 * Everything is pre-allocated; firing only flips a slot active and sets a
 * transform. Spawned by WeaponSystem, faded out here. Runs late so it advances
 * the FX requested earlier this frame.
 */
export class FxSystem implements GameModule {
  readonly id = "system.fx";
  readonly order = SystemOrder.Entity;

  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private readonly root = new THREE.Group();
  private readonly flashLight = new THREE.PointLight(0xffd9a0, 0, 9, 2);
  private flashLightLife = 0;

  private tracers!: FixedPool<Tracer>;
  private flashes!: FixedPool<Flash>;
  private tracerGeo!: THREE.CylinderGeometry;
  private flashGeo!: THREE.PlaneGeometry;

  init(ctx: GameContext): void {
    this.scene = ctx.scene;
    this.camera = ctx.camera;
    this.root.name = "fx";
    this.scene.add(this.root);
    this.root.add(this.flashLight);

    // Unit-length tracer along +Z (scale Z to length).
    this.tracerGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 6);
    this.tracerGeo.rotateX(Math.PI / 2);
    this.tracers = FixedPool.create(TRACER_COUNT, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffcf8f,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.tracerGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      return { mesh, life: 0 };
    });

    this.flashGeo = new THREE.PlaneGeometry(0.5, 0.5);
    this.flashes = FixedPool.create(FLASH_COUNT, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(this.flashGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      return { mesh, life: 0, scale: 1 };
    });
  }

  spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const idx = this.tracers.acquire();
    if (idx < 0) return;
    _dir.subVectors(to, from);
    const len = _dir.length();
    if (len < 1e-3) {
      this.tracers.release(idx);
      return;
    }
    _dir.divideScalar(len);
    const t = this.tracers.items[idx];
    t.life = TRACER_LIFE;
    _mid.addVectors(from, to).multiplyScalar(0.5);
    t.mesh.position.copy(_mid);
    t.mesh.quaternion.copy(_q.setFromUnitVectors(_zAxis, _dir));
    t.mesh.scale.set(1, 1, len);
    t.mesh.material.color.setHex(color);
    t.mesh.material.opacity = 0.9;
    t.mesh.visible = true;
  }

  spawnMuzzleFlash(at: THREE.Vector3, color: number): void {
    const idx = this.flashes.acquire();
    if (idx < 0) return;
    const f = this.flashes.items[idx];
    f.life = FLASH_LIFE;
    f.scale = 0.32 + Math.random() * 0.22;
    f.mesh.position.copy(at);
    f.mesh.rotation.z = Math.random() * Math.PI;
    f.mesh.scale.setScalar(f.scale);
    f.mesh.material.color.setHex(color);
    f.mesh.material.opacity = 1;
    f.mesh.visible = true;

    this.flashLight.position.copy(at);
    this.flashLight.color.setHex(color);
    this.flashLight.intensity = 7;
    this.flashLightLife = FLASH_LIFE;
  }

  update(dt: number): void {
    const cam = this.camera;
    this.tracers.forEachActive((t, i) => {
      t.life -= dt;
      const k = Math.max(0, t.life / TRACER_LIFE);
      t.mesh.material.opacity = 0.9 * k;
      if (t.life <= 0) {
        t.mesh.visible = false;
        this.tracers.release(i);
      }
    });
    this.flashes.forEachActive((f, i) => {
      f.life -= dt;
      const k = Math.max(0, f.life / FLASH_LIFE);
      f.mesh.material.opacity = k;
      f.mesh.scale.setScalar(f.scale * (0.7 + 0.3 * k));
      if (cam) f.mesh.lookAt(cam.position);
      if (f.life <= 0) {
        f.mesh.visible = false;
        this.flashes.release(i);
      }
    });
    if (this.flashLightLife > 0) {
      this.flashLightLife -= dt;
      this.flashLight.intensity = 7 * Math.max(0, this.flashLightLife / FLASH_LIFE);
    }
  }

  dispose(): void {
    this.tracers.forEachActive((_t, i) => this.tracers.release(i));
    this.flashes.forEachActive((_f, i) => this.flashes.release(i));
    for (const t of this.tracers.items) t.mesh.material.dispose();
    for (const f of this.flashes.items) f.mesh.material.dispose();
    this.tracerGeo.dispose();
    this.flashGeo.dispose();
    this.scene?.remove(this.root);
    this.scene = null;
    this.camera = null;
  }
}
