import * as THREE from './three.module.js'

import { FBXLoader } from './FBXLoader.js'
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

class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations
  }

  get animations() {
    return this._animations
  }
}

class ThirdPersonCamera {
  constructor(params) {
    this._params = params
    this._camera = params.camera

    this._currentPosition = new THREE.Vector3()
    this._currentLookat = new THREE.Vector3()
  }
  _CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(-15, 35, -75)
    idealOffset.applyQuaternion(this._params.target.Rotation)
    idealOffset.add(this._params.target.Position)
    return idealOffset
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 10, 10)
    idealLookat.applyQuaternion(this._params.target.Rotation)
    idealLookat.add(this._params.target.Position)
    return idealLookat
  }

  Update(timeElapsed) {
    const idealOffset = this._CalculateIdealOffset()
    const idealLookat = this._CalculateIdealLookat()

    // const t = 0.05;
    // const t = 4.0 * timeElapsed;
    const t = 1.0 - Math.pow(0.001, timeElapsed)

    this._currentPosition.lerp(idealOffset, t)
    this._currentLookat.lerp(idealLookat, t)

    this._camera.position.copy(this._currentPosition)
    this._camera.lookAt(this._currentLookat)
  }
}

class BasicCharacterController {
  constructor(params) {
    this._Init(params)
  }

  _Init(params) {
    this._params = params
    this._decceleration = new THREE.Vector3(-0.0005, -0.0005, -5.0)
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0)
    this._velocity = new THREE.Vector3(0, 0, 0)
    this._position = new THREE.Vector3()

    this._animations = {}
    this._input = new BasicCharacterControllerInput()
    this._stateMachine = new CharacterFSM(
      new BasicCharacterControllerProxy(this._animations)
    )

    this._LoadModels()
  }

  _LoadModels() {
    const loader = new FBXLoader()
    loader.setPath('../modelos/low-poly-character/source/')
    loader.load('Standing W_Briefcase Idle.fbx', (fbx) => {
      fbx.scale.setScalar(0.1)
      fbx.scale.set(0.0005, 0.0005, 0.0005)
      fbx.position.set(-5, -0.65, -1.5)
      const loaderTexture = new THREE.TextureLoader()
      const textureCharacter = loaderTexture.load(
        '../modelos/low-poly-character/textures/Material.007_Base_Color.png'
      )

      fbx.traverse((c) => {
        c.castShadow = true
        if (c.isMesh) {
          c.material.map = textureCharacter // assign your diffuse texture here
        }
      })

      this._target = fbx
      this._params.scene.add(this._target)

      this._mixer = new THREE.AnimationMixer(this._target)

      this._manager = new THREE.LoadingManager()
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle')
      }

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0]
        const action = this._mixer.clipAction(clip)

        this._animations[animName] = {
          clip: clip,
          action: action,
        }
      }

      const loader = new FBXLoader(this._manager)
      loader.setPath('../modelos/low-poly-character/source/')
      loader.load('Pistol Walk.fbx', (a) => {
        _OnLoad('walk', a)
      })
      loader.load('Pistol Run.fbx', (a) => {
        _OnLoad('run', a)
      })
      loader.load('Pistol Idle.fbx', (a) => {
        _OnLoad('idle', a)
      })
    })
  }
  get Position() {
    return this._position
  }

  get Rotation() {
    if (!this._target) {
      return new THREE.Quaternion()
    }
    return this._target.quaternion
  }

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return
    }

    this._stateMachine.Update(timeInSeconds, this._input)

    const velocity = this._velocity
    const frameDecceleration = new THREE.Vector3(
      velocity.x * this._decceleration.x,
      velocity.y * this._decceleration.y,
      velocity.z * this._decceleration.z
    )
    frameDecceleration.multiplyScalar(timeInSeconds)
    frameDecceleration.z =
      Math.sign(frameDecceleration.z) *
      Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z))

    velocity.add(frameDecceleration)

    const controlObject = this._target
    const _Q = new THREE.Quaternion()
    const _A = new THREE.Vector3()
    const _R = controlObject.quaternion.clone()

    const acc = this._acceleration.clone()
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0)
    }

    if (this._stateMachine._currentState.Name == 'dance') {
      acc.multiplyScalar(0.0)
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0)
      _Q.setFromAxisAngle(
        _A,
        4.0 * Math.PI * timeInSeconds * this._acceleration.y
      )
      _R.multiply(_Q)
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0)
      _Q.setFromAxisAngle(
        _A,
        4.0 * -Math.PI * timeInSeconds * this._acceleration.y
      )
      _R.multiply(_Q)
    }

    controlObject.quaternion.copy(_R)

    const oldPosition = new THREE.Vector3()
    oldPosition.copy(controlObject.position)

    const forward = new THREE.Vector3(0, 0, 1)
    forward.applyQuaternion(controlObject.quaternion)
    forward.normalize()

    const sideways = new THREE.Vector3(1, 0, 0)
    sideways.applyQuaternion(controlObject.quaternion)
    sideways.normalize()

    sideways.multiplyScalar(velocity.x * timeInSeconds)
    forward.multiplyScalar(velocity.z * timeInSeconds)

    controlObject.position.add(forward)
    controlObject.position.add(sideways)

    this._position.copy(controlObject.position)

    if (this._mixer) {
      this._mixer.update(timeInSeconds)
    }
  }
}

class BasicCharacterControllerInput {
  constructor() {
    this._Init()
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    }
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false)
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false)
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = true
        break
      case 65: // a
        this._keys.left = true
        break
      case 83: // s
        this._keys.backward = true
        break
      case 68: // d
        this._keys.right = true
        break
      case 32: // SPACE
        this._keys.space = true
        break
      case 16: // SHIFT
        this._keys.shift = true
        break
    }
  }

  _onKeyUp(event) {
    switch (event.keyCode) {
      case 87: // w
        this._keys.forward = false
        break
      case 65: // a
        this._keys.left = false
        break
      case 83: // s
        this._keys.backward = false
        break
      case 68: // d
        this._keys.right = false
        break
      case 32: // SPACE
        this._keys.space = false
        break
      case 16: // SHIFT
        this._keys.shift = false
        break
    }
  }
}

class FiniteStateMachine {
  constructor() {
    this._states = {}
    this._currentState = null
  }

  _AddState(name, type) {
    this._states[name] = type
  }

  SetState(name) {
    const prevState = this._currentState

    if (prevState) {
      if (prevState.Name == name) {
        return
      }
      prevState.Exit()
    }

    const state = new this._states[name](this)

    this._currentState = state
    state.Enter(prevState)
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input)
    }
  }
}

class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super()
    this._proxy = proxy
    this._Init()
  }

  _Init() {
    this._AddState('idle', IdleState)
    this._AddState('walk', WalkState)
    this._AddState('run', RunState)
  }
}

class State {
  constructor(parent) {
    this._parent = parent
  }

  Enter() {}
  Exit() {}
  Update() {}
}

class WalkState extends State {
  constructor(parent) {
    super(parent)
  }

  get Name() {
    return 'walk'
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action

      curAction.enabled = true

      if (prevState.Name == 'run') {
        const ratio =
          curAction.getClip().duration / prevAction.getClip().duration
        curAction.time = prevAction.time * ratio
      } else {
        curAction.time = 0.0
        curAction.setEffectiveTimeScale(1.0)
        curAction.setEffectiveWeight(1.0)
      }

      curAction.crossFadeFrom(prevAction, 0.5, true)
      curAction.play()
    } else {
      curAction.play()
    }
  }

  Exit() {}

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run')
      }
      return
    }

    this._parent.SetState('idle')
  }
}

class RunState extends State {
  constructor(parent) {
    super(parent)
  }

  get Name() {
    return 'run'
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action

      curAction.enabled = true

      if (prevState.Name == 'walk') {
        const ratio =
          curAction.getClip().duration / prevAction.getClip().duration
        curAction.time = prevAction.time * ratio
      } else {
        curAction.time = 0.0
        curAction.setEffectiveTimeScale(1.0)
        curAction.setEffectiveWeight(1.0)
      }

      curAction.crossFadeFrom(prevAction, 0.5, true)
      curAction.play()
    } else {
      curAction.play()
    }
  }

  Exit() {}

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk')
      }
      return
    }

    this._parent.SetState('idle')
  }
}

class IdleState extends State {
  constructor(parent) {
    super(parent)
  }

  get Name() {
    return 'idle'
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action
      idleAction.time = 0.0
      idleAction.enabled = true
      idleAction.setEffectiveTimeScale(1.0)
      idleAction.setEffectiveWeight(1.0)
      idleAction.crossFadeFrom(prevAction, 0.5, true)
      idleAction.play()
    } else {
      idleAction.play()
    }
  }

  Exit() {}

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk')
    } else if (input._keys.space) {
      this._parent.SetState('dance')
    }
  }
}

class CharacterControllerDemo {
  constructor() {
    this._Initialize()
  }

  _Initialize() {
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

    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    })
    this._threejs.outputEncoding = THREE.sRGBEncoding
    this._threejs.shadowMap.enabled = true
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap
    this._threejs.setPixelRatio(window.devicePixelRatio)
    this._threejs.setSize(window.innerWidth, window.innerHeight)

    document.body.appendChild(this._threejs.domElement)

    window.addEventListener(
      'resize',
      () => {
        this._OnWindowResize()
      },
      false
    )

    const fov = 60
    const aspect = window.innerWidth / window.innerHeight
    const near = 1.0
    const far = 1000.0

    this.shaders_ = []
    const ModifyShader_ = (s) => {
      this.shaders_.push(s)
      s.uniforms.fogTime = { value: 0.0 }
    }
    // SCENE
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('grey')
    this._scene = scene

    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
    this._camera.position.set(25, 10, 25)

    let light = new THREE.DirectionalLight(0xffffff, 0.35)
    light.position.set(-100, 100, 100)
    light.target.position.set(0, 0, 0)
    light.castShadow = true
    light.shadow.bias = -0.001
    light.shadow.mapSize.width = 4096
    light.shadow.mapSize.height = 4096
    light.shadow.camera.near = 0.5
    light.shadow.camera.far = 500.0
    light.shadow.camera.left = -500
    light.shadow.camera.right = 500
    light.shadow.camera.top = 500
    light.shadow.camera.bottom = -500
    this._scene.add(light)

    let ambientLight = new THREE.AmbientLight(0x101010)
    this._scene.add(ambientLight)

    const planeGeometry = new THREE.PlaneGeometry(500, 500)
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 'slategrey',
    })
    const plane = new THREE.Mesh(planeGeometry, planeMaterial)
    plane.position.set(0, -0.5, 0)
    plane.castShadow = false
    plane.receiveShadow = true
    plane.rotation.x = -Math.PI / 2

    plane.material.onBeforeCompile = ModifyShader_
    this._scene.add(plane)

    this._scene.fog = new THREE.FogExp2(0xdfe9f3, 0.000175)

    this._mixers = []
    this._previousRAF = null

    // LOAD ------ PAREDES
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      25,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -25,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -80,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      80,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -135,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      135,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -190,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      190,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -230,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -230,
      -0.65,
      -250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      200,
      -0.65,
      -250,
      0.05,
      0
    )

    //LOAD ------ PARED FRENTE
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      25,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -25,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -80,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      80,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -135,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      135,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -190,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      190,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -230,
      -0.65,
      250,
      0.05,
      0
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      200,
      -0.65,
      250,
      0.05,
      0
    )

    //LOAD ------ PARED ESTE
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      250,
      -0.65,
      80,
      0.05,
      55
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      250,
      -0.65,
      -80,
      0.05,
      55
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      250,
      -0.65,
      -15,
      0.05,
      55
    )

    //LOAD ------ PARED OESTE
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -250,
      -0.65,
      80,
      0.05,
      55
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -250,
      -0.65,
      -80,
      0.05,
      55
    )
    this._LoadModel(
      '/modelos/low-poly-brick-wall/source/',
      'BrickWall.fbx',
      '/modelos/low-poly-brick-wall/textures/internal_ground_ao_texture.jpeg',
      -250,
      -0.65,
      -15,
      0.05,
      55
    )

    //LOAD ------ HOUSE
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -208,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      235,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      180,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -140,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -160,
      -0.65,
      -125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -40,
      -0.65,
      -125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -40,
      -0.65,
      -125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      160,
      -0.65,
      -125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      40,
      -0.65,
      -125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      110,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -70,
      -0.65,
      -225,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      20,
      -0.65,
      -225,
      0.05,
      0
    )

    //LOAD ------ HOUSE AL FRENTE
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -206,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      242,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      180,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -140,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      110,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -70,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      20,
      -0.65,
      210,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -160,
      -0.65,
      125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      -40,
      -0.65,
      125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      160,
      -0.65,
      125,
      0.05,
      0
    )
    this._LoadModel(
      'modelos/nivelles-house-9-belgium/source/',
      'nivelles 9.fbx',
      '/modelos/nivelles-house-9-belgium/textures/nivelles_9_d.png',
      40,
      -0.65,
      125,
      0.05,
      0
    )

    // URBAN PROPS
    this._LoadModel(
      'modelos/urban-lomon-props-low-polystylized-pack-01/source/',
      'Proop2.fbx',
      '/modelos/urban-lomon-props-low-polystylized-pack-01/textures/3.png',
      -100,
      -0.65,
      25.5,
      0.05,
      0
    )
    // BIND HUNTER
    this._LoadModel(
      'modelos/zombie-bind-hunter/source/',
      'BindHunter.fbx',
      '/modelos/zombie-bind-hunter/textures/BindHunter_Blind_Hunter_BaseColor.png',
      -95,
      -0.65,
      25.5,
      0.05,
      0
    )

    // ZOMBIE
    this._LoadModel('modelos/zombie/', 'Zombie.fbx', '', 0, 0, 0, 0.05, 0)
    // -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
    this._LoadAnimatedModel()
    this._RAF()
  }

  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new BasicCharacterController(params)

    this._thirdPersonCamera = new ThirdPersonCamera({
      camera: this._camera,
      target: this._controls,
    })
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

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight
    this._camera.updateProjectionMatrix()
    this._threejs.setSize(window.innerWidth, window.innerHeight)
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t
      }

      this._RAF()

      this._threejs.render(this._scene, this._camera)
      this._Step(t - this._previousRAF)
      this._previousRAF = t
    })
  }

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001
    if (this._mixers) {
      this._mixers.map((m) => m.update(timeElapsedS))
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS)
    }

    this._thirdPersonCamera.Update(timeElapsedS)
  }
}

export {
  State,
  CharacterFSM,
  FiniteStateMachine,
  BasicCharacterControllerInput,
  BasicCharacterController,
  BasicCharacterControllerProxy,
  IdleState,
  RunState,
  WalkState,
  CharacterControllerDemo,
}
