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
const MAX_Z_VELOCITY = 30;
const MAX_SIZE = 250;

init();

function init() {
	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x0000, 0.00025);

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
	camera.position.set(50, 20, 1000);  // Slightly off-center - initial zoom - 1000
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

	// Load up stats:
	stats = new Stats();
	document.body.appendChild(stats.dom);


	const textureLoader = new THREE.TextureLoader();
	// Color, sprite, size, particles/points, material:	
	const spriteConfig = [
	  { file: 'ah-1.png', color: [0.90, 0.05, 0.5]},
	  { file: 'ah-2.png', color: [1.0, 0.2, 0.5]},
	  { file: 'ah-3.png', color: [0.95, 0.1, 0.5]},
	  { file: 'ah-4.png', color: [0.80, 0, 0.5]},
	  { file: 'ah-5.png', color: [0.85, 0, 0.5]}
	];

	spriteConfig.forEach((cfg) => {

		textureLoader.load(cfg.file, (texture) => {
			texture.colorSpace = THREE.SRGBColorSpace;

			console.log(texture.image);


			const geometry = new THREE.BufferGeometry();
			const positions = [];
			const sizes = [];
			const zVelocity = [];

			for (let i = 0; i < N_VERTICES; i++) {
				const x = Math.random() * MAX_Z_VALUE - RANGE;
				const y = Math.random() * MAX_Z_VALUE - RANGE;
				const z = Math.random() * MAX_Z_VALUE - RANGE;
				positions.push(x, y, z);
				sizes.push(100 + Math.random() * MAX_SIZE); // size per vertex
				zVelocity.push((Math.random() - 0.5) * MAX_Z_VELOCITY);
			}

			geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
			geometry.setAttribute('zVelocity', new THREE.Float32BufferAttribute(zVelocity, 1));


			const color = new THREE.Color();
			color.setHSL(cfg.color[0], cfg.color[1], cfg.color[2]);

			const hsl = {};
			color.getHSL(hsl);

			const material = new THREE.ShaderMaterial({
		        uniforms: {
		          pointTexture: { value: texture },
		          baseColor: { value: new THREE.Vector3(hsl.h, hsl.s, hsl.l) },
		          hueShift: { value: 0 },
		          fadeNear: { value: 800.0 },
		          fadeFar: { value: 1600.0 }
		        },
				vertexShader: `
			        attribute float size;
			        uniform float fadeNear;
			        uniform float fadeFar;
			        varying float vAlpha;

			        void main() {
			          vAlpha = 1.0 - smoothstep(fadeNear, fadeFar, position.z);
			          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			          gl_PointSize = size * (300.0 / -mvPosition.z);
			          gl_Position = projectionMatrix * mvPosition;
			        }
				`,
				fragmentShader: `
					uniform sampler2D pointTexture;
					uniform vec3 baseColor;
					uniform float hueShift;
					varying float vAlpha;

					vec3 hsl2rgb(vec3 hsl) {
						vec3 rgb = clamp(abs(mod(hsl.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
						rgb = rgb * rgb * (3.0 - 2.0 * rgb);
						return hsl.z + hsl.y * (rgb - 0.5) * (1.0 - abs(2.0 * hsl.z - 1.0));
					}

					void main() {
						vec2 flippedCoord = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
						vec4 texColor = texture2D(pointTexture, flippedCoord);
						vec3 hsl = vec3(mod(baseColor.x + hueShift, 1.0), baseColor.y, baseColor.z);
						vec3 shiftedColor = hsl2rgb(hsl);
						gl_FragColor = vec4(shiftedColor * texColor.rgb, texColor.a * vAlpha);
					}
				`,
				transparent: true,
				depthTest: false,
				blending: THREE.AdditiveBlending
			});



			const points = new THREE.Points(geometry, material);
			scene.add(points);
			sprite_objects.push(points);
		});
	});

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
	for (let points of sprite_objects) {
		const positions = points.geometry.getAttribute('position');
		const velocities = points.geometry.getAttribute('zVelocity');

		for (let i = 0; i < positions.count; i++) {
			let z = positions.getZ(i);
			z += velocities.getX(i);

			if (z > camera.position.z + WRAP_BUFFER) {
				z = camera.position.z - MAX_Z_VALUE;
			}
			positions.setZ(i, z);
		}
		positions.needsUpdate = true;

		const mat = points.material;
	    if (mat.uniforms && mat.uniforms.hueShift) {
	      mat.uniforms.hueShift.value = (Date.now() * 0.00005) % 1;
	    }

	    // Dynamically update fadeNear/fadeFar
	    if (mat.uniforms.fadeNear && mat.uniforms.fadeFar) {
	      const z = camera.position.z;
	      mat.uniforms.fadeNear.value = z - 800;
	      mat.uniforms.fadeFar.value = z + 800;
	    }
	}
		renderer.render(scene, camera);
}

