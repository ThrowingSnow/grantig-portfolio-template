uniform float uTime;
uniform float uHover;
uniform vec3 uRim;
uniform vec3 uCold;

varying vec3 vNormal;
varying vec3 vView;

/**
 * A black sphere on a near-black page is a hole you cannot see. Everything here
 * happens at the horizon: the body stays pure black, only the rim carries light.
 */
void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));

    float rim = pow(1.0 - facing, 11.0);
    float horizon = pow(1.0 - facing, 22.0);

    float breathe = 0.82 + sin(uTime * 1.5) * 0.18;

    vec3 color = mix(uCold, uRim, 0.3 + uHover * 0.7) * rim * breathe;
    color *= 0.7 + uHover * 0.5;

    // Shimmer crawling along the horizon, picking up when the sphere is hovered.
    color += uRim * horizon * (0.3 + 0.4 * sin(uTime * 2.1 + vNormal.y * 5.0)) *
        (0.35 + uHover * 0.9);

    gl_FragColor = vec4(color, 1.0);
}
