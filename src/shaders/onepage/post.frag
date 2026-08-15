uniform sampler2D tDiffuse;
uniform float uVelocity;
uniform float uTime;

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

    // RGB shift, scaled with the scroll velocity.
    float shift = uVelocity * 0.00016;

    float r = texture2D(tDiffuse, vec2(waveUv.x + shift, waveUv.y + shift)).r;
    vec2 gb = texture2D(tDiffuse, waveUv).gb;
    float b = texture2D(tDiffuse, vec2(waveUv.x - shift, waveUv.y)).b;

    vec3 color = vec3(r, gb.x, mix(gb.y, b, 0.5));

    // Vignette + a little grain to bind everything together.
    float vignette = 1.0 - smoothstep(0.55, 1.25, length(uv - 0.5) * 1.6);
    color *= mix(0.72, 1.0, vignette);
    color += (random(uv + fract(uTime)) - 0.5) * 0.035;

    gl_FragColor = vec4(color, 1.0);
}
