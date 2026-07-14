// Standalone Toll — entry point. See docs/plans/standalone-shell.md.
//
// S0 (this file, for now): a BARE stage — prove the second Vite entry boots, three loads, the canvas mounts,
// and the page clears to the same DARK the explorer uses. Everything real (stage.js, hud.js, the views,
// the data bundle) lands in later stages; this is the scaffold they hang off.
import * as THREE from 'three';

const DARK = 0x05060a; // same clear colour as the explorer (index.html body + scene background)

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(DARK, 1);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(DARK);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 100);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

renderer.setAnimationLoop(() => renderer.render(scene, camera));
console.info('[toll] S0 bare stage up — waiting for the shell (stage.js) in S1');
