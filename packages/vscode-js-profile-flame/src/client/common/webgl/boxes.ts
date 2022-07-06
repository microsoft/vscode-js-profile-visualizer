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
  const vertexBuffer = gl.createBuffer();
  let vertexCount = 0;

  const setBoxes = (boxes: ReadonlyArray<IBox>) => {
    const boxesBuffer = gl.createBuffer();

    vertexCount = boxes.length * 2 * 3; // 2 triangles, 3 verticies each
    const positions = new Float32Array(boxes.length * 4 * 4); // (x, y, id, cat) per box corner
    const indexData = new Uint32Array(vertexCount);

    let pi = 0;
    let ii = 0;
    for (const box of boxes) {
      const topLeft = pi >>> 2;
      positions[pi++] = box.x1;
      positions[pi++] = box.y1 - Constants.BoxHeight;
      positions[pi++] = box.loc.graphId;
      positions[pi++] = box.category;

      const topRight = pi >>> 2;
      positions[pi++] = box.x2;
      positions[pi++] = box.y1 - Constants.BoxHeight;
      positions[pi++] = box.loc.graphId;
      positions[pi++] = box.category;

      const bottomLeft = pi >>> 2;
      positions[pi++] = box.x1;
      positions[pi++] = box.y2 - 1 - Constants.BoxHeight;
      positions[pi++] = box.loc.graphId;
      positions[pi++] = box.category;

      const bottomRight = pi >>> 2;
      positions[pi++] = box.x2;
      positions[pi++] = box.y2 - 1 - Constants.BoxHeight;
      positions[pi++] = box.loc.graphId;
      positions[pi++] = box.category;

      // triangle 1:
      indexData[ii++] = topLeft;
      indexData[ii++] = topRight;
      indexData[ii++] = bottomLeft;

      // triangle 2:
      indexData[ii++] = topRight;
      indexData[ii++] = bottomLeft;
      indexData[ii++] = bottomRight;
    }

    console.assert(ii === indexData.length, 'expected to have written all indices');
    console.assert(pi === positions.length, 'expected to have written all positions');

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, boxesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(boxAttributeLocation, 4, gl.FLOAT, false, 0, 0);
  };

  /**
   * Redraws the set of arrays on the screen.
   */
  const redraw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexBuffer);
    gl.enableVertexAttribArray(boxAttributeLocation);
    gl.drawElements(gl.TRIANGLES, vertexCount, gl.UNSIGNED_INT, 0);
  };

  let timeout: number;
  const debounceRedraw = () => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(redraw, 2) as unknown as number;
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

    const rgba = chroma(color).rgba();
    rgba[3] = 255;
    gl.uniform4fv(focusColorLocation, new Float32Array(rgba.map(r => r / 255)));
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
