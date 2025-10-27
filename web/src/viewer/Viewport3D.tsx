
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three-stdlib';
import { calculateOptimalOrientation } from '@/lib/auto-orient';

interface Object3D {
    id: number;
    name: string;
    type: string;
    size: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    color: number;
    visible: boolean;
    modelData?: ArrayBuffer; // STL binary data
}

interface Viewport3DProps {
    mainTab: string;
    objects: Object3D[];
}

export function Viewport3D({ mainTab, objects }: Viewport3DProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const [showControls, setShowControls] = useState(false);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
    const selectedObjectIdRef = useRef<number | null>(null); // Ref for closures
    const objectMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
    const boundingBoxRef = useRef<THREE.BoxHelper | null>(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const isDraggingObjectRef = useRef(false);
    const dragOffsetRef = useRef(new THREE.Vector3());
    const controlsRef = useRef({ 
        isRotating: false,
        isPanning: false,
        previousMousePosition: { x: 0, y: 0 },
        target: new THREE.Vector3(0, 0, 0)
    });
    
    // Sync state with ref
    useEffect(() => {
        selectedObjectIdRef.current = selectedObjectId;
    }, [selectedObjectId]);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(mainTab === 'preview' ? 0x1a1a1a : 0x3a3a3a);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            45,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            5000
        );
        // Position camera to view 250mm build plate nicely
        camera.position.set(300, 300, 300);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Build plate dimensions (in millimeters)
        const buildPlateSize = 250; // 250x250mm build plate
        const gridDivisions = 25; // 10mm grid spacing (250/25 = 10mm per division)

        // Grid
        if (mainTab === 'prepare') {
            const gridHelper = new THREE.GridHelper(buildPlateSize, gridDivisions, 0x555555, 0x333333);
            scene.add(gridHelper);

            // Axes (larger to match scale)
            const axesHelper = new THREE.AxesHelper(50);
            scene.add(axesHelper);
        }

        // Build plate
        const plateGeometry = new THREE.BoxGeometry(buildPlateSize, 0.5, buildPlateSize);
        const plateMaterial = new THREE.MeshStandardMaterial({ 
            color: mainTab === 'preview' ? 0x2a2a2a : 0x404040,
            roughness: 0.7
        });
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        plate.position.y = -0.25; // Center plate so top surface is exactly at Y=0
        scene.add(plate);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
        directionalLight.position.set(10, 15, 10);
        scene.add(directionalLight);
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        directionalLight2.position.set(-10, 10, -10);
        scene.add(directionalLight2);

        // Sample objects
        objects.forEach(obj => {
            if (!obj.visible) return;
            
            let geometry;
            
            // If object has STL data, parse it
            if (obj.modelData) {
                try {
                    const loader = new STLLoader();
                    geometry = loader.parse(obj.modelData);
                    
                    // STEP 1: Auto-orient for optimal printing (largest face down)
                    console.log(`=== AUTO-ORIENTATION ===`);
                    const optimalRotation = calculateOptimalOrientation(geometry);
                    
                    // Apply rotation to geometry
                    const rotationMatrix = new THREE.Matrix4();
                    rotationMatrix.makeRotationFromEuler(
                        new THREE.Euler(optimalRotation.rotationX, optimalRotation.rotationY, optimalRotation.rotationZ, 'XYZ')
                    );
                    geometry.applyMatrix4(rotationMatrix);
                    console.log(`Applied optimal orientation`);
                    
                    // STEP 2: Compute bounding box AFTER rotation
                    geometry.computeBoundingBox();
                    if (geometry.boundingBox) {
                        const bbox = geometry.boundingBox;
                        
                        // Log dimensions
                        const size = new THREE.Vector3();
                        bbox.getSize(size);
                        console.log(`=== POSITIONING ===`);
                        console.log(`Size: ${size.x.toFixed(1)}mm × ${size.y.toFixed(1)}mm × ${size.z.toFixed(1)}mm`);
                        console.log(`Bounds after rotation:`);
                        console.log(`  X: [${bbox.min.x.toFixed(1)}, ${bbox.max.x.toFixed(1)}]`);
                        console.log(`  Y: [${bbox.min.y.toFixed(1)}, ${bbox.max.y.toFixed(1)}]`);
                        console.log(`  Z: [${bbox.min.z.toFixed(1)}, ${bbox.max.z.toFixed(1)}]`);
                        
                        // In THREE.js Y is UP, so we need to ensure minimum Y is at 0 (build plate level)
                        const centerX = (bbox.min.x + bbox.max.x) / 2;
                        const centerZ = (bbox.min.z + bbox.max.z) / 2;
                        const minY = bbox.min.y; // Bottom of model
                        
                        // Single translation: center X/Z on build plate, place bottom at Y=0
                        geometry.translate(-centerX, -minY, -centerZ);
                        
                        console.log(`Auto-centered on build plate:`);
                        console.log(`  X: ${centerX.toFixed(1)}mm → 0.0mm (centered)`);
                        console.log(`  Y: ${minY.toFixed(1)}mm → 0.0mm (on plate)`);
                        console.log(`  Z: ${centerZ.toFixed(1)}mm → 0.0mm (centered)`);
                        console.log(`✓ Model ready: centered and sitting on build plate`);
                        console.log(`===========================`);
                    }
                    
                    // Compute normals for proper lighting
                    geometry.computeVertexNormals();
                } catch (error) {
                    console.error('Failed to parse STL:', error);
                    // Fallback to cube
                    geometry = new THREE.BoxGeometry(10, 10, 10);
                }
            } else {
                // Use primitive geometries for non-STL objects
                switch(obj.type) {
                    case 'cube':
                        geometry = new THREE.BoxGeometry(obj.size, obj.size, obj.size);
                        break;
                    case 'cylinder':
                        geometry = new THREE.CylinderGeometry(obj.size / 2, obj.size / 2, obj.size, 32);
                        break;
                    case 'sphere':
                        geometry = new THREE.SphereGeometry(obj.size / 2, 32, 32);
                        break;
                    default:
                        geometry = new THREE.BoxGeometry(1, 1, 1);
                }
            }
            
            const material = new THREE.MeshStandardMaterial({ 
                color: mainTab === 'preview' ? 0x4a9eff : obj.color,
                roughness: 0.6,
                metalness: 0.2
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position mesh - geometry is already correctly positioned with bottom at Z=0
            // Just use the object's position directly (which should be 0,0,0 for imported models)
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
            mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
            mesh.userData.objectId = obj.id; // Store object ID for raycasting
            scene.add(mesh);
            
            // Store mesh reference for selection/manipulation
            objectMeshesRef.current.set(obj.id, mesh);

            // Add edge lines in preview mode
            if (mainTab === 'preview') {
                const edges = new THREE.EdgesGeometry(geometry);
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0x88ccff });
                const wireframe = new THREE.LineSegments(edges, lineMaterial);
                wireframe.position.copy(mesh.position);
                wireframe.rotation.copy(mesh.rotation);
                scene.add(wireframe);
            }
        });
        
        // Update bounding box if object is selected
        if (selectedObjectId !== null && boundingBoxRef.current) {
            const selectedMesh = objectMeshesRef.current.get(selectedObjectId);
            if (selectedMesh) {
                boundingBoxRef.current.setFromObject(selectedMesh);
            }
        }

        // Mouse controls - OrcaSlicer style with object selection
        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            
            if (!cameraRef.current || !sceneRef.current) return;
            
            // Calculate mouse position in normalized device coordinates
            const rect = renderer.domElement.getBoundingClientRect();
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Raycast to check for object clicks
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const objectMeshes = Array.from(objectMeshesRef.current.values());
            const intersects = raycasterRef.current.intersectObjects(objectMeshes, false);
            
            if (intersects.length > 0 && e.button === 0 && !e.shiftKey && !e.ctrlKey) {
                // Clicked on an object - select it and prepare for dragging
                const clickedMesh = intersects[0].object as THREE.Mesh;
                const objectId = clickedMesh.userData.objectId;
                
                setSelectedObjectId(objectId);
                isDraggingObjectRef.current = true;
                
                // Calculate drag offset
                const intersectPoint = intersects[0].point;
                dragOffsetRef.current.copy(clickedMesh.position).sub(intersectPoint);
                
                // Create/update bounding box
                if (boundingBoxRef.current) {
                    sceneRef.current.remove(boundingBoxRef.current);
                }
                boundingBoxRef.current = new THREE.BoxHelper(clickedMesh, 0x00ff00);
                sceneRef.current.add(boundingBoxRef.current);
                
                renderer.domElement.style.cursor = 'grab';
                console.log(`Selected object ${objectId}`);
                return;
            }
            
            // Clicked on empty space - deselect
            if (e.button === 0 && !e.shiftKey && !e.ctrlKey && intersects.length === 0) {
                if (selectedObjectId !== null) {
                    setSelectedObjectId(null);
                    isDraggingObjectRef.current = false;
                    if (boundingBoxRef.current && sceneRef.current) {
                        sceneRef.current.remove(boundingBoxRef.current);
                        boundingBoxRef.current = null;
                    }
                    console.log('Deselected object');
                    return;
                }
                
                // Start panning
                controlsRef.current.isPanning = true;
                controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
                renderer.domElement.style.cursor = 'move';

            }
            // Right mouse button for rotation
            else if (e.button === 2) {
                controlsRef.current.isRotating = true;
                controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
                renderer.domElement.style.cursor = 'grabbing';
            }
            // Middle mouse button also for rotation (alternative)
            else if (e.button === 1) {
                controlsRef.current.isRotating = true;
                controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
                renderer.domElement.style.cursor = 'grabbing';
            }
            // Shift+Left for rotation (another alternative)
            else if (e.button === 0 && e.shiftKey) {
                controlsRef.current.isRotating = true;
                controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
                renderer.domElement.style.cursor = 'grabbing';
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            
            if (!cameraRef.current || !sceneRef.current) return;
            
            // Handle object dragging
            if (isDraggingObjectRef.current && selectedObjectIdRef.current !== null) {
                const rect = renderer.domElement.getBoundingClientRect();
                mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
                
                // Intersect with horizontal drag plane (XZ plane at Y=0)
                const intersectPoint = new THREE.Vector3();
                if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, intersectPoint)) {
                    const selectedMesh = objectMeshesRef.current.get(selectedObjectIdRef.current);
                    if (selectedMesh) {
                        // Apply drag offset
                        const newPos = intersectPoint.add(dragOffsetRef.current);
                        
                        // Constrain to build plate boundaries (250x250mm, centered at origin)
                        // Get object bounding box to prevent going off plate
                        const bbox = new THREE.Box3().setFromObject(selectedMesh);
                        const size = bbox.getSize(new THREE.Vector3());
                        const halfSizeX = size.x / 2;
                        const halfSizeZ = size.z / 2;
                        
                        // Clamp position to keep object on plate
                        newPos.x = Math.max(-125 + halfSizeX, Math.min(125 - halfSizeX, newPos.x));
                        newPos.z = Math.max(-125 + halfSizeZ, Math.min(125 - halfSizeZ, newPos.z));
                        newPos.y = selectedMesh.position.y; // Keep Y position unchanged
                        
                        selectedMesh.position.copy(newPos);
                        
                        // Update bounding box
                        if (boundingBoxRef.current) {
                            boundingBoxRef.current.setFromObject(selectedMesh);
                        }
                        
                        renderer.domElement.style.cursor = 'grabbing';
                    }
                }
                return;
            }

            const deltaX = e.clientX - controlsRef.current.previousMousePosition.x;
            const deltaY = e.clientY - controlsRef.current.previousMousePosition.y;
            
            if (controlsRef.current.isRotating) {
                // Rotate camera around target point
                const rotationSpeed = 0.008; // Increased for better RD responsiveness
                
                const offset = new THREE.Vector3().subVectors(
                    cameraRef.current.position,
                    controlsRef.current.target
                );
                
                // Spherical coordinates
                const spherical = new THREE.Spherical().setFromVector3(offset);
                
                spherical.theta -= deltaX * rotationSpeed;
                spherical.phi -= deltaY * rotationSpeed;
                
                // Clamp phi to prevent flipping
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                offset.setFromSpherical(spherical);
                cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                cameraRef.current.lookAt(controlsRef.current.target);
            }
            else if (controlsRef.current.isPanning) {
                // Pan camera and target together
                const panSpeed = 0.5; // Increased from 0.01 for better RD responsiveness
                
                const right = new THREE.Vector3();
                cameraRef.current.getWorldDirection(right);
                right.cross(cameraRef.current.up).normalize();
                
                const up = new THREE.Vector3();
                up.copy(cameraRef.current.up).normalize();
                
                const panOffset = new THREE.Vector3();
                right.multiplyScalar(-deltaX * panSpeed);
                up.multiplyScalar(deltaY * panSpeed);
                panOffset.add(right).add(up);
                
                cameraRef.current.position.add(panOffset);
                controlsRef.current.target.add(panOffset);
            }
            
            controlsRef.current.previousMousePosition = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            
            // End object dragging
            if (isDraggingObjectRef.current && selectedObjectIdRef.current !== null) {
                isDraggingObjectRef.current = false;
                renderer.domElement.style.cursor = 'grab';
                const mesh = objectMeshesRef.current.get(selectedObjectIdRef.current);
                if (mesh) {
                    console.log(`Object ${selectedObjectIdRef.current} moved to position:`, mesh.position);
                }
            }
            
            controlsRef.current.isRotating = false;
            controlsRef.current.isPanning = false;
            renderer.domElement.style.cursor = 'grab';
        };

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            
            if (!cameraRef.current) return;

            // Zoom towards/away from target
            const zoomSpeed = 0.1;
            const direction = e.deltaY > 0 ? 1 : -1;
            
            const offset = new THREE.Vector3().subVectors(
                cameraRef.current.position,
                controlsRef.current.target
            );
            
            const distance = offset.length();
            const newDistance = distance * (1 + direction * zoomSpeed);
            
            // Clamp zoom distance (adjusted for 250mm scale)
            if (newDistance > 50 && newDistance < 2000) {
                offset.normalize().multiplyScalar(newDistance);
                cameraRef.current.position.copy(controlsRef.current.target).add(offset);
            }
        };

        // Keyboard navigation (for remote desktop backup)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!cameraRef.current) return;
            
            const panSpeed = 10; // Units per key press
            const rotateSpeed = 0.1; // Radians per key press
            
            const panOffset = new THREE.Vector3();
            const right = new THREE.Vector3();
            cameraRef.current.getWorldDirection(right);
            right.cross(cameraRef.current.up).normalize();
            
            const up = new THREE.Vector3();
            up.copy(cameraRef.current.up).normalize();
            
            switch(e.key) {
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    // Pan left
                    panOffset.add(right.clone().multiplyScalar(-panSpeed));
                    cameraRef.current.position.add(panOffset);
                    controlsRef.current.target.add(panOffset);
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    // Pan right
                    panOffset.add(right.clone().multiplyScalar(panSpeed));
                    cameraRef.current.position.add(panOffset);
                    controlsRef.current.target.add(panOffset);
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                case 'w':
                case 'W':
                    // Pan up
                    panOffset.add(up.clone().multiplyScalar(panSpeed));
                    cameraRef.current.position.add(panOffset);
                    controlsRef.current.target.add(panOffset);
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    // Pan down
                    panOffset.add(up.clone().multiplyScalar(-panSpeed));
                    cameraRef.current.position.add(panOffset);
                    controlsRef.current.target.add(panOffset);
                    e.preventDefault();
                    break;
                case 'q':
                case 'Q':
                    // Rotate left
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const spherical = new THREE.Spherical().setFromVector3(offset);
                        spherical.theta += rotateSpeed;
                        offset.setFromSpherical(spherical);
                        cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        cameraRef.current.lookAt(controlsRef.current.target);
                    }
                    e.preventDefault();
                    break;
                case 'e':
                case 'E':
                    // Rotate right
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const spherical = new THREE.Spherical().setFromVector3(offset);
                        spherical.theta -= rotateSpeed;
                        offset.setFromSpherical(spherical);
                        cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        cameraRef.current.lookAt(controlsRef.current.target);
                    }
                    e.preventDefault();
                    break;
                case 'r':
                case 'R':
                    // Rotate up
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const spherical = new THREE.Spherical().setFromVector3(offset);
                        spherical.phi = Math.max(0.1, spherical.phi - rotateSpeed);
                        offset.setFromSpherical(spherical);
                        cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        cameraRef.current.lookAt(controlsRef.current.target);
                    }
                    e.preventDefault();
                    break;
                case 'f':
                case 'F':
                    // Rotate down
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const spherical = new THREE.Spherical().setFromVector3(offset);
                        spherical.phi = Math.min(Math.PI - 0.1, spherical.phi + rotateSpeed);
                        offset.setFromSpherical(spherical);
                        cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        cameraRef.current.lookAt(controlsRef.current.target);
                    }
                    e.preventDefault();
                    break;
                case '+':
                case '=':
                    // Zoom in
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const distance = offset.length();
                        const newDistance = distance * 0.9;
                        if (newDistance > 50) {
                            offset.normalize().multiplyScalar(newDistance);
                            cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        }
                    }
                    e.preventDefault();
                    break;
                case '-':
                case '_':
                    // Zoom out
                    {
                        const offset = new THREE.Vector3().subVectors(
                            cameraRef.current.position,
                            controlsRef.current.target
                        );
                        const distance = offset.length();
                        const newDistance = distance * 1.1;
                        if (newDistance < 2000) {
                            offset.normalize().multiplyScalar(newDistance);
                            cameraRef.current.position.copy(controlsRef.current.target).add(offset);
                        }
                    }
                    e.preventDefault();
                    break;
                case 'Home':
                case 'h':
                case 'H':
                    // Reset view
                    cameraRef.current.position.set(300, 300, 300);
                    controlsRef.current.target.set(0, 0, 0);
                    cameraRef.current.lookAt(0, 0, 0);
                    e.preventDefault();
                    break;
            }
        };

        // Double-click to reset view
        const handleDoubleClick = (e: MouseEvent) => {
            e.preventDefault();
            
            if (!cameraRef.current) return;

            // Smooth transition to home view (adjusted for 250mm scale)
            const startPos = cameraRef.current.position.clone();
            const endPos = new THREE.Vector3(300, 300, 300);
            const startTime = Date.now();
            const duration = 300;
            
            const animateTransition = () => {
                if (!cameraRef.current) return;
                const now = Date.now();
                const t = Math.min(1, (now - startTime) / duration);
                cameraRef.current.position.lerpVectors(startPos, endPos, t);
                cameraRef.current.lookAt(controlsRef.current.target);
                if (t < 1) {
                    requestAnimationFrame(animateTransition);
                }
            };
            
            animateTransition();
        };

        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('mouseup', handleMouseUp);
        renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
        renderer.domElement.addEventListener('contextmenu', handleContextMenu);
        renderer.domElement.addEventListener('dblclick', handleDoubleClick);
        window.addEventListener('keydown', handleKeyDown);

        // Animation loop
        const animate = () => {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
            requestAnimationFrame(animate);
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
            cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        const currentMount = mountRef.current;

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            currentMount?.removeEventListener('mousedown', handleMouseDown);
            currentMount?.removeEventListener('mousemove', handleMouseMove);
            currentMount?.removeEventListener('mouseup', handleMouseUp);
            currentMount?.removeEventListener('wheel', handleWheel);
            currentMount?.removeEventListener('contextmenu', handleContextMenu);
            currentMount?.removeEventListener('dblclick', handleDoubleClick);
            if (currentMount && rendererRef.current) {
                currentMount.removeChild(rendererRef.current.domElement);
            }
        };
    }, [mainTab, objects]);

    return (
        <div ref={mountRef} className="canvas-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Build plate size indicator */}
            {mainTab === 'prepare' && (
                <>
                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '16px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Build Plate</div>
                        <div>250 × 250 mm</div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>
                            Grid: 10mm spacing
                        </div>
                    </div>
                    
                    {/* Keyboard controls help - collapsible */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                    }}>
                        {/* Toggle button */}
                        <button
                            onClick={() => setShowControls(!showControls)}
                            style={{
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                border: '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.85)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                        >
                            <span style={{ fontSize: '14px' }}>{showControls ? '▼' : '▶'}</span>
                            <span>⌨️ Controls</span>
                        </button>
                        
                        {/* Dropdown content */}
                        {showControls && (
                            <div style={{
                                marginTop: '8px',
                                background: 'rgba(0,0,0,0.85)',
                                color: 'white',
                                padding: '10px 12px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                border: '1px solid rgba(255,255,255,0.2)',
                                maxWidth: '220px',
                                animation: 'fadeIn 0.2s ease-in'
                            }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4fc3f7' }}>Keyboard Shortcuts</div>
                                <div style={{ marginBottom: '4px' }}><strong>WASD / Arrows:</strong> Pan</div>
                                <div style={{ marginBottom: '4px' }}><strong>Q/E:</strong> Rotate left/right</div>
                                <div style={{ marginBottom: '4px' }}><strong>R/F:</strong> Rotate up/down</div>
                                <div style={{ marginBottom: '4px' }}><strong>+/-:</strong> Zoom in/out</div>
                                <div style={{ marginBottom: '4px' }}><strong>H / Home:</strong> Reset view</div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                                    <strong>Mouse:</strong> Left-drag=pan, Right-drag=rotate, Scroll=zoom
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
            
            {/* View orientation cube - top right */}
            <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '80px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                {/* This would be a more complex component */}
            </div>
        </div>
    );
}
