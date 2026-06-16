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

  update(): void {
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
      // knife slash arc driven by the recoil pulse (1 at strike, decays)
      const sw = recoil;
      this.hold.position.set(HIP.x * 0.5 + bobX, HIP.y + bobY - raise * 0.25 + sw * 0.05, HIP.z * 0.7 + sw * 0.12);
      this.hold.rotation.set(-sw * 0.8 + raise * 0.3, sw * 1.1, -sw * 0.6);
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
