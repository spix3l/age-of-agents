import * as THREE from 'three';
import { RTSCameraController } from './camera/RTSCameraController';
import { issueMoveCommand } from './commands/MoveCommand';
import { GameLoop } from './GameLoop';
import { GameState } from './GameState';
import { InputManager } from './input/InputManager';
import { NavigationGrid } from './navigation/NavigationGrid';
import { Renderer } from './rendering/Renderer';
import { createDay1Units } from './scenarios/day1';
import { MovementSystem } from './systems/MovementSystem';
import { SelectionSystem, type ScreenPoint } from './systems/SelectionSystem';
import { MAP_BOUNDS, WORLD_OBSTACLES } from './world/map';
import { WorldScene } from './world/WorldScene';
import { useUiStore } from '../ui/store';

export class Game {
  private readonly renderer: Renderer;
  private readonly world: WorldScene;
  private readonly camera: RTSCameraController;
  private readonly state = new GameState();
  private readonly navigation: NavigationGrid;
  private readonly movement: MovementSystem;
  private readonly selection: SelectionSystem;
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private disposed = false;

  constructor(container: HTMLElement) {
    this.renderer = new Renderer(container);
    this.world = new WorldScene();
    this.camera = new RTSCameraController(this.renderer.instance.domElement);
    this.navigation = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
    WORLD_OBSTACLES.forEach((obstacle) => this.navigation.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));
    this.movement = new MovementSystem(this.navigation);

    for (const unit of createDay1Units()) {
      this.state.units.add(unit);
      this.world.addUnit(unit);
    }
    useUiStore.getState().setTotalUnits(this.state.units.size);

    this.selection = new SelectionSystem(
      this.state.units,
      this.camera.camera,
      this.renderer.instance.domElement,
      this.world.selectableMeshes,
      (selected) => useUiStore.getState().setSelectedCount(selected.length),
    );
    this.input = new InputManager(this.renderer.instance.domElement, {
      selectPoint: (point, additive) => this.selection.selectPoint(point, additive),
      selectBox: (rect, additive) => this.selection.selectBox(rect, additive),
      move: this.issueMove,
      selectionBox: (rect) => useUiStore.getState().setSelectionBox(rect),
    });
    this.loop = new GameLoop(this.update, this.render);
  }

  start(): void { this.loop.start(); }
  setPaused(paused: boolean): void { this.loop.setPaused(paused); }

  restart(): void {
    this.selection.clear();
    this.state.reset();
    for (const unit of createDay1Units()) this.state.units.add(unit);
    this.loop.restart();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.dispose();
    this.input.dispose();
    this.camera.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.state.reset();
    useUiStore.getState().setSelectionBox(null);
  }

  private readonly update = (delta: number): void => {
    this.state.elapsedSeconds += delta;
    this.camera.update(delta);
    this.movement.update(this.state.units.alive(), delta);
  };

  private readonly render = (alpha: number): void => {
    this.world.syncUnits(this.state.units.all(), alpha);
    this.renderer.render(this.world.scene, this.camera.camera);
  };

  private readonly issueMove = (point: ScreenPoint): void => {
    const selected = this.selection.selected();
    if (selected.length === 0) return;
    const bounds = this.renderer.instance.domElement.getBoundingClientRect();
    this.pointer.set(((point.x - bounds.left) / bounds.width) * 2 - 1, -((point.y - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera.camera);
    const hit = this.raycaster.intersectObject(this.world.ground, false)[0];
    if (!hit) return;
    const target = { x: hit.point.x, z: hit.point.z };
    const result = issueMoveCommand(selected, target, this.navigation);
    if (result.issued > 0) {
      this.world.showMoveMarker(target.x, target.z);
      useUiStore.getState().setLastOrder(`MOVE // ${result.issued} AGENTS`);
    }
  };
}
