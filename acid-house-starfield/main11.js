import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats;
let controls;
let audioListener;
let audioControl;
let audioTrackController;
let playPauseController; 
let initialOverlay;

let sprite_objects = [];
const WRAP_BUFFER = 200;
const MAX_Z_VALUE = 2000;
const RANGE = 1000;
const MAX_Z_VELOCITY = 30;
const MAX_SIZE = 250;
const INITIAL_ZOOM = 2500;

const NO_MUSIC_LABEL = 'No music!';
const PLAY_LABEL = '▶ Play';
const PAUSE_LABEL = '⏸ Pause';

const LOADING_MESSAGE = 'Loading audio 🔇 .... standby ⏳!';
const READY_MESSAGE = 'Ready 💪! Click to enter! 🎉';


let boxHelper, axesHelper;
let gui;
let visualizerCanvas, visualizerCtx;

const BAND_COLORS = {
	bass: '#ff0055',   // reddish-pink
	mids: '#00ccff',   // cyan
	highs: '#ccff66'   // lime-yellow
};


const settings = {
	showBoundingBox: false,
	showAxes: false,
	zSpeedMultiplier: 1.5,
	numSprites: 60,
	fogDensity: 0.00007,
	audioTrack: 'None',
	showVisualizer: false,
};

let bassGroup = [], midsGroup = [], highsGroup = [];


const audio_objects = {
	'Come Together (Primal Scream)': {
		'url': 'https://dl.dropboxusercontent.com/scl/fi/nb665gd1nzg49un3abj6y/come-together.mp3?rlkey=kplzwbgxp2xprocmuh1y5tbp3&st=bm1mneb1&dl=0',
		'object': null,
		'analyser': null
	},
	'Feel the Melody (Marvel Riot)': {
		'url': 'https://dl.dropboxusercontent.com/scl/fi/jnjzzy022nytejtz3yvw3/tinzo.mp3?rlkey=tq5lihiy8hdb4mno8n0w1r1fv&st=xhl9q0mo&dl=0',
		'object': null,
		'analyser': null
	},
	'Pasilda (DJ Wady/CASSIMM)': {
		'url': 'https://dl.dropboxusercontent.com/scl/fi/1hbqubhwq4h1ml6m43rme/pasilda-bit.mp3?rlkey=ajh3clgofdbjewya9z7gxfx1o&st=bt7vp6zh&dl=0',
		'object': null,
		'analyser': null
	}
}

init();

function init() {
	createInitialOverlay();
	createAudioVisualizer();

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x000000, settings.fogDensity);

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
	camera.position.set(50, 20, INITIAL_ZOOM);  // Slightly off-center - initial zoom - 1000
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

	// Create sprites:
	createSprites();

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

	boxHelper = new THREE.Box3Helper(overallBox, 0xff00ff);
	boxHelper.visible = settings.showBoundingBox;

	scene.add(boxHelper);

	// Add axes helper:
	// The X axis is red. The Y axis is green. The Z axis is blue.
	axesHelper = new THREE.AxesHelper(10000); // size = length of each axis
	axesHelper.visible = settings.showAxes;
	scene.add(axesHelper);
	
	setupGUI(); // load UI controls	

	document.body.style.touchAction = 'none';
	window.addEventListener('resize', onWindowResize);

	// Init audio - play default track:
	initAudio().then(setupReadyToStart);
}


function setupReadyToStart()	{
	initialOverlay.innerText = READY_MESSAGE;

	const resume = () => {
		const context = THREE.AudioContext.getContext();
		if (context.state === 'suspended') {
			context.resume();
		}

		// Start default track
		playSelectedAudio('Come Together (Primal Scream)');

		// Remove overlay
		initialOverlay.style.transition = 'opacity 1s';
		initialOverlay.style.opacity = '0';
		setTimeout(() => initialOverlay.remove(), 1000);

		document.removeEventListener('click', resume);
		document.removeEventListener('keydown', resume);
	};

	document.addEventListener('click', resume);
	document.addEventListener('keydown', resume);
}







function setupGUI() {
	gui = new GUI();

	gui.add(settings, 'showBoundingBox').name('Show Bounding Box').onChange((val) => {
		boxHelper.visible = val;
	});

	gui.add(settings, 'showAxes').name('Show Axes').onChange((val) => {
		axesHelper.visible = val;
	});

	gui.add(settings, 'zSpeedMultiplier', 0.1, 5.0, 0.1).name('Z Speed');

	gui.add(settings, 'numSprites', 10, 500, 10).name('Sprites per Type').onChange(() => {
		// Clear and regenerate
		sprite_objects.forEach(p => scene.remove(p));
		sprite_objects = [];
		bassGroup = [];
		midsGroup = [];
		highsGroup = [];
		createSprites();
	});

	gui.add(settings, 'fogDensity', 0.00001, 0.002, 0.00001).name('Fog Density').onChange((value) => {
		scene.fog.density = value;
	});	

	gui.add(settings, 'showVisualizer').name('Show Visualizer').onChange((val) => {
		if (visualizerCanvas) {
			visualizerCanvas.style.display = val ? 'block' : 'none';
		}
	});

	const trackNames = ['None', ...Object.keys(audio_objects)];
	audioTrackController = gui.add(settings, 'audioTrack', trackNames).name('Music').onChange(playSelectedAudio);

	audioControl = {
	  label: NO_MUSIC_LABEL,
	  toggle: toggleAudioControl
	};
	playPauseController = gui.add(audioControl, 'toggle').name(audioControl.label);
}

function createInitialOverlay()	{
	// Create and style the overlay
	initialOverlay = document.createElement('div');
	initialOverlay.id = 'audioOverlay';
	initialOverlay.style.position = 'fixed';
	initialOverlay.style.top = '0';
	initialOverlay.style.left = '0';
	initialOverlay.style.width = '100vw';
	initialOverlay.style.height = '100vh';
	initialOverlay.style.background = 'rgba(0, 0, 0, 0.85)';
	initialOverlay.style.color = '#fff';
	initialOverlay.style.display = 'flex';
	initialOverlay.style.flexDirection = 'column';
	initialOverlay.style.justifyContent = 'center';
	initialOverlay.style.alignItems = 'center';
	initialOverlay.style.fontSize = '2em';
	initialOverlay.style.zIndex = '1000';
	initialOverlay.innerText = LOADING_MESSAGE;
	document.body.appendChild(initialOverlay);
}

function createAudioVisualizer() {
	visualizerCanvas = document.createElement('canvas');
	visualizerCanvas.style.position = 'fixed';
	visualizerCanvas.style.bottom = '0';
	visualizerCanvas.style.left = '0';
	visualizerCanvas.style.width = '50%';
	visualizerCanvas.style.height = '100px';
	visualizerCanvas.style.zIndex = '500';
	visualizerCanvas.style.pointerEvents = 'none';
	visualizerCanvas.style.background = 'transparent';
	visualizerCanvas.style.display = settings.showVisualizer ? 'block' : 'none'; 
	document.body.appendChild(visualizerCanvas);

	visualizerCtx = visualizerCanvas.getContext('2d');
}

function toggleAudioControl()	{
	const selected = audio_objects[settings.audioTrack];
	if (!selected || !selected.object) {
	  	audioControl.label = NO_MUSIC_LABEL;
	}	else {
		if (selected.object.isPlaying) {
		  selected.object.pause();
		  audioControl.label = PLAY_LABEL;
		} else {
		  selected.object.play();
		  audioControl.label = PAUSE_LABEL;
		}
	}
	if (playPauseController) {
		playPauseController.name(audioControl.label);
	}

}

function createSprites()	{

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

			const geometry = new THREE.BufferGeometry();
			const positions = [];
			const sizes = [];
			const zVelocity = [];

			for (let i = 0; i < getVertexCount(); i++) {
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
		          fadeFar: { value: 1600.0 },
				  fogColor: { value: new THREE.Color(scene.fog.color) },
				  fogDensity: { value: scene.fog.density }		          
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
					uniform vec3 fogColor;
					uniform float fogDensity;

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
						vec4 finalColor = vec4(shiftedColor * texColor.rgb, texColor.a * vAlpha);

						// Apply exponential fog
						float fogDepth = gl_FragCoord.z / gl_FragCoord.w;
						float fogFactor = exp2(-fogDensity * fogDensity * fogDepth * fogDepth * 1.442695);
						fogFactor = clamp(fogFactor, 0.0, 1.0);
						finalColor.rgb = mix(fogColor, finalColor.rgb, fogFactor);

						gl_FragColor = finalColor;

					}
				`,
				transparent: true,
				depthTest: false,
				blending: THREE.AdditiveBlending
			});

			const points = new THREE.Points(geometry, material);

			// Decide which band this sprite responds to (rotate between bands)
			const bands = ['bass', 'mids', 'highs'];
			const randomBand = bands[Math.floor(Math.random() * bands.length)];
			points.userData.band = randomBand;

			if (randomBand === 'bass') {
				points.userData.band = 'bass';
				bassGroup.push(points);
			} else if (randomBand === 'mids') {
				points.userData.band = 'mids';
				midsGroup.push(points);
			} else {
				points.userData.band = 'highs';
				highsGroup.push(points);
			}

			scene.add(points);
			sprite_objects.push(points);

			// Once all textures are done loading and added:
			if (sprite_objects.length === spriteConfig.length) {
			  // Remove old box helper if it exists
			  if (boxHelper) scene.remove(boxHelper);

			  // Compute new bounding box
			  const newBox = new THREE.Box3();
			  sprite_objects.forEach(p => newBox.expandByObject(p));

			  // Create new box helper
			  boxHelper = new THREE.Box3Helper(newBox, 0xff00ff);
			  boxHelper.visible = settings.showBoundingBox;
			  scene.add(boxHelper);
			}
		});
	});
}


function initAudio() {
	audioListener = new THREE.AudioListener();
	camera.add(audioListener);

	const loader = new THREE.AudioLoader();
	const loadPromises = [];

	Object.entries(audio_objects).forEach(([trackName, trackData]) => {
		const sound = new THREE.Audio(audioListener);

		const promise = new Promise((resolve) => {
			loader.load(
				trackData.url,
				buffer => {
					sound.setBuffer(buffer);
					sound.setLoop(true);
					sound.setVolume(0.8);
					audio_objects[trackName].object = sound;
					resolve();
				},
				undefined,
				err => {
					console.warn(`Failed to load audio for: ${trackName}`, err);
					resolve(); // resolve anyway to continue
				}
			);
			const analyser = new THREE.AudioAnalyser(sound, 128);
			audio_objects[trackName].analyser = analyser;
		});

		loadPromises.push(promise);
	});

	// Return a promise that resolves when all tracks are ready
	return Promise.all(loadPromises);
}

function onWindowResize() {
	if (visualizerCanvas) {
		visualizerCanvas.width = window.innerWidth;
		visualizerCanvas.height = 100;
	}

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}


function animate() {
	checkAudioLabels();
	render();
	controls.update();	
	stats.update();
}

function checkAudioLabels()	{
	if (settings.audioTrack !== 'None') {
		const current = audio_objects[settings.audioTrack];
		if (current && current.object) {
			const isNowPlaying = current.object.isPlaying;
			const shouldBeLabel = isNowPlaying ? PAUSE_LABEL : PLAY_LABEL;

			if (audioControl.label !== shouldBeLabel) {
				audioControl.label = shouldBeLabel;
				if (playPauseController) {
					playPauseController.name(audioControl.label);
				}
			}
		}
	}
}

function getVertexCount() {
	return Math.floor(settings.numSprites);
}

function playSelectedAudio(track) {
	// Stop all currently playing tracks
	Object.values(audio_objects).forEach(obj => {
		if (obj.object && obj.object.isPlaying) {
			obj.object.stop();
		}
	});

	settings.audioTrack = track;
	if (audioTrackController) {
	  audioTrackController.updateDisplay();
	}

	if (track === 'None') {
		audioControl.label = NO_MUSIC_LABEL;
	} else {
		const selected = audio_objects[track];
		if (selected && selected.object) {
			selected.object.play();
			audioControl.label = PAUSE_LABEL;
		} else {
			audioControl.label = NO_MUSIC_LABEL;
		}
	}

	if (playPauseController) {
		playPauseController.name(audioControl.label);
	}
}


function getFrequencyBands(analyser) {
	if (!analyser) return null;

	const data = analyser.getFrequencyData(); // Uint8Array of length = fftSize / 2
	const bass = average_fn(data.slice(0, 20));       // low
	const mids = average_fn(data.slice(20, 80));      // mid
	const highs = average_fn(data.slice(80));         // high

	return {
		bass: bass / 255,
		mids: mids / 255,
		highs: highs / 255
	};
}

function average_fn(arr) {
	let sum = 0;
	for (let i = 0; i < arr.length; i++) sum += arr[i];
	return arr.length > 0 ? sum / arr.length : 0;
}


function renderVisualiser(current)	{
	if (visualizerCtx && current?.analyser) {
		const data = current.analyser.getFrequencyData();
		const width = visualizerCanvas.width;
		const height = visualizerCanvas.height;
		const barWidth = width / data.length;

		visualizerCtx.clearRect(0, 0, width, height);

		for (let i = 0; i < data.length; i++) {
			const value = data[i];
			const barHeight = value / 255 * height;

			let color;
			if (i < 20) color = BAND_COLORS.bass;
			else if (i < 40) color = BAND_COLORS.mids;
			else color = BAND_COLORS.highs;

			visualizerCtx.fillStyle = color;
			visualizerCtx.fillRect(i * barWidth, height - barHeight, barWidth * 0.8, barHeight);
		}
	}


}

function render() {

	let bandData = null;
	const current = audio_objects[settings.audioTrack];
	if (current && current.object && current.object?.isPlaying && current.analyser) {
		bandData = getFrequencyBands(current.analyser);
	}


	for (let points of sprite_objects) {
		const positions = points.geometry.getAttribute('position');
		const velocities = points.geometry.getAttribute('zVelocity');

		// Adjust with the music:
		if (bandData) {
			// Pulsating sprites:
			// Bass = pulsate
			for (let p of bassGroup) {
				p.scale.setScalar(1 + bandData.bass * 0.9);
			}

			// Mids = zoom forward/back slightly
			for (let p of midsGroup) {
				p.position.z += Math.sin(Date.now() * 0.015) * bandData.mids * 2;
			}

			// Highs = hue shift
			for (let p of highsGroup) {
				if (p.material?.uniforms?.hueShift) {
					p.material.uniforms.hueShift.value += bandData.highs * 0.01;
				}
			}
		}

		for (let i = 0; i < positions.count; i++) {
			let z = positions.getZ(i);
			z += velocities.getX(i) * settings.zSpeedMultiplier;

			if (z > camera.position.z + WRAP_BUFFER) {
				z = camera.position.z - MAX_Z_VALUE;
			}
			positions.setZ(i, z);
		}
		positions.needsUpdate = true;

		const mat = points.material;

		// Update fog if present
		if (mat.uniforms.fogDensity) {
			mat.uniforms.fogDensity.value = scene.fog.density;
			mat.uniforms.fogColor.value.copy(scene.fog.color);
		}

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

	renderVisualiser(current);
	renderer.render(scene, camera);
}




