varying vec3 vNormal;
varying vec3 vView;

void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);

    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);

    gl_Position = projectionMatrix * viewMatrix * world;
}
