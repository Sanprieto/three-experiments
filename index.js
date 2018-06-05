import * as THREE from 'three'
import OrbitControls from 'three-orbitcontrols'
import Stats from 'stats.js'
import dat from 'dat.gui'
import cubeHelper from './cubeHelper'
import createGrids from './createGrids'
import CallbackMixer from './CallbackMixer'
import bufferGeometryMerger from './bufferGeometryMerger'
import {debounce, throttle, random, times, remove} from 'lodash'
import SimplexNoise from 'simplex-noise'

window.THREE = THREE
window.gui = new dat.GUI({closeOnTop: true, hideable: false, width: 350})
let stats = new Stats()
document.body.appendChild(stats.dom)
let clock = new THREE.Clock()

window.scene = new THREE.Scene()
scene.background = new THREE.Color( 0x000000);
//scene.background = new THREE.Color( 0xffffff);
let mixers = []

window.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000)
camera.position.set(-2000, 2100, 0)


window.renderer = new THREE.WebGLRenderer({antialias: true})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)
document.body.style.margin = 0

let gridsPosition = new THREE.Vector3(0, -25, 0)
let grids = createGrids(2000, 20, gridsPosition)
scene.add(grids)


var spriteMap = new THREE.TextureLoader().load( "assets/img/treeOne.png" );
var spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, light: true, transparent: true} );
var sprite = new THREE.Sprite( spriteMaterial );
scene.add( sprite );
sprite.position.set(800,290,0)
sprite.scale.set(700,700,700)

var geometry = new THREE.BoxGeometry( 600, 600, 600 );
var material = new THREE.MeshPhongMaterial( {color: 0x00ff00} );
var cube = new THREE.Mesh( geometry, material );
//scene.add( cube );

var light = new THREE.AmbientLight( 0x404040, 0.4); // soft white light
//scene.add( light );

let spotLight = new THREE.SpotLight( 0xffffff );
spotLight.position.set( 100, 1500, 100 );

spotLight.castShadow = true;

spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;

spotLight.shadow.camera.near = 500;
spotLight.shadow.camera.far = 4000;
spotLight.shadow.camera.fov = 30;

//scene.add( spotLight );


window.controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(200, 0, 0)
controls.enableKeys = false
controls.autoUpdate = false
controls.update()

//let light = new THREE.HemisphereLight('white', 'black', 2)
//scene.add(light)

let pointLight = new THREE.PointLight('red', 50, 10000)
pointLight.castShadow = true
//scene.add(pointLight)

// let lightHelper = new THREE.PointLightHelper(pointLight)
// scene.add(lightHelper)

var lighter = new THREE.PointLight( 0xffffff, 3, 700 );

window.sceneSettings = {
  Intensity: 3,
  Decay: 0.5,
  //lightMain: false,
}

let sceneFolder = gui.addFolder('scene')
  sceneFolder.add(sceneSettings, 'Intensity',  0.1, 100).step( 0.1 ).name('Intensity Light').onChange( function() { 
  lighter.intensity = sceneSettings.Intensity

  })
  sceneFolder.add(sceneSettings, 'Decay',  0, 3).onChange( function() { 
    console.log(sceneSettings.Decay)
    lighter.decay = sceneSettings.Decay
 
  })


let gridsFolder = gui.addFolder('grids')
gridsFolder.add(grids, 'visible')

let gridsRotationFolder = gridsFolder.addFolder('rotation')
gridsRotationFolder.add(grids.rotation, 'x', 0, 2*Math.PI, 0.1)
gridsRotationFolder.add(grids.rotation, 'y', 0, 2*Math.PI, 0.1)
gridsRotationFolder.add(grids.rotation, 'z', 0, 2*Math.PI, 0.1)

window.objects = new THREE.Group()
objects.name = 'objects'
scene.add(objects)

// let wglrt = new THREE.WebGLRenderTarget(512, 512, {format: THREE.RGBFormat})
// let sceneMaterial = new THREE.MeshBasicMaterial({map: wglrt})
let orangeMaterial = new THREE.MeshStandardMaterial({color: 'orange'/*, opacity: 0.9, transparent: true*/})
let greenMaterial = new THREE.MeshStandardMaterial({color: 'green'/*, opacity: 0.9, transparent: true*/})


function geometries () {
  let sphereGeometry = new THREE.SphereGeometry(50, 16, 16)
  let cubeGeometry = new THREE.BoxGeometry(75, 75, 75)
  cubeGeometry.translate(25, 25, 25)

  let sphereBufferGeometry = new THREE.BufferGeometry().fromGeometry(sphereGeometry).toNonIndexed()
  let cubeBufferGeometry = new THREE.BufferGeometry().fromGeometry(cubeGeometry).toNonIndexed()

  let mergedBufferGeometry = bufferGeometryMerger(sphereBufferGeometry, cubeBufferGeometry)
  let mergedBufferMesh = new THREE.Mesh(mergedBufferGeometry, greenMaterial)
  mergedBufferMesh.position.set(-100, 100, -100)

  let mergedGeometry = new THREE.Geometry()
  mergedGeometry.merge(cubeGeometry)
  mergedGeometry.merge(sphereGeometry)

  let geometrySettings = {
    amount: 100,
    addMergedBufferGeometries() {
      addClones(mergedBufferGeometry, this.amount, objects, greenMaterial)
    },
    addMergedGeometries() {
      addClones(mergedGeometry, this.amount, objects, orangeMaterial)
    },
    clearObjects() {
      clearChildren(objects)
    }
  }

  let geometriesFolder = gui.addFolder('geometries')
  geometriesFolder.add(objects.children, 'length').name('current amount').listen()
  geometriesFolder.add(geometrySettings, 'amount', 1, 5000, 50).name('geometries to merge')
  geometriesFolder.add(geometrySettings, 'addMergedBufferGeometries')
  geometriesFolder.add(geometrySettings, 'addMergedGeometries')
  geometriesFolder.add(geometrySettings, 'clearObjects')
  geometriesFolder.open()

  function addClones (geometry, amount, parent, material) {
    let clones = Array(amount).fill().map(() => {
      let clonedGeometry = geometry.clone()

      clonedGeometry.translate(
        random(-1000, 1000),
        random(0, 2000),
        random(-1000, 1000)
      )

      return clonedGeometry
    })

    let mergedClones

    if (geometry.isBufferGeometry) {
      mergedClones = bufferGeometryMerger(...clones)
    }
    else {
      mergedClones = new THREE.Geometry()
      clones.forEach(clone => mergedClones.merge(clone))
    }

    let mergedMesh = new THREE.Mesh(mergedClones, material)
    mergedMesh.castShadow = true
    mergedMesh.receiveShadow = true

    parent.add(mergedMesh)
  }
}

gui.add({geometries}, 'geometries').onChange(function(){this.remove()})

function clearChildren (group) {
  group.children.forEach(child => {
    if (child.geometry)
      child.geometry.dispose()

    child.parent = null
  })

  group.children.length = 0
}

function randUint24 () {
  return Math.floor(0xffffff * Math.random())
}

function rollerCoaster() {

  let rollerCoaster = new THREE.Group()
  scene.add(rollerCoaster)

  let vertexes = new Array(10).fill().map(() => {
    return new THREE.Vector3(
      random(-1000, 1000),
      random(0, 2000),
      random(-1000, 1000)
    )
  })

  let curve = new THREE.CatmullRomCurve3(vertexes, true)

  let points = curve.getPoints(3000)
  let geometry = new THREE.BufferGeometry().setFromPoints(points)
  let splineLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 'orange',
    linewidth: 2
  }))

  let railwayGeometry = new THREE.TubeGeometry(curve, 900, 4, 8, true)
  let railway = new THREE.Mesh(railwayGeometry, new THREE.MeshPhongMaterial({color: randUint24()}))

  rollerCoaster.add(splineLine)
  rollerCoaster.add(railway)

  let cube = cubeHelper(curve.getPointAt(0))
  rollerCoaster.add(cube)

  // let otherCube = cubeHelper(curve.getPointAt(0))
  // rollerCoaster.add(otherCube)

  let rollerCoasterSettings = {
    position: 0,
    timePerLoop: 30,
    enabled: true,
    cameraTracking: true,
    applyTrackingOffset: 'matrix',
    cameraLookAt: true
  }

  let updateCubePosition = function (delta) {
    rollerCoasterSettings.position = delta
    cube.position.copy(curve.getPointAt(delta))
    let x = curve.getPointAt((delta + 0.0001) % 1)
    cube.lookAt(x)
  }

  let updateCameraPosition = function (delta) {
    let cubePosition = curve.getPointAt(delta).clone()
    let offset = new THREE.Vector3(-100, 150, -100)
    let offsettedPosition = cubePosition.add(offset)

    if (rollerCoasterSettings.applyTrackingOffset == 'matrix') {
      offsettedPosition.applyMatrix4(cube.matrixWorld)
    }

    if (rollerCoasterSettings.applyTrackingOffset == 'quaternion') {
      offsettedPosition.applyQuaternion(cube.getWorldQuaternion())
    }

    if (rollerCoasterSettings.applyTrackingOffset == 'lerp') {
      let matrix = offsettedPosition.clone().applyMatrix4(cube.matrixWorld)
      let quaternion = offsettedPosition.clone().applyQuaternion(cube.getWorldQuaternion())

      offsettedPosition.copy(matrix.lerp(quaternion, 0.5))
    }

    // otherCube.position.copy(offsettedPosition)
    camera.position.copy(offsettedPosition)
    controls.update()
  }

  window.cubeMovementMixer = new CallbackMixer(ratio => {
    if (rollerCoasterSettings.enabled)
      updateCubePosition(ratio)

    if (rollerCoasterSettings.cameraTracking)
      updateCameraPosition(ratio)

    if (rollerCoasterSettings.cameraLookAt){
      camera.lookAt(cube.position)
    }

  }, 30, Infinity)

  let rollerCoasterFolder = gui.addFolder('rollerCoaster')

  let wagonFolder = rollerCoasterFolder.addFolder('wagon')

  wagonFolder.addColor({color: cube.material.color.getHex()}, 'color').name('color').onChange(function(selectedColor) {
    cube.material.color = new THREE.Color(selectedColor)
  })

  wagonFolder.addColor({color: cube.material.emissive.getHex()}, 'color').name('emissive').onChange(function(selectedColor) {
    cube.material.emissive = new THREE.Color(selectedColor)
  })

  wagonFolder.add(cube.material, 'wireframe')

  let motionFolder = wagonFolder.addFolder('motion')

  motionFolder.add(rollerCoasterSettings, 'position', 0, 0.9999, 0.001).onChange(value => {
    updateCubePosition(value)
  }).listen()

  motionFolder.add(rollerCoasterSettings, 'timePerLoop', 0, 60, 0.5).onChange(value => {
    cubeMovementMixer.setDuration(value)
  })

  motionFolder.add(rollerCoasterSettings, 'enabled').onChange(() => {
    cubeMovementMixer.pause()
  })

  let cameraFolder = rollerCoasterFolder.addFolder('camera')

  cameraFolder.add(rollerCoasterSettings, 'cameraLookAt').onChange(() => {
    // controls.update()
  })

  cameraFolder.add(rollerCoasterSettings, 'cameraTracking')
  cameraFolder.add(rollerCoasterSettings, 'applyTrackingOffset', ['none', 'matrix', 'quaternion', 'lerp'])

  let railwayFolder = rollerCoasterFolder.addFolder('railway')
  railwayFolder.add(railway.material, 'wireframe')
  railwayFolder.add(railway, 'visible').name('visible')
  railwayFolder.add(splineLine, 'visible').name('visible core')
  railwayFolder.addColor({color: railway.material.color.getHex()}, 'color').name('color').onChange(function(selectedColor) {
    railway.material.color = new THREE.Color(selectedColor)
  })


  mixers.push(cubeMovementMixer)

  // let controlsFolder = gui.addFolder('controls')
  // controlsFolder.add(controls, 'minPolarAngle', 0, 2*Math.PI)
  // controlsFolder.add(controls, 'maxPolarAngle', 0, 2*Math.PI)
  // controlsFolder.add(controls, 'minAzimuthAngle', 0, 2*Math.PI)
  // controlsFolder.add(controls, 'maxAzimuthAngle', 0, 2*Math.PI)
}

gui.add({rollerCoaster}, 'rollerCoaster').onChange(function(){this.remove()})


// function experiments (geometry) {
//   let originalPositions = geometry.attributes.normal.clone()

//   let experimentsFolder = gui.addFolder('experiments')
//   experimentsFolder.add({doIt() {

//     geometry.attributes.normal.array.forEach((value, idx) =>{
//       geometry.attributes.normal.array[idx] = random(0, 1)
//     })

//     geometry.attributes.normal.needsUpdate = true
//   }}, 'doIt')

//   experimentsFolder.add({restore() {
//     geometry.attributes.normal.copy(originalPositions)
//     geometry.attributes.normal.needsUpdate = true
//   }}, 'restore')
// }

// gui.add({experiments}, 'experiments')

let LinearAccelerationMixer = function(object, acceleration) {
  return {
    update (delta) {
      let speedDelta = acceleration.clone().multiplyScalar(delta)
      object.userData.speed.add(speedDelta)
    }
  }
}

let SpeedMixer = function(object, speed) {
  return {
    update (delta) {
      let positionDelta = speed.clone().multiplyScalar(delta)

      if (object.userData.rotation)
        positionDelta.applyAxisAngle({x:0, y:1, z:0}, object.userData.rotation)

      object.position.add(positionDelta)
    }
  }
}

function kinematics () {

  function generateCube(tracked) {
    let cube = cubeHelper({x:0, y:0, z:0})
    scene.add(cube)

    cube.userData.speed = new THREE.Vector3(
      random(-10, 10),
      random(0, 10),
      random(-10, 10)
    )

    cube.userData.acceleration = new THREE.Vector3(
      random(-100, 100),
      random(0, 100),
      random(-100, 100)
    )

    cube.userData.speedMixer = new SpeedMixer(cube, cube.userData.speed)
    cube.userData.accelerationMixer = new LinearAccelerationMixer(cube, cube.userData.acceleration)

    mixers.push(cube.userData.accelerationMixer)
    mixers.push(cube.userData.speedMixer)

    if (tracked) {
      let cubeFolder = cubesFolder.addFolder(`cube ${cube.id}`)

      let cubePositionFolder = cubeFolder.addFolder('position')
      cubePositionFolder.add(cube.position, 'x').listen()
      cubePositionFolder.add(cube.position, 'y').listen()
      cubePositionFolder.add(cube.position, 'z').listen()

      let cubeSpeedFolder = cubeFolder.addFolder('speed')
      cubeSpeedFolder.add(cube.userData.speed, 'x').listen()
      cubeSpeedFolder.add(cube.userData.speed, 'y').listen()
      cubeSpeedFolder.add(cube.userData.speed, 'z').listen()
      cubeSpeedFolder.add({reflect(){
        cube.userData.speed.reflect(cube.position.clone().normalize())
      }}, 'reflect')

      let cubeAccelerationFolder = cubeFolder.addFolder('acceleration')
      cubeAccelerationFolder.add(cube.userData.acceleration, 'x').listen()
      cubeAccelerationFolder.add(cube.userData.acceleration, 'y').listen()
      cubeAccelerationFolder.add(cube.userData.acceleration, 'z').listen()
      cubeAccelerationFolder.add({reflect(){
        cube.userData.acceleration.reflect(cube.position.clone().normalize())
      }}, 'reflect')

      cube.userData.guiFolder = cubeFolder
    }

    return cube
  }

  let cubes = new THREE.Group()
  scene.add(cubes)

  let kinematicsFolder = gui.addFolder('kinematics')

  let kinematicsSettings = {
    amount: 50,
    tracked: false,
    addCube(){
      cubes.add(generateCube(this.tracked))
    },
    addCubes() {
      times(this.amount, () => {
        cubes.add(generateCube(this.tracked))
      })
    },
    clearCubes() {
      cubes.children.forEach(cube => {
        if (cube.userData.guiFolder)
          cubesFolder.removeFolder(cube.userData.guiFolder)

        remove(mixers, cube.userData.speedMixer)
        remove(mixers, cube.userData.accelerationMixer)
      })
      clearChildren(cubes)
    }
  }
  kinematicsFolder.add(kinematicsSettings, 'addCube')
  kinematicsFolder.add(kinematicsSettings, 'amount', 5, 200, 5)
  kinematicsFolder.add(kinematicsSettings, 'addCubes')
  kinematicsFolder.add(kinematicsSettings, 'clearCubes')
  kinematicsFolder.add(kinematicsSettings, 'tracked')

  kinematicsFolder.add({reflect(){
    cubes.children.forEach(cube => {
      cube.userData.speed.reflect(cube.position.clone().normalize())
      cube.userData.acceleration.reflect(cube.position.clone().normalize())
    })
  }}, 'reflect')

  let cubesFolder = kinematicsFolder.addFolder('cubes')
}

gui.add({kinematics}, 'kinematics').onChange(function(){this.remove()})

function wasd () {
  let cube = cubeHelper({x: 0, y:0, z:0}, 50)

  cube.userData.speed = new THREE.Vector3(0, 0, 0)
  cube.userData.acceleration = new THREE.Vector3(0, 0, 0)

  cube.userData.speedMixer = new SpeedMixer(cube, cube.userData.speed)
  cube.userData.accelerationMixer = new LinearAccelerationMixer(cube, cube.userData.acceleration)

  mixers.push(cube.userData.accelerationMixer)
  mixers.push(cube.userData.speedMixer)

  scene.add(cube)
  let speed = 300
  let rotationDelta = 0.05
  let parameter = 'speed'

  const recognizedKeys = {
    w: {
      axis: 'x',
      direction: 1,
      opposite: 's',
      movement: true
    },
    s: {
      axis: 'x',
      direction: -1,
      opposite: 'w',
      movement: true
    },
    a: {
      axis: 'z',
      direction: -1,
      opposite: 'd',
      movement: true
    },
    d: {
      axis: 'z',
      direction: 1,
      opposite: 'a',
      movement: true
    },
    e: {
      axis: 'y',
      direction: -1,
      opposite: 'q',
      rotation: true
    },
    q: {
      axis: 'y',
      direction: 1,
      opposite: 'e',
      rotation: true
    }
  }

  let pressedKeys = {}

  function applyRotation (){
    Object.keys(pressedKeys).forEach(keyName => {
      let key = recognizedKeys[keyName]
      if (!key.rotation)
        return

      let twoInSameAxis = pressedKeys[keyName] && pressedKeys[key.opposite]
      let noneInAxis = !(pressedKeys[keyName] || pressedKeys[key.opposite])

      if (twoInSameAxis || noneInAxis) {
        return
      }

      if (pressedKeys[keyName]){
        cube.rotation[key.axis] += rotationDelta * key.direction
        cube.userData.rotation = cube.rotation[key.axis]
      }
    })
  }

  function applySpeeds (){
    let movingAxis = Object.keys(pressedKeys).filter(keyName => {
      return recognizedKeys[keyName].movement && pressedKeys[keyName] === true
    }).length

    Object.keys(pressedKeys).forEach(keyName => {
      let key = recognizedKeys[keyName]
      if (!key.movement)
        return

      let twoInSameAxis = pressedKeys[keyName] && pressedKeys[key.opposite]
      let noneInAxis = !(pressedKeys[keyName] || pressedKeys[key.opposite])

      if (twoInSameAxis || noneInAxis) {
        cube.userData[parameter][key.axis] = 0
        return
      }

      if (pressedKeys[keyName]){
        cube.userData[parameter][key.axis] = (speed/movingAxis) * key.direction
      }
    })
  }

  let floorTiles = {}
  const probes = new THREE.Group()
  scene.add(probes)
  const tiles = new THREE.Group()
  scene.add(tiles)

  let floorSettings = {
    drawProbes: true,
    tileSize: 500
  }

  gui.add(floorSettings, 'drawProbes').onChange(() => {clearChildren(probes)})
  gui.add(floorSettings, 'tileSize', 100, 2000, 10).onChange(() => {
    clearChildren(tiles)
    floorTiles = {}
  })

  function discretizePosition ({x, z}) {
    return {
      x: Math.floor(x / floorSettings.tileSize),
      z: Math.floor(z / floorSettings.tileSize),
      y: 0
    }
  }

  function tilePosition ({x, z}) {
    const offset = new THREE.Vector3(floorSettings.tileSize/2, 0, floorSettings.tileSize/2)

    return offset.add({
      x: x * floorSettings.tileSize,
      z: z * floorSettings.tileSize,
      y: -25
    })
  }

  function tileId (coords) {
    let {x, z} = discretizePosition(coords)

    return `${x}-${z}`
  }

  function generateTile (coords) {

    let textGrass = new THREE.TextureLoader().load( 'assets/img/grass.jpg' );
    textGrass.wrapS = THREE.RepeatWrapping;
    textGrass.wrapT = THREE.RepeatWrapping;
    textGrass.repeat.set( 3, 3 );
    let tileGeometry = new THREE.PlaneGeometry(floorSettings.tileSize, floorSettings.tileSize,8, 8)
    let tile = new THREE.Mesh(tileGeometry, new THREE.MeshStandardMaterial({ map:textGrass,
      side: THREE.DoubleSide
    }))

    tile.rotation.x = Math.PI/2

    for (var i = 0; i < tile.geometry.vertices.length; i++){ 

       tile.geometry.vertices[i].z += Math.random()* 25 - 25; 
    } 

    tile.position.copy(tilePosition(discretizePosition(coords)))

    return tile
  }

  function checkFloor (coords) {
    return floorTiles[tileId(coords)]
  }

  function addTile (coords) {
    let tile = generateTile(coords)

    floorTiles[tileId(coords)] = true
    tiles.add(tile)
  }

  function ensureFloorAhead (distance) {
    let aheadPosition = new THREE.Vector3(1, 0, 0).multiplyScalar(distance)

    let slices = 16
    times(slices, (i) => {
      let thisAngle = (Math.PI * 2) / slices * i

      let thisAngleAheadPosition = aheadPosition.clone()
      thisAngleAheadPosition.applyAxisAngle({x:0, y:1, z:0}, thisAngle)

      let probePosition = thisAngleAheadPosition.add(cube.position)

      if (!checkFloor(probePosition)){
        addTile(probePosition)
      }

      if (floorSettings.drawProbes) {
        let probe = cubeHelper(probePosition, 5)
        probes.add(probe)
      }
    })
  }

  let ensureFloorMixer = new CallbackMixer(throttle((ratio) => {
    if (floorSettings.drawProbes) {
      clearChildren(probes)
    }
    times(2, (i) => ensureFloorAhead(floorSettings.tileSize * (i + 2) * 0.6) )
  }, 200), 1, Infinity)
  mixers.push(ensureFloorMixer)

  function keydown(event){
    if (event.target.nodeName !== 'BODY')
      return

    let key = event.key.toLowerCase()
    if (recognizedKeys[key]) {
      pressedKeys[key] = true
      applySpeeds()
      applyRotation()
    }
  }

  function keyup(event){
    let key = event.key.toLowerCase()
    if (recognizedKeys[key]){
      pressedKeys[key] = false
      applySpeeds()
      applyRotation()
    }
  }

  document.addEventListener('keydown', keydown)
  document.addEventListener('keyup', keyup)
  document.body.focus()

  gui.add({wasd(){
    document.body.focus()
  }}, 'wasd').name('recover focus')

  let cameraSettings = {
    firstPerson: false,
    originalCameraPosition: {},
    originalCameraRotation: {}
  }

  gui.add(cameraSettings, 'firstPerson').onChange(active => {
    if (active) {

      cameraSettings.originalCameraPosition = camera.position.clone()
      cameraSettings.originalCameraRotation = camera.rotation.clone()
      controls.reset()
      controls.enabled = false

      cube.position.y += 100
      let geometry = new THREE.CylinderGeometry( 15, 15, 300, 32 );
      let material = new THREE.MeshPhongMaterial( {color: 0x797878} );
      let cylinder = new THREE.Mesh( geometry, material );
      cylinder.rotation.z = -90* Math.PI/180
      cylinder.position.y -= 30
      cylinder.position.z = 15
      cube.add(cylinder)
      cube.add(lighter)
      cube.add(camera)
      camera.position.set(0, 0, 0)
      camera.rotation.y = - Math.PI/2
    }
    else {
      cube.remove(camera)
      controls.enabled = true

      camera.position.copy(cameraSettings.originalCameraPosition)
      camera.rotation.copy(cameraSettings.originalCameraRotation)
    }
  })

}

gui.add({wasd}, 'wasd').onChange(function(){this.remove()})
setTimeout(wasd, 100)

function texts(){
  let textArea = document.createElement('textarea')
  textArea.autocomplete = 'off'
  document.body.appendChild(textArea)
  textArea.focus()

  let textSettings = {
    height: 100,
    line: 120,
    showBoxes: false,
    followCamera: true
  }

  let textFolder = gui.addFolder('text')
  textFolder.add(textSettings, 'height', 50, 200)
  textFolder.add(textSettings, 'line', 50, 200)
  textFolder.add(textSettings, 'showBoxes')
  textFolder.add(textSettings, 'followCamera')

  let texts = new THREE.Group()
  texts.name = 'texts'
  scene.add(texts)

  let fontLoader = new THREE.FontLoader()
  // fontLoader.load('./assets/fonts/Anonymous Pro_Regular.json', (font) => {
  fontLoader.load('./assets/fonts/Luis2_Medium.json', (font) => {

    let debouncedKeyDown = debounce(event => {

      texts.traverse(child => {
        if (child.isMesh)
          child.geometry.dispose()
      })
      texts.children.length = 0

      let rows = event.target.value.split(/\n/)

      rows.forEach((row, i) => {
        let textGeometry = new THREE.TextGeometry(row, {
          font,
          size: textSettings.height,
          height: 5,
          bevelEnabled: true,
          bevelThickness: 5,
          bevelSize: 3
        })
        textGeometry.center()

        let text = new THREE.Mesh(textGeometry, orangeMaterial)
        text.name = row

        if (textSettings.showBoxes) {
          let bb = new THREE.BoxHelper(text)
          text.add(bb)
        }

        text.position.set(0, -textSettings.line * i, 0)
        texts.add(text)

        texts.position.set(0, (rows.length - 1) * textSettings.line / 2, 0)
      })
    }, 500)

    textArea.addEventListener('input', debouncedKeyDown, false)
  })

  let textPositionMixer = {
    update(){
      if (textSettings.followCamera)
        texts.children.forEach(child => {
          child.lookAt(camera.position)
        })
    }
  }

  mixers.push(textPositionMixer)
}

gui.add({texts}, 'texts').onChange(function(){this.remove()})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

function render () {
  stats.begin()
  requestAnimationFrame(render)
  let delta = clock.getDelta()

  mixers.forEach(mixer => mixer.update(delta))

  // only needed for autoRotate or inertia
  // controls.update()

  renderer.render(scene, camera)

  // for "animated" material from render
  // renderer.render(scene, camera, wglrt)

  stats.end()
}

render()
