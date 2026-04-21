import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 8192);
camera.position.z = 1024;

const light = new THREE.DirectionalLight(0xA89932, 0.5);
light.position.set(0, 2, 0);
light.target.position.set(-5, 0, 0);
scene.add(light);
scene.add(light.target);

const light2 = new THREE.DirectionalLight(0x3287A8, 0.5);
light2.position.set(0, 2, 0);
light2.target.position.set(5, 0, 5);
scene.add(light2);
scene.add(light2.target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(2048, 128, 2048);
controls.rotateUp(1);
controls.update();

var should_render = true;
controls.addEventListener("change", () => { should_render = true; });
function animate(time) {
    if (!should_render) return;
    should_render = false
    renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

const worlds = await(await fetch("worlds.json")).json();
const world_select = document.getElementById("worldSelect");
for(var key of Object.keys(worlds))
    world_select.innerHTML += `<option>${key}</option>`;
const world_meshes = []

async function showWorld()
{
    const world_id = document.getElementById("worldSelect").value;
    const world = worlds[world_id]

    for(var mesh of world_meshes) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        scene.remove(mesh);
    }
    world_meshes.splice(0, world_meshes.length);

    for(var sp of world.start_positions) {
        const geometry = new THREE.SphereGeometry(30, 32, 16);
        const material = new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true, opacity: 0.5 } );
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(2048 - sp.x, sp.z, sp.y + 2048);
        scene.add(sphere);
        world_meshes.push(sphere);

        const canvas = makeLabelCanvas(128, sp.name);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        const labelMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
        });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.x = canvas.width * 1;
        label.scale.y = canvas.height * 1;
        label.position.set(0, 80, 0);
        sphere.add(label);
        world_meshes.push(label);
    }

    const material = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, shininess: 100, flatShading: true });
    const qualityLevel = parseInt(document.getElementById("worldQuality").value);
    const stepSize = 64 << qualityLevel;
    var idx = 0;
    for (var x = 0; x < 4096; x += stepSize) for (var y = 0; y < 2048; y += stepSize) for (var z = 0; z < 4096; z += stepSize) {
        if (world.mesh_info[qualityLevel][idx]) {
            const buffer = await (await fetch(`data/${world_id}/${qualityLevel}_${x}_${y}_${z}.mesh`)).arrayBuffer();
            const info = new Uint32Array(buffer, 0, 2);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, 8, info[0] * 3), 3));
            geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, 8 + 12 * info[0], info[1]), 1));
            //geometry.computeVertexNormals();
            const mesh = new THREE.Mesh(geometry, material);
            if (world_id != document.getElementById("worldSelect").value) return;
            if (qualityLevel != parseInt(document.getElementById("worldQuality").value)) return;
            scene.add(mesh);
            world_meshes.push(mesh);
            should_render = true;
        }
        idx += 1;
    }

    if (world.lava)
    {
        const lava_material = new THREE.MeshPhongMaterial({ color: 0xFF2020, shininess: 100, flatShading: true });
        const buffer = await (await fetch(`data/${world_id}/lava.mesh`)).arrayBuffer();
        const info = new Uint32Array(buffer, 0, 2);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buffer, 8, info[0] * 3), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, 8 + 12 * info[0], info[1]), 1));
        const mesh = new THREE.Mesh(geometry, lava_material);
        scene.add(mesh);
        world_meshes.push(mesh);
        should_render = true;
    }
}
showWorld();
document.getElementById("worldSelect").oninput = showWorld;
document.getElementById("worldQuality").oninput = showWorld;

function makeLabelCanvas(size, name) {
  const borderSize = 2;
  const ctx = document.createElement('canvas').getContext('2d');
  const font = `${size}px bold sans-serif`;
  ctx.font = font;
  // measure how long the name will be
  const doubleBorderSize = borderSize * 2;
  const width = ctx.measureText(name).width + doubleBorderSize;
  const height = size + doubleBorderSize;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
 
  // need to set font again after resizing canvas
  ctx.font = font;
  ctx.textBaseline = 'top';
 
  //ctx.fillStyle = 'blue';
  //ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'white';
  ctx.fillText(name, borderSize, borderSize);
 
  return ctx.canvas;
}