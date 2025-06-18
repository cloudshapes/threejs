import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats;
let controls;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

let sprite_objects = [];
const N_VERTICES = 100;
const WRAP_BUFFER = 200;
const MAX_Z_VALUE = 2000;
const RANGE = 1000;
const MAX_Z_VELOCITY = 60;

init();

function init() {

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x0000, 0.00025);

	const textureLoader = new THREE.TextureLoader();
	const assignSRGB = (texture) => {
		texture.colorSpace = THREE.SRGBColorSpace;
	};


	// Color, sprite, size, particles/points, material:	
	const spriteConfig = [
	  { file: 'ah-1.png', color: [0.90, 0.05, 0.5], size: 200 },
	  { file: 'ah-2.png', color: [1.0, 0.2, 0.5], size: 200 },
	  { file: 'ah-3.png', color: [0.95, 0.1, 0.5], size: 60 },
	  { file: 'ah-4.png', color: [0.80, 0, 0.5], size: 25 },
	  { file: 'ah-5.png', color: [0.85, 0, 0.5], size: 28 }
	];

	sprite_objects = spriteConfig.map(cfg => {
	  const texture = textureLoader.load(cfg.file, assignSRGB);
	  return [cfg.color, texture, cfg.size, null, null];
	});


	// Use different geometry per sprite:
	for (let i = 0; i < sprite_objects.length; i++) {

		// Generate vertices:
	  const vertices = [];
	  for (let j = 0; j < N_VERTICES; j++) {
	    const x = Math.random() * MAX_Z_VALUE - RANGE;
	    const y = Math.random() * MAX_Z_VALUE - RANGE;
	    const z = Math.random() * MAX_Z_VALUE - RANGE;
	    vertices.push(x, y, z);
	  }

		const velocities = new Float32Array(N_VERTICES);
		for (let j = 0; j < N_VERTICES; j++) {
			velocities[j] = (Math.random() - 0.5) * MAX_Z_VELOCITY;
		}

	  // Generate geometry:
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
		geometry.setAttribute('zVelocity', new THREE.BufferAttribute(velocities, 1));

		// Save original X and Y separately
		const baseX = new Float32Array(N_VERTICES);
		const baseY = new Float32Array(N_VERTICES);
		for (let j = 0; j < N_VERTICES; j++) {
		  baseX[j] = vertices[j * 3 + 0];
		  baseY[j] = vertices[j * 3 + 1];
		}
		geometry.setAttribute('baseX', new THREE.BufferAttribute(baseX, 1));
		geometry.setAttribute('baseY', new THREE.BufferAttribute(baseY, 1));


	  const color = sprite_objects[i][0];
	  const sprite = sprite_objects[i][1];
	  const size = sprite_objects[i][2];

	  // Generate materials
		const material = new THREE.PointsMaterial({
		  size: size,
		  sizeAttenuation: true, // 👈 this makes size respond to camera distance
		  map: sprite,
		  blending: THREE.AdditiveBlending,
		  depthTest: false,
		  transparent: true
		});

	  material.color.setHSL(color[0], color[1], color[2], THREE.SRGBColorSpace);
		sprite_objects[i][4] = material;

		// Generate points/particles
	  let points = new THREE.Points(geometry, material);
	  scene.add(points);
		sprite_objects[i][3] = points;
	}


	// Add overall box helper:
	const overallBox = new THREE.Box3();

	for (let i = 0; i < scene.children.length; i++) {
		const object = scene.children[i];
		if (object instanceof THREE.Points) {
			const geometry = object.geometry;
			const objectBox = new THREE.Box3().setFromBufferAttribute(
				geometry.getAttribute('position')
			);
			overallBox.union(objectBox); // expand the overall box to include this one
		}
	}

	const boxHelper = new THREE.Box3Helper(overallBox, 0xff00ff);
	scene.add(boxHelper);


	// Add axes helper:
	// The X axis is red. The Y axis is green. The Z axis is blue.
	const axesHelper = new THREE.AxesHelper(10000); // size = length of each axis
	scene.add(axesHelper);


	// Renderer setup:
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animate);
	document.body.appendChild(renderer.domElement);


	// Camera and controls setup:
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
	// Fix the 'up' vector (Y-axis as up)
	camera.up.set(0, 1, 0);
	// Position the camera slightly off the Z axis
	camera.position.set(50, 20, 3000);  // Slightly off-center
	// Look at the origin (or any consistent target)
	camera.lookAt(0, 0, 0);
	// Set up OrbitControls (with rotation locked)
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.enableZoom = true;
	controls.enablePan = true;
	controls.enableRotate = true;  

	// Lock target to center and update controls
	controls.target.set(0, 0, 0);
	controls.update();

	
	stats = new Stats();
	document.body.appendChild(stats.dom);

	document.body.style.touchAction = 'none';
	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	render();
	controls.update();	
	stats.update();
}


function render() {
	const time = Date.now() * 0.00005;
	const driftScale = 0.5;

	for (let i = 0; i < sprite_objects.length; i++) {

		let sprite_object = sprite_objects[i];

		// Adjust positions:
	  const points = sprite_object[3];
	  const geometry = points.geometry;

	  const positions = geometry.getAttribute('position');
	  const velocities = geometry.getAttribute('zVelocity');

	  for (let j = 0; j < positions.count; j++) {
	    let z = positions.getZ(j);
	    z += velocities.getX(j);

	    // If the point goes beyond the camera Z, wrap it around
			const wrapZ = camera.position.z + WRAP_BUFFER;
			const nearLimit = camera.position.z - camera.near - 20; // 20 units before near clip
			if (z > wrapZ || z > nearLimit) {
			  z = camera.position.z - MAX_Z_VALUE;
			}

	    // X/Y drift using sin noise based on index and time
	    const base = i * RANGE + j;
			const x = geometry.getAttribute('baseX').getX(j) + Math.sin(base + time) * driftScale;
			const y = geometry.getAttribute('baseY').getX(j) + Math.cos(base + time * 1.3) * driftScale;

	    // Update all coords
	    positions.setX(j, x);
	    positions.setY(j, y);
	    positions.setZ(j, z);

	  }
	  positions.needsUpdate = true;


		// Adjust materials:
		const color = sprite_object[ 0 ];
		const h = ( 360 * ( color[ 0 ] + time ) % 360 ) / 360;
		let material = sprite_object[ 4 ];
		material.color.setHSL( h, color[ 1 ], color[ 2 ], THREE.SRGBColorSpace );
	}

	renderer.render( scene, camera );
}


