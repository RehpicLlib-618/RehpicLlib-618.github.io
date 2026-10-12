import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(0x05060f, 8, 25);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 5, 5);
scene.add(sun);

const loader = new THREE.TextureLoader();

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 1.4, 1.4),
  new THREE.MeshStandardMaterial({ map: loader.load('assets/crate.gif') })
);
cube.position.x = 3;
scene.add(cube);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 48, 48),
  new THREE.MeshStandardMaterial({ map: loader.load('assets/earth_atmos_2048.jpg') })
);
earth.position.x = -3;
scene.add(earth);

let duck = null;
new GLTFLoader().load(
  'assets/Duck.glb',
  (gltf) => {
    duck = gltf.scene;
    duck.scale.setScalar(1.5);
    duck.position.set(0, -0.6, 0);
    scene.add(duck);
  },
  undefined,
  (err) => console.error('Erreur de chargement du modele :', err) // voir la console F12
);

const COUNT = 1500;
const positions = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 30;
  positions[i * 3 + 1] = Math.random() * 15 - 3;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const rain = new THREE.Points(
  rainGeo,
  new THREE.PointsMaterial({ color: 0x9ec8ff, size: 0.06, transparent: true, opacity: 0.8 })
);
scene.add(rain);


const target = { x: 0, y: 0 }; // rotation voulue
const deg = THREE.MathUtils.degToRad;

function onOrientation(e) {
  if (e.beta === null) return;
  target.x = deg(THREE.MathUtils.clamp(e.beta - 45, -45, 45));
  target.y = deg(THREE.MathUtils.clamp(e.gamma, -45, 45));
}
window.addEventListener('deviceorientation', onOrientation);

window.addEventListener('pointermove', (e) => {
  target.y = ((e.clientX / innerWidth) - 0.5) * 1.2;
  target.x = ((e.clientY / innerHeight) - 0.5) * 0.8;
});

const btn = document.getElementById('btn');
const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';
if (!needsPermission) btn.style.display = 'none';
btn.addEventListener('click', async () => {
  const res = await DeviceOrientationEvent.requestPermission();
  if (res === 'granted') btn.style.display = 'none';
});

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  cube.rotation.x = t * 0.6;
  cube.rotation.y = t * 0.8;
  earth.rotation.y = t * 0.4;
  if (duck) duck.rotation.y = t * 0.5;

  const p = rainGeo.attributes.position;
  for (let i = 0; i < COUNT; i++) {
    let y = p.getY(i) - 0.15;
    if (y < -3) y = 12;
    p.setY(i, y);
  }
  p.needsUpdate = true;

  scene.rotation.x += (target.x - scene.rotation.x) * 0.08;
  scene.rotation.y += (target.y - scene.rotation.y) * 0.08;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
