import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const info = document.getElementById('info');
const R = 1; // rayon de la sphere (unite arbitraire : 1 = Terre)

// ---------- 1. Scene, camera, lumieres, renderer ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.8, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 3, 5);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 1.6;
controls.maxDistance = 6;

// ---------- 2. Sphere texturee (Terre) ----------
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous'); // necessaire pour les images des drapeaux
const earthTexture = textureLoader.load('assets/earth_atmos_2048.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(R, 64, 64),
  new THREE.MeshStandardMaterial({ map: earthTexture })
);
scene.add(earth);

// Tout ce qui est place sur la Terre est enfant de "earth" : il tourne avec elle
// ---------- 3. Latitude / longitude -> XYZ ----------
// Compatible avec le mapping UV de SphereGeometry (longitude 0 = centre de l'image)
function latLonToVector3(lat, lon, radius = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat);   // angle depuis le pole nord
  const theta = THREE.MathUtils.degToRad(lon + 180); // angle autour de l'axe Y
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

// ---------- 4. Ma position ----------
let myMarker = null;
function addMyMarker(lat, lon) {
  myMarker = new THREE.Group();
  const pos = latLonToVector3(lat, lon, R);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff2d2d })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.035, 0.05, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2d2d, side: THREE.DoubleSide, transparent: true })
  );
  myMarker.add(dot, ring);
  myMarker.position.copy(pos);
  ring.lookAt(pos.clone().multiplyScalar(2)); // anneau a plat sur la surface
  myMarker.userData.ring = ring;
  myMarker.userData.name = 'Vous etes ici';
  earth.add(myMarker);

  // Oriente la camera vers ma position
  camera.position.copy(pos.clone().multiplyScalar(3).applyMatrix4(earth.matrixWorld));
}

if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (p) => addMyMarker(p.coords.latitude, p.coords.longitude),
    (err) => console.warn('Geolocalisation refusee ou indisponible :', err.message),
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

// ---------- 5. Drapeaux des pays (restcountries) ----------
// L'API exige maintenant le parametre "fields" (10 champs max)
const API = 'https://restcountries.com/v3.1/all?fields=name,cca2,latlng,flags';
const flagObjects = []; // pour le survol

function addFlag(country) {
  const [lat, lon] = country.latlng;
  const base = latLonToVector3(lat, lon, R);
  const tip = latLonToVector3(lat, lon, R + 0.09);

  // Mat : petit cylindre du sol jusqu'au drapeau
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.002, 0.002, 0.09, 6),
    new THREE.MeshBasicMaterial({ color: 0xdddddd })
  );
  pole.position.copy(base.clone().add(tip).multiplyScalar(0.5));
  pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.clone().normalize());

  const tex = textureLoader.load(country.flags.png);
  tex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.06),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  flag.position.copy(tip);
  flag.lookAt(tip.clone().multiplyScalar(2)); // face vers l'exterieur
  flag.translateX(0.045);                     // decale pour que le mat soit sur le bord
  flag.userData.name = country.name.common;

  earth.add(pole, flag);
  flagObjects.push(flag);
}

async function loadCountries() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const all = await res.json();

    const picked = all
      .filter((c) => c.latlng && c.latlng.length === 2)
      .sort(() => Math.random() - 0.5)
      .slice(0, 40);
    picked.forEach(addFlag);
    info.textContent = picked.length + ' pays affiches. Glisser pour tourner, molette pour zoomer.';
  } catch (e) {
    console.error(e);
    info.textContent = 'Impossible de charger les pays (voir la console F12).';
  }
}
loadCountries();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = myMarker ? [...flagObjects, myMarker.children[0]] : flagObjects;
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (hit) {
    info.textContent = hit.object.userData.name || myMarker.userData.name;
  }
});

function animate(t) {
  if (!myMarker) earth.rotation.y += 0.0008;
  if (myMarker) {
    const s = 1 + 0.4 * Math.sin(t * 0.004);
    myMarker.userData.ring.scale.setScalar(s);
    myMarker.userData.ring.material.opacity = 1.2 - 0.6 * s;
  }
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
