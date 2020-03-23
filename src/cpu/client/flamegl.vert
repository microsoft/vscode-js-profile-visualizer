#version 300 es

// x/y positions, x in 0-1 percentages of the total height and y in pixels
in vec2 position;

// (x1, y1, x2, y2) bounds of the canvas in pixels
uniform vec4 bounds;

void main() {
  float range_x = bounds[2] - bounds[0];
  float range_y = bounds[3] - bounds[1];
  gl_Position = vec4(
    (position[0] - bounds[0]) / range_x * 2.0 - 1.0,
    (position[1] - bounds[1]) / range_y * -2.0 + 1.0,
    0,
    1
  );
}
