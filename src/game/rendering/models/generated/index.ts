import type * as THREE from 'three';
import { createCoreKeepModel } from './createCoreKeepModel';
import { createMatterDepositModel } from './createMatterDepositModel';

/**
 * Factories reconstructed from `art/models/*.png` by the img2threejs pipeline, keyed by the crop
 * name in `art/models.json` so the Model Lab picks one up the moment it is registered here.
 *
 * These stay separate from the hand-written `buildings.ts` / `units.ts` / `resources.ts` models:
 * the game still renders those, and a generated model is adopted into the renderer only once it
 * has passed its review gates. Each factory builds its own geometry and materials rather than
 * drawing on the shared `ResourceCache`, so it carries no argument.
 */
export type GeneratedModelFactory = () => THREE.Group;

export const GENERATED_MODELS: Readonly<Record<string, GeneratedModelFactory>> = Object.freeze({
  core: () => createCoreKeepModel({ castShadow: true, receiveShadow: true }),
  matter: () => createMatterDepositModel({ castShadow: true, receiveShadow: true }),
});
