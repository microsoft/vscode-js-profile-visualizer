/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IBox } from './flame-graph';

const enum Constants {
  CharPadding = 4,
  Verticies = 6,
  Spacing = 0.1,
}

export interface IOptions {
  color: string;
  size: number;
  font: string;
}

interface ICharacter {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class Atlas {
  /**
   * Creates an atlas capable of rendering the text on all the given boxes.
   */
  public static fromBoxes(boxes: ReadonlyArray<IBox>, options: IOptions) {
    const seen = new Set<string>();
    const chars: string[] = [];
    for (const box of boxes) {
      for (const c of box.text) {
        if (!seen.has(c)) {
          chars.push(c);
          seen.add(c);
        }
      }
    }

    return Atlas.fromChars(chars, options);
  }

  public static fromChars(chars: ReadonlyArray<string>, options: IOptions) {
    const canvas = document.createElement('canvas');
    const columns = Math.ceil(Math.sqrt(chars.length));
    const rows = Math.floor(Math.sqrt(chars.length));

    const cellSize = options.size + Constants.CharPadding;
    canvas.width = rows * cellSize;
    canvas.height = columns * cellSize;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const context = canvas.getContext('2d')!;
    context.fillStyle = options.color;
    context.font = `${options.size}px ${options.font}`;
    const characters: { [charCode: number]: ICharacter } = [];

    let i = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; i++) {
        const c = chars[i++];
        if (c === undefined) {
          break;
        }

        const measured = context.measureText(c);
        context.fillText(c, x * cellSize, y * cellSize);
        characters[c.charCodeAt(0)] = {
          x: x * cellSize,
          y: y * cellSize,
          width: measured.width,
          height: measured.actualBoundingBoxDescent,
        };
      }
    }

    return new Atlas(canvas, characters);
  }

  constructor(
    private readonly source: TexImageSource,
    private readonly characters: { [charCode: number]: ICharacter },
  ) {}

  public upload(gl: WebGL2RenderingContext) {
    const glyphTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 255, 255]),
    );

    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return glyphTex;
  }

  public stringToVerticies(str: string, scale: number) {
    const positions = new Float32Array(Constants.Verticies * 2);
    const texcoords = new Float32Array(Constants.Verticies * 2);
    let offset = 0;
    let x = 0;
    for (let i = 0; i < str.length; i++) {
      const char = this.characters[str.charCodeAt(i)];
      if (!char) {
        continue;
      }

      const x2 = x + char.width * scale;
      const y2 = char.height * scale;

      const u1 = char.x / this.source.width;
      const u2 = (char.x + char.width) / this.source.width;
      const v1 = char.y / this.source.height;
      const v2 = (char.y + char.height) / this.source.height;

      // 6 vertices per letter
      positions[offset + 0] = x;
      positions[offset + 1] = 0;
      texcoords[offset + 0] = u1;
      texcoords[offset + 1] = v1;

      positions[offset + 2] = x2;
      positions[offset + 3] = 0;
      texcoords[offset + 2] = u2;
      texcoords[offset + 3] = v1;

      positions[offset + 4] = x;
      positions[offset + 5] = y2;
      texcoords[offset + 4] = u1;
      texcoords[offset + 5] = v2;

      positions[offset + 6] = x;
      positions[offset + 7] = y2;
      texcoords[offset + 6] = u1;
      texcoords[offset + 7] = v2;

      positions[offset + 8] = x2;
      positions[offset + 9] = 0;
      texcoords[offset + 8] = u2;
      texcoords[offset + 9] = v1;

      positions[offset + 10] = x2;
      positions[offset + 11] = y2;
      texcoords[offset + 10] = u2;
      texcoords[offset + 11] = v2;

      x += scale * char.width * (1 + Constants.Spacing);
      offset += 12;
    }

    return {
      arrays: {
        position: new Float32Array(positions.buffer, 0, offset),
        texcoord: new Float32Array(texcoords.buffer, 0, offset),
      },
      numVertices: offset / 2,
    };
  }
}
