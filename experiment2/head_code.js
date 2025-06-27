import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

let renderer, scene, camera, gui, controls;


init();

function init() {
	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(0, 0, 200);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio( window.devicePixelRatio );
	document.body.appendChild(renderer.domElement);

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.addEventListener( 'change', render );
	controls.screenSpacePanning = true;


	scene = new THREE.Scene();

	loadImage('test.png'); // Replace with your image path
	window.addEventListener('resize', onWindowResize);

}

function loadImage(url) {
	const loader = new THREE.TextureLoader();
	loader.load(url, (texture) => {
		const aspect = texture.image.width / texture.image.height;
		const height = texture.image.height; // 100;
		const width = texture.image.width; // height * aspect;

		const geometry = new THREE.PlaneGeometry(width, height);
		const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
		const mesh = new THREE.Mesh(geometry, material);

		scene.add(mesh);
		render();
	});
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	render();
}

function render() {
	renderer.render(scene, camera);
}
