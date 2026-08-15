uniform float uTime;
uniform float uVelocity;
uniform float uCharge;
uniform float uAmplitude;
uniform float uOffset;

varying vec2 vUv;
varying float vDeform;

void main() {
    vUv = uv;

    vec3 transformed = position;

    // Same wave language as the codrops post-processing pass, but applied to
    // the geometry itself: frequency and amplitude both ride on scroll velocity.
    float amplitude = uAmplitude * (1.0 + abs(uVelocity) * 0.035 + uCharge * 3.5);
    float frequency = 0.014 + uCharge * 0.01;

    float wave = sin(transformed.y * frequency + uTime * 2.2);
    float ripple = sin(transformed.x * 0.05 + uTime * 1.4);

    transformed.x += wave * amplitude + uOffset;
    transformed.y += ripple * amplitude * 0.55;

    // Vertical smear: the faster the page moves, the more the arrow stretches.
    transformed.y -= uVelocity * 0.9 * (0.35 + vUv.y * 0.65);
    transformed.z += wave * amplitude * 0.8;

    vDeform = abs(wave) * (0.35 + uCharge);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
