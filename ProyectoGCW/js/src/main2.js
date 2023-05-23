import * as THREE from './three.module.js';

import { third_person_camera } from './third-person-camera.js'
import { entity_manager } from './entity-manager.js'
import { player_entity } from './player-entity.js'
import { entity } from './entity.js'
import { gltf_component } from './gltf-component.js'
import { health_component } from './health-component.js'
import { player_input } from './player-input.js'
import { npc_entity } from './npc-entity.js'
import { math } from './math.js'
import { spatial_hash_grid } from './spatial-hash-grid.js'
import { ui_controller } from './ui-controller.js'
import { health_bar } from './health-bar.js'
import { level_up_component } from './level-up-component.js'
import { quest_component } from './quest-component.js'
import { spatial_grid_controller } from './spatial-grid-controller.js'
import { inventory_controller } from './inventory-controller.js'
import { equip_weapon_component } from './equip-weapon-component.js'
import { attack_controller } from './attacker-controller.js'
const _NOISE_GLSL = `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20201014 (stegu)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
{
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

float FBM(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 0.0;
  for (int i = 0; i < 6; ++i) {
    value += amplitude * snoise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
`

const _VS = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;


const _FS = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;

varying vec3 vWorldPosition;

void main() {
  float h = normalize( vWorldPosition + offset ).y;
  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
}`;


THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  vec3 fogOrigin = cameraPosition;
  vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
  float fogDepth = distance(vWorldPosition, fogOrigin);

  // f(p) = fbm( p + fbm( p ) )
  vec3 noiseSampleCoord = vWorldPosition * 0.00025 + vec3(
      0.0, 0.0, fogTime * 0.025);
  float noiseSample = FBM(noiseSampleCoord + FBM(noiseSampleCoord)) * 0.5 + 0.5;
  fogDepth *= mix(noiseSample, 1.0, saturate((fogDepth - 5000.0) / 5000.0));
  fogDepth *= fogDepth;

  float heightFactor = 0.075;
  float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (
      1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
  fogFactor = saturate(fogFactor);

  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`

THREE.ShaderChunk.fog_pars_fragment =
  _NOISE_GLSL +
  `
#ifdef USE_FOG
  uniform float fogTime;
  uniform vec3 fogColor;
  varying vec3 vWorldPosition;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`

THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vWorldPosition = worldPosition.xyz;
#endif`

THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying vec3 vWorldPosition;
#endif`



class ZombieGameLevel1 {
  constructor() {
    this._Initialize()
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    })
    this._threejs.outputEncoding = THREE.sRGBEncoding
    this._threejs.shadowMap.enabled = true
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap
    this._threejs.setPixelRatio(window.devicePixelRatio)
    this._threejs.setSize(window.innerWidth, window.innerHeight)
    this._threejs.domElement.id = 'threejs'

    document.getElementById('container').appendChild(this._threejs.domElement)

    window.addEventListener(
      'resize',
      () => {
        this._OnWindowResize()
      },
      false
    )

    const fov = 60
    const aspect = 1920 / 1080
    const near = 1.0
    const far = 1500.0
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    this._camera.position.set(25, 10, 25)

    this._scene = new THREE.Scene()
    this._scene.background = new THREE.Color(0xffffff)
    this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.002)

    let light = new THREE.DirectionalLight(0xffffff, 0.15)
    light.position.set(-10, 1000, 10)
    light.target.position.set(0, 0, 0)
    light.castShadow = true
    light.shadow.bias = -0.001
    light.shadow.mapSize.width = 4096
    light.shadow.mapSize.height = 4096
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 1000.0
    light.shadow.camera.left = 100
    light.shadow.camera.right = -100
    light.shadow.camera.top = 100
    light.shadow.camera.bottom = -100
    this._scene.add(light)

    this._sun = light

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 10, 10),
      new THREE.MeshStandardMaterial({
        color: '0x1e601c',
      })
    )
    plane.castShadow = false
    plane.receiveShadow = true
    plane.rotation.x = -Math.PI / 2
    this._scene.add(plane)

    this._entityManager = new entity_manager.EntityManager()
    this._grid = new spatial_hash_grid.SpatialHashGrid(
      [
        [-1000, -1000],
        [1000, 1000],
      ],
      [100, 100]
    )

    this._LoadControllers()
    this._LoadPlayer()
    this._LoadFoliage()
    this._LoadClouds()
    this._LoadSky()
    this._LoadEnvironmentSound()
    // -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
    this._previousRAF = null
    this._RAF()

    
  }

  _LoadControllers() {
    const ui = new entity.Entity()
    ui.AddComponent(new ui_controller.UIController())
    this._entityManager.Add(ui, 'ui')
  }

  _LoadEnvironmentSound(){
    this._listener = new THREE.AudioListener();
    this._camera.add(this._listener);
    const sound = new THREE.Audio(this._listener);
    const loader = new THREE.AudioLoader()
    loader.load('js/resources/sounds/nature015.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.2);
      sound.play()
    })
  }
  
  _LoadSky() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfffffff, 0.3)
    hemiLight.color.setHex(0x000033)
    hemiLight.groundColor.setHSL(0.095, 1, 0.15)
    this._scene.add(hemiLight)


    const uniforms = {
      "topColor": { value: new THREE.Color(0x000033) },
      "bottomColor": { value: new THREE.Color(0x000000) },
      "offset": { value: 33 },
      "exponent": { value: 0.6 }
    };
    uniforms['topColor'].value.copy(hemiLight.color)

    this._scene.fog.color.copy(uniforms['bottomColor'].value)

    const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: _VS,
      fragmentShader: _FS,
      side: THREE.BackSide,
    })

    const sky = new THREE.Mesh(skyGeo, skyMat)
    this._scene.add(sky)
  }

  _LoadClouds() {
    for (let i = 0; i < 20; ++i) {
      const index = math.rand_int(1, 3)
      const pos = new THREE.Vector3(
        (Math.random() * 2.0 - 1.0) * 500,
        100,
        (Math.random() * 2.0 - 1.0) * 500
      )

      const e = new entity.Entity()
      e.AddComponent(
        new gltf_component.StaticModelComponent({
          scene: this._scene,
          resourcePath: 'js/resources/nature2/GLTF/',
          resourceName: 'Cloud' + index + '.glb',
          position: pos,
          scale: Math.random() * 5 + 10,
          emissive: new THREE.Color(0x808080),
        })
      )
      e.SetPosition(pos)
      this._entityManager.Add(e)
      e.SetActive(false)
    }
  }

  _LoadFoliage() {
    for (let i = 0; i < 150; ++i) { // Cantidad ade Arboles
      const names = [
        'CommonTree_Dead',
        'CommonTree',
        'BirchTree',
        'BirchTree_Dead',
        'Willow',
        'Willow_Dead',
        'PineTree',
      ]
      const name = names[math.rand_int(0, names.length - 1)]
      const index = math.rand_int(1, 5)
      const halfSize = 250; // Mitad del tamaño del cuadrado (500 / 2)
      const pos = new THREE.Vector3(
        (Math.random() * halfSize * 2 - halfSize),
        0,
        (Math.random() * halfSize * 2 - halfSize)
      );

      const e = new entity.Entity()
      e.AddComponent(
        new gltf_component.StaticModelComponent({
          scene: this._scene,
          resourcePath: 'js/resources/nature/FBX/',
          resourceName: name + '_' + index + '.fbx',
          scale: 0.25,
          emissive: new THREE.Color(0x000000),
          specular: new THREE.Color(0x000000),
          receiveShadow: true,
          castShadow: true,
        })
      )
      e.AddComponent(
        new spatial_grid_controller.SpatialGridController({ grid: this._grid })
      )
      e.SetPosition(pos)
      this._entityManager.Add(e)
      e.SetActive(false)
    }
  }

  _LoadPlayer() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }

    const levelUpSpawner = new entity.Entity()
    levelUpSpawner.AddComponent(
      new level_up_component.LevelUpComponentSpawner({
        camera: this._camera,
        scene: this._scene,
      })
    )
    this._entityManager.Add(levelUpSpawner, 'level-up-spawner')

    const axe = new entity.Entity()
    axe.AddComponent(
      new inventory_controller.InventoryItem({
        type: 'weapon',
        damage: 3,
        renderParams: {
          name: 'Axe',
          scale: 0.25,
          icon: 'war-axe-64.png',
        },
      })
    )
    this._entityManager.Add(axe)

    const sword = new entity.Entity()
    sword.AddComponent(
      new inventory_controller.InventoryItem({
        type: 'weapon',
        damage: 3,
        renderParams: {
          name: 'Sword',
          scale: 0.25,
          icon: 'pointy-sword-64.png',
        },
      })
    )
    this._entityManager.Add(sword)

    const girl = new entity.Entity()
    girl.AddComponent(
      new gltf_component.AnimatedModelComponent({
        scene: this._scene,
        resourcePath: 'js/resources/girl/',
        resourceName: 'peasant_girl.fbx',
        resourceAnimation: 'Standing Idle.fbx',
        scale: 0.035,
        receiveShadow: true,
        castShadow: true,
      })
    )
    girl.AddComponent(
      new spatial_grid_controller.SpatialGridController({
        grid: this._grid,
      })
    )
    girl.AddComponent(new player_input.PickableComponent())
    girl.AddComponent(new quest_component.QuestComponent())
    girl.SetPosition(new THREE.Vector3(30, 0, 0))
    this._entityManager.Add(girl)

    const player = new entity.Entity()
    player.AddComponent(new player_input.BasicCharacterControllerInput(params))
    player.AddComponent(new player_entity.BasicCharacterController(params))
    player.AddComponent(
      new equip_weapon_component.EquipWeapon({
        anchor: 'RightHandIndex1',
      })
    )
    player.AddComponent(new inventory_controller.InventoryController(params))
    player.AddComponent(
      new health_component.HealthComponent({
        updateUI: true,
        health: 100,
        maxHealth: 100,
        strength: 50,
        wisdomness: 5,
        benchpress: 20,
        curl: 100,
        experience: 0,
        level: 1,
      })
    )
    player.AddComponent(
      new spatial_grid_controller.SpatialGridController({ grid: this._grid })
    )
    player.AddComponent(new attack_controller.AttackController({ timing: 0.7 }))
    this._entityManager.Add(player, 'player')

    player.Broadcast({
      topic: 'inventory.add',
      value: axe.Name,
      added: false,
    })

    player.Broadcast({
      topic: 'inventory.add',
      value: sword.Name,
      added: false,
    })

    player.Broadcast({
      topic: 'inventory.equip',
      value: sword.Name,
      added: false,
    })

    const camera = new entity.Entity()
    camera.AddComponent(
      new third_person_camera.ThirdPersonCamera({
        camera: this._camera,
        target: this._entityManager.Get('player'),
      })
    )
    this._entityManager.Add(camera, 'player-camera')

    for (let i = 0; i < 30; ++i) {
      const monsters = [
        {
          resourceName: 'Zombie.fbx'
        }
      ]
      const m = monsters[math.rand_int(0, monsters.length - 1)]

      const npc = new entity.Entity()
      npc.AddComponent(
        new npc_entity.NPCController({
          camera: this._camera,
          scene: this._scene,
          resourceName: m.resourceName,
        })
      )
      npc.AddComponent(
        new health_component.HealthComponent({
          health: 50,
          maxHealth: 50,
          strength: 2,
          wisdomness: 2,
          benchpress: 3,
          curl: 1,
          experience: 0,
          level: 1,
          camera: this._camera,
          scene: this._scene,
        })
      )
      npc.AddComponent(
        new spatial_grid_controller.SpatialGridController({ grid: this._grid })
      )
      npc.AddComponent(
        new health_bar.HealthBar({
          parent: this._scene,
          camera: this._camera,
        })
      )
      npc.AddComponent(new attack_controller.AttackController({ timing: 0.35 }))
      npc.SetPosition(
        new THREE.Vector3(
          (Math.random() * 2 - 1) * 500,
          0,
          (Math.random() * 2 - 1) * 500
        )
      )
      this._entityManager.Add(npc)
    }
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight
    this._camera.updateProjectionMatrix()
    this._threejs.setSize(window.innerWidth, window.innerHeight)
  }

  _UpdateSun() {
    const player = this._entityManager.Get('player')
    const pos = player._position

    this._sun.position.copy(pos)
    this._sun.position.add(new THREE.Vector3(-10, 1000, -10))
    this._sun.target.position.copy(pos)
    this._sun.updateMatrixWorld()
    this._sun.target.updateMatrixWorld()
  }

 

  _LoadModel(path, modelFile, textureFile, posX, posY, posZ, scale, rotY) {
    const loader = new FBXLoader()
    loader.setPath(path)
    loader.load(modelFile, (fbx) => {
      fbx.scale.set(scale, scale, scale)
      fbx.position.set(posX, posY, posZ)
      fbx.rotateY(rotY)

      if (textureFile == '') {
        fbx.traverse(function (child) {
          child.castShadow = true
        })
        this._scene.add(fbx)
        return
      }

      const loader = new THREE.TextureLoader()
      const textureBrickWall = loader.load(textureFile)

      fbx.traverse(function (child) {
        child.castShadow = true
        if (child.isMesh) {
          child.material.map = textureBrickWall // assign your diffuse texture here
        }
      })
      this._scene.add(fbx)
    })
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001)

    this._UpdateSun()

    this._entityManager.Update(timeElapsedS)
  }


}

class ZombieGameLevel1HardMode {
  constructor() {
    this._Initialize()
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    })
    this._threejs.outputEncoding = THREE.sRGBEncoding
    this._threejs.shadowMap.enabled = true
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap
    this._threejs.setPixelRatio(window.devicePixelRatio)
    this._threejs.setSize(window.innerWidth, window.innerHeight)
    this._threejs.domElement.id = 'threejs'

    document.getElementById('container').appendChild(this._threejs.domElement)

    window.addEventListener(
      'resize',
      () => {
        this._OnWindowResize()
      },
      false
    )

    const fov = 60
    const aspect = 1920 / 1080
    const near = 1.0
    const far = 1000.0
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    this._camera.position.set(25, 10, 25)

    this._scene = new THREE.Scene()
    this._scene.background = new THREE.Color(0xffffff)
    this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.002)

    let light = new THREE.DirectionalLight(0xffffff, 0.15)
    light.position.set(-10, 1000, 10)
    light.target.position.set(0, 0, 0)
    light.castShadow = true
    light.shadow.bias = -0.001
    light.shadow.mapSize.width = 4096
    light.shadow.mapSize.height = 4096
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 1000.0
    light.shadow.camera.left = 100
    light.shadow.camera.right = -100
    light.shadow.camera.top = 100
    light.shadow.camera.bottom = -100
    this._scene.add(light)

    this._sun = light

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 10, 10),
      new THREE.MeshStandardMaterial({
        color: '0x1e601c',
      })
    )
    plane.castShadow = false
    plane.receiveShadow = true
    plane.rotation.x = -Math.PI / 2
    this._scene.add(plane)

    this._entityManager = new entity_manager.EntityManager()
    this._grid = new spatial_hash_grid.SpatialHashGrid(
      [
        [-1000, -1000],
        [1000, 1000],
      ],
      [100, 100]
    )

    this._LoadControllers()
    this._LoadPlayer()
    this._LoadFoliage()
    this._LoadClouds()
    this._LoadSky()
    this._LoadEnvironmentSound()
    // -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
    this._previousRAF = null
    this._RAF()

    
  }

  _LoadControllers() {
    const ui = new entity.Entity()
    ui.AddComponent(new ui_controller.UIController())
    this._entityManager.Add(ui, 'ui')
  }

  _LoadEnvironmentSound(){
    this._listener = new THREE.AudioListener();
    this._camera.add(this._listener);
    const sound = new THREE.Audio(this._listener);
    const loader = new THREE.AudioLoader()
    loader.load('js/resources/sounds/nature015.mp3', (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.2);
      sound.play()
    })
  }
  
  _LoadSky() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfffffff, 0.3)
    hemiLight.color.setHex(0x000033)
    hemiLight.groundColor.setHSL(0.095, 1, 0.15)
    this._scene.add(hemiLight)


    const uniforms = {
      "topColor": { value: new THREE.Color(0xFF0000) },
      "bottomColor": { value: new THREE.Color(0x000000) },
      "offset": { value: 33 },
      "exponent": { value: 0.6 }
    };
    uniforms['topColor'].value.copy(hemiLight.color)

    this._scene.fog.color.copy(uniforms['bottomColor'].value)

    const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: _VS,
      fragmentShader: _FS,
      side: THREE.BackSide,
    })

    const sky = new THREE.Mesh(skyGeo, skyMat)
    this._scene.add(sky)
  }

  _LoadClouds() {
    for (let i = 0; i < 20; ++i) {
      const index = math.rand_int(1, 3)
      const pos = new THREE.Vector3(
        (Math.random() * 2.0 - 1.0) * 500,
        100,
        (Math.random() * 2.0 - 1.0) * 500
      )

      const e = new entity.Entity()
      e.AddComponent(
        new gltf_component.StaticModelComponent({
          scene: this._scene,
          resourcePath: 'js/resources/nature2/GLTF/',
          resourceName: 'Cloud' + index + '.glb',
          position: pos,
          scale: Math.random() * 5 + 10,
          emissive: new THREE.Color(0x808080),
        })
      )
      e.SetPosition(pos)
      this._entityManager.Add(e)
      e.SetActive(false)
    }
  }

  _LoadFoliage() {
    for (let i = 0; i < 150; ++i) { // Cantidad ade Arboles
      const names = [
        'CommonTree_Dead',
        'CommonTree',
        'BirchTree',
        'BirchTree_Dead',
        'Willow',
        'Willow_Dead',
        'PineTree',
      ]
      const name = names[math.rand_int(0, names.length - 1)]
      const index = math.rand_int(1, 5)
      const halfSize = 250; // Mitad del tamaño del cuadrado (500 / 2)
      const pos = new THREE.Vector3(
        (Math.random() * halfSize * 2 - halfSize),
        0,
        (Math.random() * halfSize * 2 - halfSize)
      );

      const e = new entity.Entity()
      e.AddComponent(
        new gltf_component.StaticModelComponent({
          scene: this._scene,
          resourcePath: 'js/resources/nature/FBX/',
          resourceName: name + '_' + index + '.fbx',
          scale: 0.25,
          emissive: new THREE.Color(0x000000),
          specular: new THREE.Color(0x000000),
          receiveShadow: true,
          castShadow: true,
        })
      )
      e.AddComponent(
        new spatial_grid_controller.SpatialGridController({ grid: this._grid })
      )
      e.SetPosition(pos)
      this._entityManager.Add(e)
      e.SetActive(false)
    }
  }

  _LoadPlayer() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }

    const levelUpSpawner = new entity.Entity()
    levelUpSpawner.AddComponent(
      new level_up_component.LevelUpComponentSpawner({
        camera: this._camera,
        scene: this._scene,
      })
    )
    this._entityManager.Add(levelUpSpawner, 'level-up-spawner')

    const axe = new entity.Entity()
    axe.AddComponent(
      new inventory_controller.InventoryItem({
        type: 'weapon',
        damage: 3,
        renderParams: {
          name: 'Axe',
          scale: 0.25,
          icon: 'war-axe-64.png',
        },
      })
    )
    this._entityManager.Add(axe)

    const sword = new entity.Entity()
    sword.AddComponent(
      new inventory_controller.InventoryItem({
        type: 'weapon',
        damage: 1.75,
        renderParams: {
          name: 'Sword',
          scale: 0.25,
          icon: 'pointy-sword-64.png',
        },
      })
    )
    this._entityManager.Add(sword)

    const girl = new entity.Entity()
    girl.AddComponent(
      new gltf_component.AnimatedModelComponent({
        scene: this._scene,
        resourcePath: 'js/resources/girl/',
        resourceName: 'peasant_girl.fbx',
        resourceAnimation: 'Standing Idle.fbx',
        scale: 0.035,
        receiveShadow: true,
        castShadow: true,
      })
    )
    girl.AddComponent(
      new spatial_grid_controller.SpatialGridController({
        grid: this._grid,
      })
    )
    girl.AddComponent(new player_input.PickableComponent())
    girl.AddComponent(new quest_component.QuestComponent())
    girl.SetPosition(new THREE.Vector3(30, 0, 0))
    this._entityManager.Add(girl)

    const player = new entity.Entity()
    player.AddComponent(new player_input.BasicCharacterControllerInput(params))
    player.AddComponent(new player_entity.BasicCharacterController(params))
    player.AddComponent(
      new equip_weapon_component.EquipWeapon({
        anchor: 'RightHandIndex1',
      })
    )
    player.AddComponent(new inventory_controller.InventoryController(params))
    player.AddComponent(
      new health_component.HealthComponent({
        updateUI: true,
        health: 60,
        maxHealth: 100,
        strength: 25,
        wisdomness: 5,
        benchpress: 20,
        curl: 100,
        experience: 0,
        level: 1,
      })
    )
    player.AddComponent(
      new spatial_grid_controller.SpatialGridController({ grid: this._grid })
    )
    player.AddComponent(new attack_controller.AttackController({ timing: 0.7 }))
    this._entityManager.Add(player, 'player')

    player.Broadcast({
      topic: 'inventory.add',
      value: axe.Name,
      added: false,
    })

    player.Broadcast({
      topic: 'inventory.add',
      value: sword.Name,
      added: false,
    })

    player.Broadcast({
      topic: 'inventory.equip',
      value: sword.Name,
      added: false,
    })

    const camera = new entity.Entity()
    camera.AddComponent(
      new third_person_camera.ThirdPersonCamera({
        camera: this._camera,
        target: this._entityManager.Get('player'),
      })
    )
    this._entityManager.Add(camera, 'player-camera')

    for (let i = 0; i < 30; ++i) {
      const monsters = [
        {
          resourceName: 'Zombie.fbx'
        }
      ]
      const m = monsters[math.rand_int(0, monsters.length - 1)]

      const npc = new entity.Entity()
      npc.AddComponent(
        new npc_entity.NPCController({
          camera: this._camera,
          scene: this._scene,
          resourceName: m.resourceName,
        })
      )
      npc.AddComponent(
        new health_component.HealthComponent({
          health: 50,
          maxHealth: 150,
          strength: 5,
          wisdomness: 2,
          benchpress: 3,
          curl: 1,
          experience: 0,
          level: 1,
          camera: this._camera,
          scene: this._scene,
        })
      )
      npc.AddComponent(
        new spatial_grid_controller.SpatialGridController({ grid: this._grid })
      )
      npc.AddComponent(
        new health_bar.HealthBar({
          parent: this._scene,
          camera: this._camera,
        })
      )
      npc.AddComponent(new attack_controller.AttackController({ timing: 0.35 }))
      npc.SetPosition(
        new THREE.Vector3(
          (Math.random() * 2 - 1) * 500,
          0,
          (Math.random() * 2 - 1) * 500
        )
      )
      this._entityManager.Add(npc)
    }
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight
    this._camera.updateProjectionMatrix()
    this._threejs.setSize(window.innerWidth, window.innerHeight)
  }

  _UpdateSun() {
    const player = this._entityManager.Get('player')
    const pos = player._position

    this._sun.position.copy(pos)
    this._sun.position.add(new THREE.Vector3(-10, 1000, -10))
    this._sun.target.position.copy(pos)
    this._sun.updateMatrixWorld()
    this._sun.target.updateMatrixWorld()
  }

 

  _LoadModel(path, modelFile, textureFile, posX, posY, posZ, scale, rotY) {
    const loader = new FBXLoader()
    loader.setPath(path)
    loader.load(modelFile, (fbx) => {
      fbx.scale.set(scale, scale, scale)
      fbx.position.set(posX, posY, posZ)
      fbx.rotateY(rotY)

      if (textureFile == '') {
        fbx.traverse(function (child) {
          child.castShadow = true
        })
        this._scene.add(fbx)
        return
      }

      const loader = new THREE.TextureLoader()
      const textureBrickWall = loader.load(textureFile)

      fbx.traverse(function (child) {
        child.castShadow = true
        if (child.isMesh) {
          child.material.map = textureBrickWall // assign your diffuse texture here
        }
      })
      this._scene.add(fbx)
    })
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  _Step(timeElapsed) {
    const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.0015)

    this._UpdateSun()

    this._entityManager.Update(timeElapsedS)
  }


}

let _APP = null
let isPausado = false

window.addEventListener('DOMContentLoaded', () => {


  var buttonPause = document.getElementById('icon-bar-pause');
  var buttonVolver = document.getElementById('volverJuego');
  var buttonInicio = document.getElementById('regresarInicio');
  var buttonConfiguracion = document.getElementById('verConfiguracion');
  var buttonvolverPausa = document.getElementById('volverPausaFromConfiguracion');

  var pausa = document.getElementById('pauseMenu');
  var juego = document.getElementById('container');
  var gameover = document.getElementById('GameOver');
  var configuracion = document.getElementById('Configuracion');

  
  
  buttonInicio.addEventListener('click', function() {
    window.location.href = "inicio.html";
})

 
buttonvolverPausa.addEventListener('click', function() {
  configuracion.style.display  = 'none';
  pausa.style.display  = 'block';
})

buttonConfiguracion.addEventListener('click', function() {
  pausa.style.display  = 'none';
  configuracion.style.display  = 'block';
})


  buttonPause.addEventListener('click', function() {
    isPausado = !isPausado

    if(!isPausado){
      pausa.style.display  = 'none';
      juego.style.display  = 'block';
    }
    else{
      pausa.style.display  = 'block';
      juego.style.display  = 'none';
    }
  })

  
  buttonVolver.addEventListener('click', function() {
    isPausado = !isPausado


    if(!isPausado){
      pausa.style.display  = 'none';
      juego.style.display  = 'block';
    }
    else{
      pausa.style.display  = 'block';
      juego.style.display  = 'none';
    }
  })
  

  if(confirm('¿Desea jugar en modo dificil?')){
    _APP = new ZombieGameLevel1HardMode()
  }
  else{
    _APP = new ZombieGameLevel1()
  }


  pausa.style.display  = 'none'
  gameover.style.display  = 'none'
  configuracion.style.display  = 'none'

})
