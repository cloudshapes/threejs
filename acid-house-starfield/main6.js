import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, parameters;
let controls;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

let sprite_objects = [];
const N_VERTICES = 100;

init();

function init() {

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x0000, 0.00025);

	const textureLoader = new THREE.TextureLoader();
	const assignSRGB = (texture) => {
		texture.colorSpace = THREE.SRGBColorSpace;
	};

	
	const sprite1 = textureLoader.load('ah-1.png', assignSRGB);
	const sprite2 = textureLoader.load('ah-2.png', assignSRGB);
	const sprite3 = textureLoader.load('ah-3.png', assignSRGB);
	const sprite4 = textureLoader.load('ah-4.png', assignSRGB);
	const sprite5 = textureLoader.load('ah-5.png', assignSRGB);


	// Color, sprite, size, particles/points, material, z-speed:	
	sprite_objects = [
		[[ 1.0, 0.2, 0.5 ], sprite2, 200, null, null, null ],
		[[ 0.95, 0.1, 0.5 ], sprite3, 60, null, null, null ],
		[[ 0.90, 0.05, 0.5 ], sprite1, 200, null, null, null ],
		[[ 0.85, 0, 0.5 ], sprite5, 28 ],
		[[ 0.80, 0, 0.5 ], sprite4, 25 ]
	];


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

		// Assign random speed:
		sprite_objects[i][5] = random_z_speed();

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


	// Camera setup to frame the box
	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);

	const size = new THREE.Vector3();
	const center = new THREE.Vector3();
	overallBox.getSize(size);
	overallBox.getCenter(center);
	const maxDim = Math.max(size.x, size.y, size.z);
	const fov = camera.fov * (Math.PI / 180);
	let cameraZ = maxDim / (2 * Math.tan(fov / 2));
	cameraZ *= 2;
	camera.position.set(center.x, center.y, cameraZ);
	camera.lookAt(center);
	camera.updateProjectionMatrix();


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
		const p = sprite_object[3];
		let speed = sprite_object[5];

		p.position.z += speed;
		if (p.position.z > 1000) p.position.z -= 2000;

		// Adjust materials:
		const color = sprite_object[ 0 ];
		const h = ( 360 * ( color[ 0 ] + time ) % 360 ) / 360;
		let material = sprite_object[ 4 ];
		material.color.setHSL( h, color[ 1 ], color[ 2 ], THREE.SRGBColorSpace );

	};

	renderer.render( scene, camera );
}


function random_z_speed()	{
	return 1 + Math.random() * 10.0;
}



