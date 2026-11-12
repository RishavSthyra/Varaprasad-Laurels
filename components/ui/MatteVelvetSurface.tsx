"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type MatteVelvetSurfaceProps = {
  className?: string;
  tone?: "midnight" | "champagne";
};

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 vUv;
  uniform sampler2D uNormalMap;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec3 uBaseColor;
  uniform vec3 uSheenColor;

  float grain(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 surface = (vUv - 0.5) * vec2(aspect, 1.0);
    vec2 lightPoint = (uPointer - 0.5) * vec2(aspect, 1.0);
    vec2 fabricUv = vUv * vec2(max(aspect, 1.0) * 10.0, 10.0);

    vec3 sampledNormal = texture2D(uNormalMap, fabricUv).xyz * 2.0 - 1.0;
    sampledNormal.xy *= 0.52;
    vec3 normal = normalize(sampledNormal);
    vec3 lightDirection = normalize(vec3(lightPoint - surface, 0.72));

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float velvetRim = pow(1.0 - max(normal.z, 0.0), 0.62);
    float pool = 1.0 - smoothstep(0.0, 1.18, length(surface - lightPoint));
    float weave = sin(fabricUv.x * 6.28318) * sin(fabricUv.y * 6.28318);
    float fibre = grain(gl_FragCoord.xy) - 0.5;

    vec3 color = uBaseColor * (0.68 + diffuse * 0.22);
    color += uSheenColor * (pool * 0.105 + velvetRim * 0.055);
    color += uSheenColor * weave * 0.008;
    color += fibre * 0.012;

    float vignette = smoothstep(1.08, 0.18, length(surface * vec2(0.8, 1.0)));
    color *= 0.90 + vignette * 0.10;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const TONES = {
  midnight: {
    base: [0.003, 0.047, 0.105] as const,
    sheen: [0.56, 0.51, 0.36] as const,
  },
  champagne: {
    base: [0.53, 0.48, 0.34] as const,
    sheen: [0.98, 0.94, 0.8] as const,
  },
};

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export default function MatteVelvetSurface({
  className,
  tone = "midnight",
}: MatteVelvetSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 255, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const baseLocation = gl.getUniformLocation(program, "uBaseColor");
    const sheenLocation = gl.getUniformLocation(program, "uSheenColor");
    const textureLocation = gl.getUniformLocation(program, "uNormalMap");
    const palette = TONES[tone];
    const currentPointer = { x: 0.34, y: 0.76 };
    const targetPointer = { ...currentPointer };
    let animationFrame = 0;

    gl.uniform1i(textureLocation, 0);
    gl.uniform3fv(baseLocation, palette.base);
    gl.uniform3fv(sheenLocation, palette.sheen);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.uniform2f(resolutionLocation, width, height);
    };

    const draw = () => {
      resize();
      gl.uniform2f(pointerLocation, currentPointer.x, currentPointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const settlePointer = () => {
      currentPointer.x += (targetPointer.x - currentPointer.x) * 0.12;
      currentPointer.y += (targetPointer.y - currentPointer.y) * 0.12;
      draw();

      if (
        Math.abs(targetPointer.x - currentPointer.x) > 0.002 ||
        Math.abs(targetPointer.y - currentPointer.y) > 0.002
      ) {
        animationFrame = window.requestAnimationFrame(settlePointer);
      }
    };

    const moveLight = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetPointer.x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      targetPointer.y = 1 - (event.clientY - rect.top) / Math.max(rect.height, 1);
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(settlePointer);
    };

    const resetLight = () => {
      targetPointer.x = 0.34;
      targetPointer.y = 0.76;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(settlePointer);
    };

    const image = new Image();
    image.decoding = "async";
    image.src = "/materials/technical-fabric-normal.png";
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      draw();
    };

    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(host);
    host.addEventListener("pointermove", moveLight, { passive: true });
    host.addEventListener("pointerleave", resetLight, { passive: true });
    draw();

    return () => {
      resizeObserver.disconnect();
      host.removeEventListener("pointermove", moveLight);
      host.removeEventListener("pointerleave", resetLight);
      window.cancelAnimationFrame(animationFrame);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [tone]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
    />
  );
}
