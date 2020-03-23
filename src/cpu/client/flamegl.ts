/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import vertexShaderSource from './flamegl.vert';
import fragmentShaderSource from './flamegl.frag';
import { IBox, ICanvasSize, IBounds } from './flame-graph';
import { Atlas } from './atlas';

const createShader = (gl: WebGL2RenderingContext, type: GLenum, source: string) => {
  const shader = gl.createShader(type)!;
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
  const program = gl.createProgram()!;
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
  canvas: HTMLCanvasElement;
  boxes: ReadonlyArray<IBox>;
}

export const setupGl = ({ canvas, boxes: initialBoxes }: IOptions) => {
  // Get A WebGL context
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    return;
  }

  const atlas = Atlas.fromBoxes(initialBoxes, {
    color: '#fff',
    font: 'monospace',
    size: 18,
  });

  atlas.upload(gl);

  const textProgram = createProgram(gl, createShader(gl, gl.VERTEX_SHADER, `#version 300 es
  in vec4 a_position;
  in vec2 a_texcoord;

  // x/y positions, x in 0-1 percentages of the total height and y in pixels
  in vec2 position;

  // (x1, y1, x2, y2) bounds of the canvas in pixels
  uniform vec4 bounds;
  
  out vec2 v_texcoord;

  void main() {
    // Multiply the position by the matrix.
    gl_Position = u_matrix * a_position;

    // Pass the texcoord to the fragment shader.
    v_texcoord = a_texcoord;
  }
  `), createShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
  precision mediump float;

  // Passed in from the vertex shader.
  in vec2 v_texcoord;

  uniform sampler2D u_texture;

  out vec4 outColor;

  void main() {
     outColor = texture(u_texture, v_texcoord);
  }
  `));

  const updateTextData = (boxes: ReadonlyArray<IBox>) => {
    for (const box of boxes) {
      const verticies = atlas.stringToVerticies(box.text, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, textBufferInfo.attribs.a_position.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.arrays.position, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, textBufferInfo.attribs.a_texcoord.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.arrays.texcoord, gl.STATIC_DRAW);
    }
  }

  // Link the two shaders into a program
  const boxProgram = createProgram(gl, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource), createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));

  // look up where the vertex data needs to go.
  const positionAttributeLocations = [
    gl.getAttribLocation(boxProgram, 'position'),
    gl.getAttribLocation(textProgram, 'position'),
  ];
  const boxesVeritices = gl.createVertexArray();

  let vertexCount = 0;
  const setBoxes = (boxes: ReadonlyArray<IBox>) => {
    const boxesBuffer = gl.createBuffer();

    // Generate two extra vectors per box so that a 'degenerate tri' is created,
    // see "BIGGER grid" on http://www.corehtml5.com/trianglestripfundamentals.php
    vertexCount = boxes.length * 6;
    const positions = new Float32Array(vertexCount * 2);
    let k = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      // top left:
      positions[k++] = box.x1;
      positions[k++] = box.y1;

      // top left (repeat for degeneracy):
      positions[k++] = box.x1;
      positions[k++] = box.y1;

      // top right:
      positions[k++] = box.x2;
      positions[k++] = box.y1;

      // bottom left:
      positions[k++] = box.x1;
      positions[k++] = box.y2;

      // bottom right:
      positions[k++] = box.x2;
      positions[k++] = box.y2;

      // bottom right (repeat):
      positions[k++] = box.x2;
      positions[k++] = box.y2;
    }

    gl.useProgram(boxProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, boxesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.bindVertexArray(boxesVeritices);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  };

  const redraw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(boxProgram);
    gl.bindVertexArray(boxesVeritices);
    gl.drawArrays(gl.TRIANGLE_STRIP, /* offset= */ 0, /* count= */ vertexCount);
  };

  const boundsLocation = gl.getUniformLocation(boxProgram, 'bounds');

  /**
   * Update the bound size of the canvas.
   */
  const setBounds = (bounds: IBounds, size: ICanvasSize) => {
    gl.viewport(0, 0, size.width, size.height);
    gl.uniform4f(boundsLocation, bounds.minX, bounds.y, bounds.maxX, size.height);
  };

  // Clear the canvas
  gl.clearColor(0, 0, 0, 0);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(boxProgram);

  setBounds({ minX: 0, maxX: 1, y: 0, level: 0 }, { width: 100, height: 100 });
  setBoxes(initialBoxes);
  redraw();

  return {
    setBounds: (bounds: IBounds, size: ICanvasSize) => {
      setBounds(bounds, size);
      redraw();
    },
    setBoxes: (boxes: ReadonlyArray<IBox>) => {
      setBoxes(boxes);
      redraw();
    },
  };
};
