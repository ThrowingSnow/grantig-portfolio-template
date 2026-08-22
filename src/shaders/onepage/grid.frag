uniform vec3 uColor;
uniform vec3 uHot;
uniform float uReveal;

varying float vDent;

void main() {
    vec3 color = mix(uColor, uHot, pow(vDent, 2.2));
    float alpha = uReveal * (0.18 + vDent * 0.45);

    gl_FragColor = vec4(color, alpha);
}
