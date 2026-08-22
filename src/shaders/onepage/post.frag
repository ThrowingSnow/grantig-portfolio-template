uniform sampler2D tDiffuse;
uniform float uVelocity;
uniform float uTime;
uniform float uAspect;
/** Strength of the gravitational lens, 0 while there is no sphere on screen. */
uniform float uLens;
/** Radius of the sphere, in units of the viewport height (uv space). */
uniform float uLensRadius;
uniform vec3 uRing;
/** How hard the image is pushed away from the mass. */
uniform float uDeflect;
/** Brightness of the ring at the horizon. */
uniform float uRingAmount;
/** 1 right after the click, decaying to 0 — the tear through the frame. */
uniform float uGlitch;
/** How far the torn bands are displaced, in uv. */
uniform float uGlitchAmount;

varying vec2 vUv;

float random(vec2 seed) {
    return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vUv;

    // Velocity driven wave, same idea as the original demo's pass.
    float waveAmplitude = uVelocity * 0.00045;
    float waveFrequency = 4.0 + uVelocity * 0.01;

    vec2 waveUv = uv;
    waveUv.x += sin(uv.y * waveFrequency + uTime) * waveAmplitude;
    waveUv.y += sin(uv.x * waveFrequency * 5.0 + uTime * 0.8) * waveAmplitude;

    // The tear: the frame is cut into horizontal bands and a few of them are
    // thrown sideways, re-diced several times a second. Multiplied by uGlitch,
    // so it costs a multiply and nothing else while there is no burst running.
    float band = floor(uv.y * 24.0);
    float dice = random(vec2(band, floor(uTime * 30.0)));
    float torn = step(0.66, dice) * (dice * 2.0 - 1.0);
    waveUv.x += torn * uGlitchAmount * uGlitch;

    // Gravitational lens around the sphere in the middle of the screen. Sampling
    // inwards is what pushes the image away from the mass — and grows the black
    // shadow a little past the sphere itself, which is exactly what it should do.
    vec2 p = (waveUv - 0.5) * vec2(uAspect, 1.0);
    float d = length(p);
    float radius = max(1e-4, uLensRadius);

    float deflection = uLens * radius * uDeflect * exp(-d / (radius * 2.2));
    vec2 direction = d > 1e-4 ? p / d : vec2(0.0);

    vec2 lensedP = p - direction * deflection;
    waveUv = 0.5 + lensedP / vec2(uAspect, 1.0);

    // RGB shift, scaled with the scroll velocity.
    float shift = uVelocity * 0.00016 + uGlitch * uGlitchAmount * 0.5;

    float r = texture2D(tDiffuse, vec2(waveUv.x + shift, waveUv.y + shift)).r;
    vec2 gb = texture2D(tDiffuse, waveUv).gb;
    float b = texture2D(tDiffuse, vec2(waveUv.x - shift, waveUv.y)).b;

    vec3 color = vec3(r, gb.x, mix(gb.y, b, 0.5));

    // Cleaning up after the distortion: the horizon stays perfectly black and
    // gets a thin ring, so the smear reads as a lens instead of a glitch.
    float core = smoothstep(radius * 0.97, radius, d);
    color *= mix(1.0, core, uLens);

    float ring = exp(-pow((d - radius) / (radius * 0.014), 2.0));
    color += uRing * ring * uLens * uRingAmount;

    // Vignette + a little grain to bind everything together.
    float vignette = 1.0 - smoothstep(0.55, 1.25, length(uv - 0.5) * 1.6);
    color *= mix(0.72, 1.0, vignette);
    color += (random(uv + fract(uTime)) - 0.5) * 0.035;

    gl_FragColor = vec4(color, 1.0);
}
