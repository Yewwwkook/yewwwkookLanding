import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

// Variables

    // Common
        // Size of Grid in meters
        let GrdSiz = 804.67;
            GrdSiz = 200;
        let GrdRCs = 2;

        // Water (Tropical)
        let WtrCol = 0x3ca0f8
        // Water (Navy)
        WtrCol = 0x2a2aa8;

    // Animated
        // Segments per Grid (fewer = less whitecaps)
        let segNum = 18;
        let GrdPtr = [0];
        let WavMZV = [0];
        let WavMXV = [0];
        let geoWav, matWav;
        // Uniform
        let gu = {
                time: {value: 0},
                grid: {value: GrdSiz},
            };

    // Textures
        let NrmSrc = ["https://threejs.org/examples/textures/waternormals.jpg"];
        // Pointer to Water Normal Map
        let WtrNrm = 0;
        // Wrap Reps
        let WtrRep = 3;
        // Load Flag
        let LodFlg = 0;						


// Basic values

    // Display
    let	scene = new THREE.Scene();
        // scene.background = new THREE.Color(0xcccccc);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(renderer.domElement);

    // Light
    let dirLight = new THREE.DirectionalLight(0xffffff,1);
        // Default position
        //	dirLight.position.set(0,2000,-1000);
        // High Noon
        dirLight.position.set(0, 2000, 0);
        scene.add(dirLight);

    // Camera
    let	camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 15000);
    let	controls = new OrbitControls(camera, renderer.domElement);
        camera.position.set(0, 200, 0);
        camera.lookAt(0, 0, 0);
        // disable interation with waves
        controls.enabled = false;

    // Clock
    let clock = new THREE.Clock();
    let	etime;

    // Loading Manager
        // Create a loading manager to set RESOURCES_LOADED when appropriate.
        // Pass loadingManager to all resource loaders.
    let loadingManager = new THREE.LoadingManager();
    let RESOURCES_LOADED = false;
        loadingManager.onLoad = function () {
			console.log("loaded all resources");
			RESOURCES_LOADED = true;
			initAll();

			// Hide loader after init
			const loader = document.getElementById("waveLoader");
			if (loader) loader.style.display = "none";
		};
    let txtrLoader = new THREE.TextureLoader(loadingManager);


// Main program
    loadAll();
    rendAll();


// Load all
function loadAll() {	
	// Normal Map
	txtrLoader.load(NrmSrc, function(texture) {
		texture.format = THREE.RGBAFormat;
		texture.magFilter = THREE.LinearFilter;
		texture.minFilter = THREE.LinearMipMapLinearFilter;
		texture.generateMipmaps = true;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		texture.offset.set(0,0);
		texture.repeat.set(WtrRep,WtrRep);
		texture.needsUpdate = true
		WtrNrm = texture;
	});
}


// Initialize

function initAll() {
	let n, zx;


// Main
	// Planes with Extended Material
	geoWav = new THREE.PlaneGeometry(GrdSiz,GrdSiz,segNum,segNum);
	geoWav.rotateX(-Math.PI * 0.5);
	matWav = new THREE.MeshStandardMaterial({
		normalMap: WtrNrm,
		metalness: 0.1,
		roughness: 0.4,
        transparent: true,
        opacity: 0.85,
		onBeforeCompile: shader => {
			shader.uniforms.time = gu.time;
			shader.uniforms.grid = gu.grid;
			shader.vertexShader = `
				uniform float time;
				uniform float grid;  
				varying float vHeight;
				vec3 moveWave(vec3 p){
					// Angle = distance offset + degree offset
					vec3 retVal = p;
					float ang;
					float kzx = 360.0/grid;
					// Wave1 (135 degrees)
					ang = 50.0*time + -1.0*p.x*kzx + -2.0*p.z*kzx;
					if (ang>360.0) ang = ang-360.0;
					ang = ang*3.14159265/180.0;
					retVal.y = 3.0*sin(ang);
					// Wave2 (090)
					ang = 25.0*time + -3.0*p.x*kzx;
					if (ang>360.0) ang = ang-360.0;
					ang = ang*3.14159265/180.0;
					retVal.y = retVal.y + 2.0*sin(ang);
					// Wave3 (180 degrees)
					ang = 15.0*time - 3.0*p.z*kzx;
					if (ang>360.0) ang = ang-360.0;
					ang = ang*3.14159265/180.0;
					retVal.y = retVal.y + 2.0*sin(ang);
					// Wave4 (225 degrees)
					ang = 50.0*time + 4.0*p.x*kzx + 8.0*p.z*kzx;
					if (ang>360.0) ang = ang-360.0;
					ang = ang*3.14159265/180.0;
					retVal.y = retVal.y + 0.5*sin(ang);
					// Wave5 (270 degrees)
					ang = 50.0*time + 8.0*p.x*kzx;
					if (ang>360.0) ang = ang-360.0;
					ang = ang*3.14159265/180.0;
					retVal.y = retVal.y + 0.5*sin(ang);
					//
					return retVal;
				}					
				${shader.vertexShader}
			`.replace(
				`#include <beginnormal_vertex>`,
				`#include <beginnormal_vertex>
					vec3 p = position;
       				vec2 move = vec2(1, 0);
					vec3 pos = moveWave(p);
					vec3 pos2 = moveWave(p + move.xyy);
					vec3 pos3 = moveWave(p + move.yyx);
					vNormal = normalize(cross(normalize(pos2-pos), normalize(pos3-pos)));
				`
			).replace(
				`#include <begin_vertex>`,
				`#include <begin_vertex>
					transformed.y = pos.y;
					vHeight = pos.y;
				`
			);
			shader.fragmentShader = `
				varying float vHeight;
				${shader.fragmentShader}
			`.replace(
				`#include <color_fragment>`,
				`#include <color_fragment>
					diffuseColor.rgb = mix(vec3(0.03125,0.0625,0.5), vec3(0.1,0.2,0.6), smoothstep(0.0, 6.0, vHeight));
					if (vHeight>7.0) {
						diffuseColor.rgb = vec3(0.2,0.3,0.7);	// Adds "foam" highlight to highest waves
					}
				`
			);
		}
	});
    
	// Compute Starting Z and X Values
	zx = -0.5*(GrdRCs)*GrdSiz+0.5*GrdSiz;
	for (let i = 0; i < GrdRCs; i++) {
		WavMZV[i] = zx;
		WavMXV[i] = zx;
		zx = zx + GrdSiz;
	}

	// 4 Adjacent Planes
	n = 0;
	for (let z = 0; z < GrdRCs; z++) {		// Row X2
		for (let x = 0; x < GrdRCs; x++) {	// Column X2
			GrdPtr[n] = new THREE.Mesh(geoWav,matWav);
			scene.add(GrdPtr[n]);
			GrdPtr[n].position.set(WavMXV[x],0,-WavMZV[z]);
			n++;
		}
	}
	//
	LodFlg = 1;
}


// Render
function rendAll() {
	requestAnimationFrame(rendAll);
	if (LodFlg > 0) {
		etime = clock.getElapsedTime();
		gu.time.value = etime;
  	    WtrNrm.offset.x -= .0005;
		WtrNrm.offset.y += .00025;
	}
	controls.update();
   	renderer.render(scene, camera);
}

window.addEventListener('resize', onWindowResize, false);

// Window resize input
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}