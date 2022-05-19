/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import chroma from 'chroma-js';
import { Constants } from '../constants';
import { IBounds, IBox, ICanvasSize } from '../types';
import fragmentShaderSource from './box.frag';
import vertexShaderSource from './box.vert';

const createShader = (gl: WebGL2RenderingContext, type: GLenum, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error(`Failed creating shader ${type}`);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  const log = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(`Shader creation failed (${log || 'unknown'})`);
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) => {
  const program = gl.createProgram();
  if (!program) {
    throw new Error(`Failed creating program`);
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  const log = gl.getProgramInfoLog(program);
  gl.deleteProgram(program);
  throw new Error(`Program creation failed (${log || 'unknown'})`);
};

interface IOptions {
  scale: number;
  canvas: HTMLCanvasElement;
  focusColor: string;
  primaryColor: string;
  boxes: ReadonlyArray<IBox>;
}

export const setupGl = ({
  scale: initialScale,
  canvas,
  boxes: initialBoxes,
  focusColor,
  primaryColor,
}: IOptions) => {
  // Get A WebGL context
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    return;
  }

  const boxProgram = createProgram(
    gl,
    createShader(gl, gl.VERTEX_SHADER, vertexShaderSource),
    createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource),
  );

  const boxAttributeLocation = gl.getAttribLocation(boxProgram, 'boxes');
  const boxBuffer = gl.createVertexArray();

  let vertexCount = 0;
  const setBoxes = (boxes: ReadonlyArray<IBox>) => {
    const boxesBuffer = gl.createBuffer();

    vertexCount = boxes.length * 6;
    const positions = new Float32Array(vertexCount * 4);

    let k = 0;
    for (const box of boxes) {
      // top left:
      positions[k++] = box.x1;
      positions[k++] = box.y1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;

      // top right:
      positions[k++] = box.x2;
      positions[k++] = box.y1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;

      // bottom left:
      positions[k++] = box.x1;
      positions[k++] = box.y2 - 1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;

      // bottom left (triangle 2):
      positions[k++] = box.x1;
      positions[k++] = box.y2 - 1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;

      // top right (triangle 2):
      positions[k++] = box.x2;
      positions[k++] = box.y1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;

      // bottom right:
      positions[k++] = box.x2;
      positions[k++] = box.y2 - 1 - Constants.BoxHeight;
      positions[k++] = box.loc.graphId;
      positions[k++] = box.category;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, boxesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindVertexArray(boxBuffer);
    gl.enableVertexAttribArray(boxAttributeLocation);
    gl.vertexAttribPointer(boxAttributeLocation, 4, gl.FLOAT, false, 0, 0);
  };

  /**
   * Redraws the set of arrays on the screen.
   */
  const redraw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  };

  let timeout: number;
  const debounceRedraw = () => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = (setTimeout(redraw, 2) as unknown) as number;
  };

  const boundsLocation = gl.getUniformLocation(boxProgram, 'bounds');
  const hoveredLocation = gl.getUniformLocation(boxProgram, 'hovered');
  const focusedLocation = gl.getUniformLocation(boxProgram, 'focused');
  const focusColorLocation = gl.getUniformLocation(boxProgram, 'focus_color');
  const primaryColorLocation = gl.getUniformLocation(boxProgram, 'primary_color');

  /**
   * Update the bound size of the canvas.
   */
  const setBounds = (bounds: IBounds, size: ICanvasSize, scale: number) => {
    gl.viewport(0, 0, scale * size.width, scale * size.height);
    gl.uniform4f(boundsLocation, bounds.minX, bounds.y, bounds.maxX, bounds.y + size.height);
  };

  const setFocusColor = (color: string) => {
    if (!chroma.valid(color)) {
      return;
    }

    const rgba = chroma(color)
      .rgba()
      .map(r => r / 255) as [number, number, number, number];
    gl.uniform4f(focusColorLocation, ...rgba);
  };

  const setPrimaryColor = (color: string) => {
    if (!chroma.valid(color)) {
      return;
    }

    const parsed = chroma(color);
    const hsv = parsed.luminance(Math.min(parsed.luminance(), 0.25)).hsv();
    gl.uniform4f(primaryColorLocation, hsv[0] / 360, hsv[1], hsv[2], parsed.alpha());
  };

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);
  gl.useProgram(boxProgram);
  setBounds({ minX: 0, maxX: 1, y: 0, level: 0 }, { width: 100, height: 100 }, initialScale);
  setBoxes(initialBoxes);
  setFocusColor(focusColor);
  setPrimaryColor(primaryColor);
  redraw();

  return {
    redraw,
    setHovered: (graphId = -1) => {
      gl.uniform1i(hoveredLocation, graphId);
      debounceRedraw();
    },
    setFocused: (graphId = -1) => {
      gl.uniform1i(focusedLocation, graphId);
      debounceRedraw();
    },
    setFocusColor: (color: string) => {
      setFocusColor(color);
      debounceRedraw();
    },
    setPrimaryColor: (color: string) => {
      setPrimaryColor(color);
      debounceRedraw();
    },
    setBounds: (bounds: IBounds, size: ICanvasSize, scale: number) => {
      setBounds(bounds, size, scale);
      debounceRedraw();
    },
    setBoxes: (boxes: ReadonlyArray<IBox>) => {
      setBoxes(boxes);
      debounceRedraw();
    },
  };
};
