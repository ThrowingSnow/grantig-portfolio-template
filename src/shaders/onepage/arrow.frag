uniform vec3 uColor;
uniform float uOpacity;
uniform float uCharge;

varying vec2 vUv;
varying float vDeform;

void main() {
    // Soft vertical gradient so the arrow reads as a light beam pointing down.
    float gradient = mix(0.35, 1.0, 1.0 - vUv.y);

    vec3 color = uColor * (gradient + vDeform * 0.85 + uCharge * 0.3);

    gl_FragColor = vec4(color, uOpacity);
}
