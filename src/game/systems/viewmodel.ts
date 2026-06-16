import * as THREE from "three";
import type { GameContext, GameModule } from "@/game/core/types";
import { SystemOrder } from "@/game/core/types";
import { playerRuntime, weaponRuntime } from "@/game/state/runtime";
import { useWeaponStore } from "@/game/state/weaponStore";
import { WeaponType } from "@/game/weapons/types";
import { WEAPONS } from "@/game/weapons/defs";
import { buildWeapon, type WeaponModel } from "@/game/weapons/models";

const lerp = THREE.MathUtils.lerp;

// Hip pose (camera-local). ADS pose is derived per weapon so the sight lands on
// the camera centre line (no gun obstructing the optic).
const HIP = new THREE.Vector3(0.16, -0.17, -0.42);
const ADS_AIM_Z = -0.17;

// Melee: resting pose + a fixed-duration slash arc (seconds). The slash is a
// keyframed windup → strike → recover, retriggered on each swing.
const MELEE_IDLE_POS = new THREE.Vector3(0.15, -0.1, -0.4);
const MELEE_IDLE_ROT = new THREE.Vector3(-0.2, 1.1, 0.72);
const MELEE_SLASH_TIME = 0.32;
// Offsets (relative to idle) at the windup peak (A) and the end of the strike (B).
const SLASH_A = { x: 0.05, y: 0.07, z: 0.02, rx: -0.4, ry: -0.28, rz: 0.62 };
const SLASH_B = { x: -0.2, y: -0.14, z: -0.13, rx: 0.46, ry: 0.42, rz: -1.0 };
const easeIn = (k: number): number => k * k;
const easeOut = (k: number): number => 1 - (1 - k) * (1 - k);

const ALL: ReadonlyArray<WeaponType> = [
  WeaponType.Pistol,
  WeaponType.AR,
  WeaponType.Sniper,
  WeaponType.Knife,
];

const currentWeapon = (): WeaponType => useWeaponStore.getState().current;

/**
 * First-person viewmodel. A root group tracks the camera (runs after the
 * camera system); a child `hold` group applies the FSM-driven pose: ADS blend,
 * recoil kick, reload dip + magazine drop, slide travel, switch raise, and a
 * speed-based weapon bob. Hidden in third person. Publishes the muzzle world
 * position for tracer/flash origins.
 */
export class ViewmodelSystem implements GameModule {
  readonly id = "system.viewmodel";
  readonly order = SystemOrder.Camera + 5; // after the camera has posed

  private cam: THREE.PerspectiveCamera | null = null;
  private scene: THREE.Scene | null = null;
  private readonly root = new THREE.Group();
  private readonly hold = new THREE.Group();
  private readonly models = new Map<WeaponType, WeaponModel>();
  private current: WeaponType = WeaponType.Pistol;
  private bob = 0;
  // Melee slash animator state.
  private slashT = 0;
  private slashing = false;
  private prevRecoil = 0;
  private armGeo: THREE.BufferGeometry | null = null;
  private armMat: THREE.Material | null = null;

  init(ctx: GameContext): void {
    this.cam = ctx.camera;
    this.scene = ctx.scene;
    this.root.add(this.hold);
    this.scene.add(this.root);

    for (const t of ALL) {
      const model = buildWeapon(t);
      model.group.visible = false;
      this.hold.add(model.group);
      this.models.set(t, model);
    }

    // shared forearms (persist across weapon swaps)
    this.armGeo = new THREE.CapsuleGeometry(0.05, 0.26, 4, 8);
    this.armMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.8, metalness: 0.05 });
    const armL = new THREE.Mesh(this.armGeo, this.armMat);
    armL.position.set(-0.07, -0.26, 0.06);
    armL.rotation.set(1.15, 0, 0.25);
    const armR = new THREE.Mesh(this.armGeo, this.armMat);
    armR.position.set(0.12, -0.27, 0.05);
    armR.rotation.set(1.2, 0, -0.2);
    this.hold.add(armL, armR);

    this.current = currentWeapon();
    const cur = this.models.get(this.current);
    if (cur) cur.group.visible = true;
  }

  update(dt: number): void {
    const cam = this.cam;
    if (!cam) return;

    // Swap visible weapon when the store changes.
    const wanted = currentWeapon();
    if (wanted !== this.current) {
      const prev = this.models.get(this.current);
      if (prev) prev.group.visible = false;
      this.current = wanted;
      const next = this.models.get(wanted);
      if (next) next.group.visible = true;
    }

    // Follow the camera exactly.
    this.root.position.copy(cam.position);
    this.root.quaternion.copy(cam.quaternion);

    const ads = weaponRuntime.ads;
    const recoil = weaponRuntime.recoil;
    const rl = weaponRuntime.reload;
    const raise = 1 - weaponRuntime.switchT; // 1 when fully lowered
    const model = this.models.get(this.current);

    const speed = Math.min(Math.hypot(playerRuntime.velocity.x, playerRuntime.velocity.z), 7);
    this.bob += 0.016 * speed * 1.3;
    const bobX = Math.cos(this.bob) * 0.004 * speed * (1 - ads);
    const bobY = Math.abs(Math.sin(this.bob)) * 0.006 * speed * (1 - ads);

    const reloadDip = Math.sin(Math.min(rl, 1) * Math.PI) * 0.12;
    const reloadRot = Math.sin(Math.min(rl, 1) * Math.PI) * 0.5;

    const meleeW = WEAPONS[this.current].melee;
    if (meleeW) {
      // Retrigger the slash on a swing (recoil rising edge), then advance the
      // animator on its own timeline - decoupled from the short recoil decay.
      if (recoil > this.prevRecoil + 0.01) {
        this.slashing = true;
        this.slashT = 0;
      }
      if (this.slashing) {
        this.slashT += dt / MELEE_SLASH_TIME;
        if (this.slashT >= 1) {
          this.slashT = 1;
          this.slashing = false;
        }
      }

      // Keyframed windup (ease-out) → strike (ease-in) → recover (ease-out).
      let ox = 0, oy = 0, oz = 0, orx = 0, ory = 0, orz = 0;
      const t = this.slashT;
      if (this.slashing || t > 0) {
        if (t < 0.25) {
          const e = easeOut(t / 0.25);
          ox = SLASH_A.x * e; oy = SLASH_A.y * e; oz = SLASH_A.z * e;
          orx = SLASH_A.rx * e; ory = SLASH_A.ry * e; orz = SLASH_A.rz * e;
        } else if (t < 0.52) {
          const e = easeIn((t - 0.25) / 0.27);
          ox = lerp(SLASH_A.x, SLASH_B.x, e); oy = lerp(SLASH_A.y, SLASH_B.y, e); oz = lerp(SLASH_A.z, SLASH_B.z, e);
          orx = lerp(SLASH_A.rx, SLASH_B.rx, e); ory = lerp(SLASH_A.ry, SLASH_B.ry, e); orz = lerp(SLASH_A.rz, SLASH_B.rz, e);
        } else {
          const e = easeOut((t - 0.52) / 0.48);
          ox = lerp(SLASH_B.x, 0, e); oy = lerp(SLASH_B.y, 0, e); oz = lerp(SLASH_B.z, 0, e);
          orx = lerp(SLASH_B.rx, 0, e); ory = lerp(SLASH_B.ry, 0, e); orz = lerp(SLASH_B.rz, 0, e);
        }
      }

      this.hold.position.set(
        MELEE_IDLE_POS.x + ox + bobX,
        MELEE_IDLE_POS.y + oy + bobY - raise * 0.25,
        MELEE_IDLE_POS.z + oz,
      );
      this.hold.rotation.set(
        MELEE_IDLE_ROT.x + orx + raise * 0.3,
        MELEE_IDLE_ROT.y + ory,
        MELEE_IDLE_ROT.z + orz,
      );
    } else {
      // ADS target places the sight on the camera centre line.
      const so = model ? model.sightOffset : HIP;
      this.hold.position.set(
        lerp(HIP.x, -so.x, ads) + bobX,
        lerp(HIP.y, -so.y, ads) + bobY - raise * 0.25 - reloadDip,
        lerp(HIP.z, ADS_AIM_Z - so.z, ads) + recoil * 0.06,
      );
      this.hold.rotation.set(-recoil * 0.18 - reloadRot + raise * 0.3, 0, 0);
    }
    this.prevRecoil = recoil; // track for the melee rising-edge swing detector

    // Hide a scoped weapon's model at full ADS so the scope overlay reads clean.
    const scoped = WEAPONS[this.current].scope;
    this.root.visible = !(scoped && ads > 0.55);

    if (model) {
      model.slide.position.z = weaponRuntime.slide * 0.05; // travels back on fire
      const magDrop = Math.sin(Math.min(rl, 1) * Math.PI);
      model.mag.position.y = -magDrop * 0.18;
      model.mag.position.z = magDrop * 0.05;
      model.muzzle.getWorldPosition(weaponRuntime.muzzlePos);
    }
  }

  dispose(): void {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.armGeo?.dispose();
    this.armMat?.dispose();
    this.scene?.remove(this.root);
    this.cam = null;
    this.scene = null;
  }
}
