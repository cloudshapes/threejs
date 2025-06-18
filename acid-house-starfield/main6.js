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


init();

function init() {

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x0000, 0.00025);

	const textureLoader = new THREE.TextureLoader();
	const assignSRGB = (texture) => {
		texture.colorSpace = THREE.SRGBColorSpace;
	};


	// Color, sprite, size, particles/points, material, z-speed:	
	const spriteConfig = [
	  { file: 'ah-1.png', color: [0.90, 0.05, 0.5], size: 200 },
	  { file: 'ah-2.png', color: [1.0, 0.2, 0.5], size: 200 },
	  { file: 'ah-3.png', color: [0.95, 0.1, 0.5], size: 60 },
	  { file: 'ah-4.png', color: [0.80, 0, 0.5], size: 25 },
	  { file: 'ah-5.png', color: [0.85, 0, 0.5], size: 28 }
	];

	sprite_objects = spriteConfig.map(cfg => {
	  const texture = textureLoader.load(cfg.file, assignSRGB);
	  // Assign random speed
	  const speed = 1 + Math.random() * 10.0;
	  return [cfg.color, texture, cfg.size, null, null, speed];
	});


	// Use different geometry per sprite:
	for (let i = 0; i < sprite_objects.length; i++) {

		// Generate vertices:
	  const vertices = [];
	  for (let j = 0; j < N_VERTICES; j++) {
	    const x = Math.random() * 2000 - 1000;
	    const y = Math.random() * 2000 - 1000;
	    const z = Math.random() * 2000 - 1000;
	    vertices.push(x, y, z);
	  }

	  // Generate geometry:
	  const geometry = new THREE.BufferGeometry();
	  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	  const color = sprite_objects[i][0];
	  const sprite = sprite_objects[i][1];
	  const size = sprite_objects[i][2];

	  // Generate materials
	  const material = new THREE.PointsMaterial({
	    size: size,
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


	// Camera setup:
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
	const size = new THREE.Vector3();
	const center = new THREE.Vector3();
	overallBox.getSize(size);
	overallBox.getCenter(center);

	const maxDim = Math.max(size.x, size.y, size.z);
	const fov = camera.fov * (Math.PI / 180);
	let cameraZ = maxDim / (2 * Math.tan(fov / 2));
	cameraZ *= 2;

	// Set up before lookAt to fix orientation
	camera.up.set(0, 1, 0);
	camera.position.set(center.x, center.y, cameraZ);
	camera.lookAt(center);
	camera.updateProjectionMatrix();



	// Renderer setup:
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setAnimationLoop(animate);
	document.body.appendChild(renderer.domElement);

	
	stats = new Stats();
	document.body.appendChild(stats.dom);
	

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;       // smooth motion
	controls.dampingFactor = 0.05;
	controls.enableZoom = true;          // zoom with mouse wheel
	controls.enablePan = true;          // optional: disable panning

	// Guarantee consistent orientation on refresh:
	controls.target.copy(center);  // Match what camera.lookAt(center) is doing
	controls.update();             // Required after setting target
	controls.reset(); 

	// Restrict to horizontal-only orbiting (no upside-down camera)
	controls.minPolarAngle = Math.PI / 2;
	controls.maxPolarAngle = Math.PI / 2;
	controls.minAzimuthAngle = -Math.PI;
	controls.maxAzimuthAngle = Math.PI;

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

	for (let i = 0; i < sprite_objects.length; i++) {
		let sprite_object = sprite_objects[i];


		// Adjust sprite positions:
		let p = sprite_object[3];
		let speed = sprite_object[5];

		// Increase z position and adjust if necessary:
		adjust_z_position(p, speed);

		// Adjust materials:
		const color = sprite_object[ 0 ];
		const h = ( 360 * ( color[ 0 ] + time ) % 360 ) / 360;
		let material = sprite_object[ 4 ];
		material.color.setHSL( h, color[ 1 ], color[ 2 ], THREE.SRGBColorSpace );

	};

	renderer.render( scene, camera );
}


function adjust_z_position(p, speed) {
	// Adjust z position:
	p.position.z += speed;

	if (p.position.z > camera.position.z + WRAP_BUFFER) {
		p.position.z = camera.position.z - MAX_Z_VALUE;
	}
}


