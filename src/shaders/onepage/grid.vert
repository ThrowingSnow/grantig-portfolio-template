/** Size of the grid in pixels — the geometry itself spans -0.5 … 0.5. */
uniform vec2 uSize;
uniform float uRadius;
uniform float uDepth;
uniform float uReveal;
uniform float uTime;

varying float vDent;

/**
 * The spacetime dent: every vertex is pulled towards the mass and away from the
 * camera, with a 1/(1 + r²) profile. The grid is what makes the well visible.
 */
void main() {
    vec3 p = vec3(position.xy * uSize, 0.0);

    float d = length(p.xy);
    float profile = 1.0 / (1.0 + pow(d / uRadius, 2.0));

    // A slow pulse so the well never looks like a static texture.
    float dent = uDepth * profile * uReveal * (0.94 + sin(uTime * 0.6) * 0.06);

    p.z -= dent;
    p.xy -= normalize(p.xy + vec2(1e-4)) * dent * 0.24;

    vDent = profile;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
