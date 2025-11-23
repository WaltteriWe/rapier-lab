import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RapierPhysics } from "three/examples/jsm/physics/RapierPhysics.js";
// import { RapierHelper } from "three/examples/jsm/helpers/RapierHelper.js"; // Not available in this Three.js version
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

let camera, scene, renderer, controls, stats;
let physics, physicsHelper;

// Controllers
let controller1, controller2;
let controllerGrip1, controllerGrip2;

const raycaster = new THREE.Raycaster();
const tempVec = new THREE.Vector3();

// Throwing mechanics
const tempPos = new THREE.Vector3();
const THROW_MULTIPLIER = 3; // adjust to control throw strength

// Teleport system
let marker, baseReferenceSpace;
let INTERSECTION;
const tempMatrix = new THREE.Matrix4();
let teleportgroup = new THREE.Group();
teleportgroup.name = "Teleport-Group";

// This group stores ALL pickable / physics-enabled meshes
const group = new THREE.Group();

init();

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202028);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.6, 3);

  const hemi = new THREE.HemisphereLight(0x555555, 0x111122, 1.0);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  scene.add(dirLight);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.update();

  stats = new Stats();
  document.body.appendChild(stats.dom);

  // Add group to scene
  scene.add(group);

  // Add teleport group to scene
  scene.add(teleportgroup);

  // Floor - thin box that looks like a ground plane
  const floorGeo = new THREE.BoxGeometry(50, 0.1, 50, 25, 1, 25);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a34,
    roughness: 0.8,
    metalness: 0.2,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add floor to teleport group so we can teleport on it
  teleportgroup.add(floor);

  // Add grid lines on the floor for detail
  const gridHelper = new THREE.GridHelper(50, 50, 0x3a5c44, 0x5a8c6a);
  gridHelper.position.y = 0.01; // Slightly above floor to prevent z-fighting
  scene.add(gridHelper);

  // Add some decorative elements on the floor
  const detailGeo = new THREE.BoxGeometry(0.5, 0.05, 0.5);
  const detailMat = new THREE.MeshStandardMaterial({ color: 0x3a5c44 });

  // Add random detail patches
  for (let i = 0; i < 15; i++) {
    const detail = new THREE.Mesh(detailGeo, detailMat);
    detail.position.set(
      (Math.random() - 0.5) * 45,
      0.03,
      (Math.random() - 0.5) * 45
    );
    detail.rotation.y = Math.random() * Math.PI;
    detail.receiveShadow = true;
    scene.add(detail);
  }

  // Create walls around the floor
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a5c44,
    roughness: 0.9,
    metalness: 0.1,
  });
  const wallHeight = 3;
  const wallThickness = 0.5;

  // North wall
  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(50, wallHeight, wallThickness, 25, 15, 1),
    wallMat
  );
  northWall.position.set(0, wallHeight / 2, -25);
  northWall.castShadow = true;
  northWall.receiveShadow = true;
  scene.add(northWall);

  // South wall
  const southWall = new THREE.Mesh(
    new THREE.BoxGeometry(50, wallHeight, wallThickness, 25, 15, 1),
    wallMat
  );
  southWall.position.set(0, wallHeight / 2, 25);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  scene.add(southWall);

  // East wall
  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, 50, 1, 15, 25),
    wallMat
  );
  eastWall.position.set(25, wallHeight / 2, 0);
  eastWall.castShadow = true;
  eastWall.receiveShadow = true;
  scene.add(eastWall);

  // West wall
  const westWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, 50, 1, 15, 25),
    wallMat
  );
  westWall.position.set(-25, wallHeight / 2, 0);
  westWall.castShadow = true;
  westWall.receiveShadow = true;
  scene.add(westWall);

  // Add decorative trim on top of walls
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x6b5344,
    roughness: 0.7,
    metalness: 0.3,
  });
  const trimHeight = 0.2;
  const trimWidth = 0.6;

  // North wall trim
  const northTrim = new THREE.Mesh(
    new THREE.BoxGeometry(50.2, trimHeight, trimWidth),
    trimMat
  );
  northTrim.position.set(0, wallHeight + trimHeight / 2, -25);
  northTrim.castShadow = true;
  scene.add(northTrim);

  // South wall trim
  const southTrim = new THREE.Mesh(
    new THREE.BoxGeometry(50.2, trimHeight, trimWidth),
    trimMat
  );
  southTrim.position.set(0, wallHeight + trimHeight / 2, 25);
  southTrim.castShadow = true;
  scene.add(southTrim);

  // East wall trim
  const eastTrim = new THREE.Mesh(
    new THREE.BoxGeometry(trimWidth, trimHeight, 50.2),
    trimMat
  );
  eastTrim.position.set(25, wallHeight + trimHeight / 2, 0);
  eastTrim.castShadow = true;
  scene.add(eastTrim);

  // West wall trim
  const westTrim = new THREE.Mesh(
    new THREE.BoxGeometry(trimWidth, trimHeight, 50.2),
    trimMat
  );
  westTrim.position.set(-25, wallHeight + trimHeight / 2, 0);
  westTrim.castShadow = true;
  scene.add(westTrim);

  // Add vertical support beams on walls
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x5a4433,
    roughness: 0.8,
    metalness: 0.2,
  });

  // Add beams to north and south walls
  for (let i = -2; i <= 2; i++) {
    const xPos = i * 10;

    // North wall beams
    const northBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, wallHeight, 0.3),
      beamMat
    );
    northBeam.position.set(xPos, wallHeight / 2, -24.9);
    northBeam.castShadow = true;
    scene.add(northBeam);

    // South wall beams
    const southBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, wallHeight, 0.3),
      beamMat
    );
    southBeam.position.set(xPos, wallHeight / 2, 24.9);
    southBeam.castShadow = true;
    scene.add(southBeam);
  }

  // Add beams to east and west walls
  for (let i = -2; i <= 2; i++) {
    const zPos = i * 10;

    // East wall beams
    const eastBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, wallHeight, 0.3),
      beamMat
    );
    eastBeam.position.set(24.9, wallHeight / 2, zPos);
    eastBeam.castShadow = true;
    scene.add(eastBeam);

    // West wall beams
    const westBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, wallHeight, 0.3),
      beamMat
    );
    westBeam.position.set(-24.9, wallHeight / 2, zPos);
    westBeam.castShadow = true;
    scene.add(westBeam);
  }

  // Create teleport marker
  const markerGeo = new THREE.RingGeometry(0.2, 0.3, 32);
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
  });
  marker = new THREE.Mesh(markerGeo, markerMat);
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  // Init physics
  await initPhysics(floor, northWall, southWall, eastWall, westWall);

  // Init VR
  initVR();

  window.addEventListener("resize", onWindowResize);

  renderer.setAnimationLoop(animate);
}

async function initPhysics(floor, northWall, southWall, eastWall, westWall) {
  physics = await RapierPhysics();
  physics.addScene(scene);

  physics.addMesh(floor, 0); // static

  // Add walls to physics (static, no mass)
  physics.addMesh(northWall, 0);
  physics.addMesh(southWall, 0);
  physics.addMesh(eastWall, 0);
  physics.addMesh(westWall, 0);

  const SPAWN_RANGE = 8; // width of the square in world units

  // Add some falling boxes
  for (let i = 0; i < 5; i++) {
    addBox(
      new THREE.Vector3(
        (Math.random() - 0.5) * SPAWN_RANGE,
        1.5 + i * 0.5,
        (Math.random() - 0.5) * SPAWN_RANGE
      )
    );
  }

  // Add some balls
  for (let i = 0; i < 3; i++) {
    addBall(
      new THREE.Vector3(
        (Math.random() - 0.5) * SPAWN_RANGE,
        2.0 + i * 0.6,
        (Math.random() - 0.5) * SPAWN_RANGE
      )
    );
  }

  // physicsHelper = new RapierHelper(physics.world); // RapierHelper not available in this Three.js version
  // scene.add(physicsHelper);
}

function addBox(position) {
  const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: Math.floor(Math.random() * 0xffffff),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.copy(position);

  // add to group so you can pick the object
  // adding to the group will add the object to the scene too,  (group is child of scene)
  group.add(mesh);

  physics.addMesh(mesh, 1, 0.2);
}

function addBall(position) {
  const geo = new THREE.SphereGeometry(0.3, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: Math.floor(Math.random() * 0xffffff),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.copy(position);

  // add to group so you can pick the object
  group.add(mesh);

  physics.addMesh(mesh, 1, 0.2);
}

// -----------------------------
//    VR SETUP
// -----------------------------

function initVR() {
  document.body.appendChild(VRButton.createButton(renderer));

  renderer.xr.addEventListener(
    "sessionstart",
    () => (baseReferenceSpace = renderer.xr.getReferenceSpace())
  );

  const controllerModelFactory = new XRControllerModelFactory();

  // Controller 1
  controller1 = renderer.xr.getController(0);
  controller1.addEventListener("selectstart", onSelectStart);
  controller1.addEventListener("selectend", onSelectEnd);
  controller1.addEventListener("squeezestart", onSqueezeStart);
  controller1.addEventListener("squeezeend", onSqueezeEnd);
  scene.add(controller1);

  // Controller 2
  controller2 = renderer.xr.getController(1);
  controller2.addEventListener("selectstart", onSelectStart);
  controller2.addEventListener("selectend", onSelectEnd);
  controller2.addEventListener("squeezestart", onSqueezeStart);
  controller2.addEventListener("squeezeend", onSqueezeEnd);
  scene.add(controller2);

  // Grips (visual models)
  controllerGrip1 = renderer.xr.getControllerGrip(0);
  controllerGrip1.add(
    controllerModelFactory.createControllerModel(controllerGrip1)
  );
  scene.add(controllerGrip1);

  controllerGrip2 = renderer.xr.getControllerGrip(1);
  controllerGrip2.add(
    controllerModelFactory.createControllerModel(controllerGrip2)
  );
  scene.add(controllerGrip2);

  // Laser lines
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);

  const line = new THREE.Line(lineGeo);
  line.name = "line";
  line.scale.z = 1.5;

  controller1.add(line.clone());
  controller2.add(line.clone());
}

// -----------------------------
//  XR SELECTION SYSTEM
// -----------------------------

function getIntersections(controller) {
  raycaster.setFromXRController(controller);

  return raycaster.intersectObjects(group.children, true);
}

function onSelectStart(event) {
  const controller = event.target;

  const intersections = getIntersections(controller);
  if (intersections.length === 0) return;

  const intersection = intersections[0];
  const object = intersection.object;

  // Note: Can't remove from physics in this Three.js RapierPhysics version
  // The physics body will stay but we hide the mesh

  // Attach to controller (follow hand)
  object.material.emissive.setHex(0x333333);

  // Store current world position/rotation before reparenting
  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  object.getWorldPosition(worldPosition);
  object.getWorldQuaternion(worldQuaternion);

  controller.attach(object);

  controller.userData.selected = object;
}

function onSelectEnd(event) {
  const controller = event.target;
  const object = controller.userData.selected;
  if (!object) return;

  // Detach back to scene group
  scene.attach(object);
  object.material.emissive.setHex(0x000000);

  // Re-add to group for picking
  group.add(object);
  // Re-add to physics with new global transform
  physics.addMesh(object, 1, 0.2);

  // 🔥 Apply throwing velocity based on controller movement
  const controllerVel = controller.userData.velocity;
  if (controllerVel) {
    const throwVel = controllerVel.clone().multiplyScalar(THROW_MULTIPLIER);

    // Optional: limit max throw speed
    // const maxSpeed = 10;
    // if (throwVel.length() > maxSpeed) {
    //   throwVel.setLength(maxSpeed);
    // }

    physics.setMeshVelocity(object, throwVel);
  }

  controller.userData.selected = undefined;
}

function highlightController(controller) {
  const line = controller.getObjectByName("line");
  if (!line || controller.userData.selected) return;

  const intersections = getIntersections(controller);

  if (intersections.length > 0) {
    line.scale.z = intersections[0].distance;
  } else {
    line.scale.z = 1.5;
  }
}

// -----------------------------
//  XR TELEPORT
// -----------------------------

function onSqueezeStart() {
  this.userData.isSqueezing = true;
  console.log("Controller squeeze started");
}

function onSqueezeEnd() {
  this.userData.isSqueezing = false;
  console.log("squeezeend");
  if (INTERSECTION) {
    const offsetPosition = {
      x: -INTERSECTION.x,
      y: -INTERSECTION.y,
      z: -INTERSECTION.z,
      w: 1,
    };
    const offsetRotation = new THREE.Quaternion();
    const transform = new XRRigidTransform(offsetPosition, offsetRotation);
    const teleportSpaceOffset =
      baseReferenceSpace.getOffsetReferenceSpace(transform);
    renderer.xr.setReferenceSpace(teleportSpaceOffset);
  }
}

function moveMarker() {
  INTERSECTION = undefined;
  if (controller1.userData.isSqueezing === true) {
    tempMatrix.identity().extractRotation(controller1.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller1.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    const intersects = raycaster.intersectObjects(teleportgroup.children, true);
    if (intersects.length > 0) {
      INTERSECTION = intersects[0].point;
      console.log(intersects[0]);
      console.log(INTERSECTION);
    }
  } else if (controller2.userData.isSqueezing === true) {
    tempMatrix.identity().extractRotation(controller2.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller2.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    const intersects = raycaster.intersectObjects(teleportgroup.children, true);
    if (intersects.length > 0) {
      INTERSECTION = intersects[0].point;
    }
  }
  if (INTERSECTION) marker.position.copy(INTERSECTION);
  marker.visible = INTERSECTION !== undefined;
}

// -----------------------------
//  CONTROLLER VELOCITY
// -----------------------------

function updateControllerVelocity(controller, deltaSeconds) {
  if (!controller) return;

  if (!controller.userData.prevPos) {
    controller.userData.prevPos = new THREE.Vector3();
    controller.userData.velocity = new THREE.Vector3();
    controller.userData.prevPos.setFromMatrixPosition(controller.matrixWorld);
    return;
  }

  const prevPos = controller.userData.prevPos;
  const vel = controller.userData.velocity;

  tempPos.setFromMatrixPosition(controller.matrixWorld);

  if (deltaSeconds > 0) {
    // v = (x_now - x_prev) / dt
    vel.copy(tempPos).sub(prevPos).divideScalar(deltaSeconds);
  } else {
    vel.set(0, 0, 0);
  }

  prevPos.copy(tempPos);
}

// -----------------------------
//     ANIMATE
// -----------------------------

let lastTime = performance.now() / 1000;

function animate() {
  const now = performance.now() / 1000;
  const delta = now - lastTime;
  lastTime = now;

  // Update controller velocities for throwing
  updateControllerVelocity(controller1, delta);
  updateControllerVelocity(controller2, delta);

  // Remove fallen objects
  for (let i = group.children.length - 1; i >= 0; i--) {
    const mesh = group.children[i];
    if (mesh.position.y < -5) {
      // Note: Can't remove from physics in this Three.js RapierPhysics version
      // Just remove from scene
      group.remove(mesh);
      scene.remove(mesh);
    }
  }

  // physicsHelper.update(); // Commented out - RapierHelper not available

  moveMarker();

  highlightController(controller1);
  highlightController(controller2);

  controls.update();
  renderer.render(scene, camera);
  stats.update();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}