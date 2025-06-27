import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let renderer, scene, camera, gui, guiData;
let mesh, uniforms;
let tiles = [], tileGroup;
let smokeParticles = [];
let smokeTexture;

let renderTarget, offscreenScene, offscreenCamera;

init();

function init() {
	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(0, 0, 200);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio( window.devicePixelRatio );
	document.body.appendChild(renderer.domElement);

	scene = new THREE.Scene();

	renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
	offscreenScene = new THREE.Scene();
	offscreenCamera = camera;

	initGUI();

	window.addEventListener('resize', onWindowResize);

	// Load smoke
	const textureLoader = new THREE.TextureLoader();
	textureLoader.load('smoke_04.png', tex => smokeTexture = tex); 

	loadImage('rd-headshot-s.png');
	animate();
}


function initGUI()	{
	gui = new GUI();

	guiData = {};
	guiData.explode = 0.0;

	gui.add(guiData, 'explode', 0.0, 1.0).name('Explode').onChange(val => uniforms.uExplode.value = val);

	/* Defaults:
	spin speed: 0.0113
	Ripple Amplitude: 3.4
	Ripple Frequency: 19.5
	Ripple Speed: 2.605
	*/
	gui = new GUI();
	guiData = {
		spin_speed: 0.0113,
		ripple_amplitude: 4.385,
		ripple_frequency: 18.52,
		ripple_speed: 4.695,
		explodeNow: explodeNow
	};

	gui.add(guiData, 'spin_speed', 0.0, 0.05).name('Spin Speed');
	gui.add(guiData, 'ripple_amplitude', 0.0, 5.0).name('Ripple Amplitude').onChange(val => uniforms.uAmplitude.value = val);
	gui.add(guiData, 'ripple_frequency', 0.0, 20.0).name('Ripple Frequency').onChange(val => uniforms.uFrequency.value = val);
	gui.add(guiData, 'ripple_speed', 0.0, 5.0).name('Ripple Speed').onChange(val => uniforms.uSpeed.value = val);
	gui.add(guiData, 'explodeNow').name('💥 Shatter & Reassemble');
}

function explodeNow()	{
	if (!mesh) return;
	scene.remove(mesh);

	createTilesFromCapturedImage();

	setTimeout(() => {
		tiles.forEach(tile => tile.userData.exploding = true);
		spawnSmokeParticles(mesh.position);
	}, 100);

	setTimeout(() => {
		// Start fading the mesh back in
		scene.add(mesh); // bring back ripple mesh, now fully transparent
		mesh.material.opacity = 0.0;
	}, 2500);

	// Gradually fade in
	let fadeStart = null;
	function fadeInMesh(timestamp) {
		if (!fadeStart) fadeStart = timestamp;
		const elapsed = (timestamp - fadeStart) / 1000; // seconds

		if (mesh.material.opacity < 1.0) {
			mesh.material.opacity = Math.min(1.0, elapsed * 2.0); // fade-in over 0.5s
			requestAnimationFrame(fadeInMesh);
		} else {
			scene.remove(tileGroup); // clean up
		}
	}
	setTimeout(() => requestAnimationFrame(fadeInMesh), 2500);
}

function loadImage(url, onLoad) {
	const loader = new THREE.TextureLoader();
	loader.load(url, (texture) => {
		const maxSize = 100; // target size in world units
		const aspect = texture.image.width / texture.image.height;
		const width = maxSize * aspect;
		const height = maxSize;

		// Create a subdivided plane (more vertices = smoother ripple)
		const geometry = new THREE.PlaneGeometry(width, height, 100, 100); 

		uniforms = {
			uTime: { value: 0 },
			uTexture: { value: texture },
			uAmplitude: { value: guiData.ripple_amplitude },
			uFrequency: { value: guiData.ripple_frequency },
			uSpeed: { value: guiData.ripple_speed },
		};

		const material = new THREE.ShaderMaterial({
			uniforms,
			vertexShader: `
				uniform float uTime;
				uniform float uAmplitude;
				uniform float uFrequency;
				uniform float uSpeed;
				varying vec2 vUv;

				void main() {
					vUv = uv;
					vec3 pos = position;
					pos.z += sin(pos.y * uFrequency + uTime * uSpeed) * uAmplitude;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D uTexture;
				varying vec2 vUv;

				void main() {
					vec4 texColor = texture2D(uTexture, vUv);
					if (texColor.a < 0.1) discard;
					gl_FragColor = texColor;
				}
			`,
			transparent: true,
			opacity: 0.0,
			side: THREE.DoubleSide
		});

		mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		// Add duplicate to offscreen scene
		const offscreenMesh = new THREE.Mesh(geometry.clone(), material);
		offscreenScene.add(offscreenMesh);
		mesh.userData.offscreenMesh = offscreenMesh;

		if (onLoad) animate();
	});
}

function createTilesFromCapturedImage() {
	const tileSize = 5;
	const geometry = mesh.geometry;
	const texture = renderTarget.texture;

	tiles = [];
	tileGroup = new THREE.Group();

	const width = geometry.parameters.width;
	const height = geometry.parameters.height;

	for (let x = -width / 2; x < width / 2; x += tileSize) {
		for (let y = -height / 2; y < height / 2; y += tileSize) {
			const tileGeo = new THREE.PlaneGeometry(tileSize, tileSize);
			const tileMat = new THREE.MeshBasicMaterial({
				map: texture,
				side: THREE.DoubleSide
			});

			const tile = new THREE.Mesh(tileGeo, tileMat);
			tile.position.set(x + tileSize / 2, y + tileSize / 2, 0);
			tile.userData.originalPos = tile.position.clone();
			tile.userData.velocity = new THREE.Vector3(
				(Math.random() - 0.5) * 3,
				(Math.random() - 0.5) * 3,
				(Math.random() - 0.5) * 3
			);
			tile.userData.rotationAxis = new THREE.Vector3(
				Math.random(), Math.random(), Math.random()
			).normalize();
			tile.userData.angle = 0;

			tileGroup.add(tile);
			tiles.push(tile);
		}
	}

	scene.add(tileGroup);
}

function spawnSmokeParticles(center) {
	if (!smokeTexture) return;

	for (let i = 0; i < 50; i++) {
		const spriteMaterial = new THREE.SpriteMaterial({
			map: smokeTexture,
			transparent: true,
			opacity: 0.5,
			depthWrite: false
		});

		const sprite = new THREE.Sprite(spriteMaterial);
		sprite.position.set(
			center.x + (Math.random() - 0.5) * 50,
			center.y + (Math.random() - 0.5) * 50,
			0
		);
		sprite.scale.set(10, 10, 1);
		sprite.userData.life = 1.0;
		sprite.userData.velocity = new THREE.Vector3(
			(Math.random() - 0.5) * 0.5,
			(Math.random() - 0.5) * 0.5,
			0.1 + Math.random() * 0.5
		);

		scene.add(sprite);
		smokeParticles.push(sprite);
	}
}


function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderTarget.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);

	// Render ripple mesh to offscreen texture
	if (uniforms && mesh && mesh.userData?.offscreenMesh) {
		uniforms.uTime.value += 0.02;
		mesh.rotation.y += guiData.spin_speed;
		mesh.userData.offscreenMesh.rotation.y = mesh.rotation.y;

		renderer.setRenderTarget(renderTarget);
		renderer.render(offscreenScene, offscreenCamera);
		renderer.setRenderTarget(null);
	}

	// Animate smoke particles
	for (let i = smokeParticles.length - 1; i >= 0; i--) {
		const p = smokeParticles[i];
		p.position.add(p.userData.velocity);
		p.userData.life -= 0.01;
		p.material.opacity = p.userData.life;

		const scale = 10 + (1 - p.userData.life) * 20;
		p.scale.set(scale, scale, 1);

		if (p.userData.life <= 0) {
			scene.remove(p);
			smokeParticles.splice(i, 1);
		}
	}

	// Tile animations
	tiles.forEach(tile => {
		if (tile.userData.exploding) {
			tile.position.add(tile.userData.velocity);
			tile.userData.angle += 0.1;
			tile.rotateOnAxis(tile.userData.rotationAxis, 0.1);
		} else if (tile.userData.reassembling) {
			tile.position.lerp(tile.userData.originalPos, 0.1);
			tile.rotation.set(0, 0, 0);
		}
	});

	renderer.render(scene, camera);
}

