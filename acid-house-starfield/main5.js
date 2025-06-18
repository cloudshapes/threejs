import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, parameters;
let controls;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const materials = [];
const particles = [];
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

	// Color, sprite, size:	
	/*
	parameters = [
		[[ 1.0, 0.2, 0.5 ], sprite2, 200 ],
		[[ 0.95, 0.1, 0.5 ], sprite3, 60 ],
		[[ 0.90, 0.05, 0.5 ], sprite1, 30 ],
		[[ 0.85, 0, 0.5 ], sprite5, 28 ],
		[[ 0.80, 0, 0.5 ], sprite4, 25 ]
	];
	*/

	// Could we change this so that it is an array of dictionaries
	// and one of those values in the dictionary is speed?
	// and another is speed?
	// 

	// Color, sprite, size:	
	parameters = [
		[[ 1.0, 0.2, 0.5 ], sprite2, 200 ],
		[[ 0.95, 0.1, 0.5 ], sprite3, 60 ]
	];

	// Use different geometry per sprite:
	for (let i = 0; i < parameters.length; i++) {
	  const vertices = [];
	  for (let j = 0; j < N_VERTICES; j++) {
	    const x = Math.random() * 2000 - 1000;
	    const y = Math.random() * 2000 - 1000;
	    const z = Math.random() * 2000 - 1000;
	    vertices.push(x, y, z);
	  }
	  const geometry = new THREE.BufferGeometry();
	  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	  const color = parameters[i][0];
	  const sprite = parameters[i][1];
	  const size = parameters[i][2];

	  const material = new THREE.PointsMaterial({
	    size: size,
	    map: sprite,
	    blending: THREE.AdditiveBlending,
	    depthTest: false,
	    transparent: true
	  });
	  material.color.setHSL(color[0], color[1], color[2], THREE.SRGBColorSpace);
	  materials.push(material);

	  const points = new THREE.Points(geometry, material);
	  scene.add(points);
	  particles.push(points);
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

	for (let i = 0; i < particles.length; i++) {
		const p = particles[i];
		p.position.z += i / 2;
		if (p.position.z > 1000) p.position.z -= 2000;
	}

	/*
	for ( let i = 0; i < scene.children.length; i ++ ) {
		const object = scene.children[ i ];
		if ( object instanceof THREE.Points ) {

			// Rotates the entire THREE.Points object around its X axis (left-to-right line in 3D space).
			// This is defining the rotation around the X axis which in turn adjusts the Y and Z values
			// object.rotation.x = time * ( i < 4 ? i + 1 : - ( i + 1 ) );

			object.position.z +=  i/2;
      		if(object.position.z>1000) object.position.z-=2000; 

		}
	}
	*/

	/*
    // loop through each star
    for(var i=0; i<stars.length; i++) {
      
      var star = stars[i]; 
        
      // and move it forward dependent on the mouseY position. 
      star.position.z +=  i/10;
        
      // if the particle is too close move it to the back
      if(star.position.z>1000) star.position.z-=2000; 
      
    }
	*/

	for ( let i = 0; i < materials.length; i ++ ) {
		const color = parameters[ i ][ 0 ];
		const h = ( 360 * ( color[ 0 ] + time ) % 360 ) / 360;
		materials[ i ].color.setHSL( h, color[ 1 ], color[ 2 ], THREE.SRGBColorSpace );
	}
	 
	renderer.render( scene, camera );

}
