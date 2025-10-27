import * as THREE from 'three';

/**
 * Analyzes an STL geometry and determines the optimal print orientation
 * by finding the largest flat face and orienting it to face down (build plate)
 */
export function calculateOptimalOrientation(geometry: THREE.BufferGeometry): {
    rotationX: number;
    rotationY: number;
    rotationZ: number;
} {
    // Compute face normals if not already computed
    if (!geometry.attributes.normal) {
        geometry.computeVertexNormals();
    }

    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    
    if (!positions || !normals) {
        return { rotationX: 0, rotationY: 0, rotationZ: 0 };
    }

    // Analyze all triangles and group by normal direction
    interface FaceGroup {
        normal: THREE.Vector3;
        area: number;
        count: number;
    }

    const faceGroups: FaceGroup[] = [];
    const normalThreshold = 0.95; // Cosine of ~18 degrees - faces within this are considered parallel

    for (let i = 0; i < positions.count; i += 3) {
        // Get triangle vertices
        const v0 = new THREE.Vector3().fromBufferAttribute(positions, i);
        const v1 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

        // Calculate triangle area
        const edge1 = new THREE.Vector3().subVectors(v1, v0);
        const edge2 = new THREE.Vector3().subVectors(v2, v0);
        const cross = new THREE.Vector3().crossVectors(edge1, edge2);
        const area = cross.length() / 2;

        // Get average normal for this triangle
        const n0 = new THREE.Vector3().fromBufferAttribute(normals, i);
        const n1 = new THREE.Vector3().fromBufferAttribute(normals, i + 1);
        const n2 = new THREE.Vector3().fromBufferAttribute(normals, i + 2);
        const avgNormal = new THREE.Vector3()
            .addVectors(n0, n1)
            .add(n2)
            .divideScalar(3)
            .normalize();

        // Find or create face group
        let foundGroup = false;
        for (const group of faceGroups) {
            if (group.normal.dot(avgNormal) > normalThreshold) {
                group.area += area;
                group.count++;
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            faceGroups.push({
                normal: avgNormal.clone(),
                area: area,
                count: 1
            });
        }
    }

    // Find the largest flat face
    faceGroups.sort((a, b) => b.area - a.area);
    
    if (faceGroups.length === 0) {
        return { rotationX: 0, rotationY: 0, rotationZ: 0 };
    }

    const largestFace = faceGroups[0];
    console.log(`Auto-orient: Largest face has area ${largestFace.area.toFixed(1)}mm², normal: (${largestFace.normal.x.toFixed(2)}, ${largestFace.normal.y.toFixed(2)}, ${largestFace.normal.z.toFixed(2)})`);

    // Calculate rotation to orient this face downward (toward -Y in THREE.js)
    const targetNormal = new THREE.Vector3(0, -1, 0); // Down in THREE.js Y-up
    const currentNormal = largestFace.normal;

    // Calculate rotation axis and angle
    const rotationAxis = new THREE.Vector3().crossVectors(currentNormal, targetNormal).normalize();
    const rotationAngle = Math.acos(currentNormal.dot(targetNormal));

    // Convert to Euler angles
    // Create a quaternion from axis-angle
    const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');

    console.log(`Auto-orient: Rotating by X=${THREE.MathUtils.radToDeg(euler.x).toFixed(1)}°, Y=${THREE.MathUtils.radToDeg(euler.y).toFixed(1)}°, Z=${THREE.MathUtils.radToDeg(euler.z).toFixed(1)}°`);

    return {
        rotationX: euler.x,
        rotationY: euler.y,
        rotationZ: euler.z
    };
}
