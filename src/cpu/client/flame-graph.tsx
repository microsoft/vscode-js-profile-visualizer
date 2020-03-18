/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent, Fragment } from 'preact';
import { IProfileModel, ILocation, Category } from '../model';
import { useRef, useMemo, useEffect, useState, useCallback, useContext } from 'preact/hooks';
import { useWindowSize } from '../../common/client/useWindowSize';
import styles from './flame-graph.css';
import { getLocationText, decimalFormat } from './display';
import { classes } from '../../common/client/util';
import { VsCodeApi } from '../../common/client/vscodeApi';
import { IOpenDocumentMessage } from '../types';

const enum Constants {
  BoxHeight = 20,
  TextColor = '#fff',
  BoxColor = '#000',
}

interface IColumn {
  width: number;
  rows: ((ILocation & { graphId: number }) | number)[];
}

/**
 * Builds a 2D array of flame graph entries. Returns the columns with nested
 * 'rows'. Each column includes a percentage width (0-1) of the screen space.
 * A number, instead of a node in a column, means it should be merged with
 * the node at the column at the given index.
 */
const buildColumns = (model: IProfileModel) => {
  const columns: IColumn[] = [];
  let graphIdCounter = 0;

  // 1. Build initial columns
  for (let i = 1; i < model.samples.length - 1; i++) {
    let node = model.nodes[model.samples[i]];
    let aggregateTime = 0;

    const rows: (ILocation & { graphId: number })[] = [];
    while (true) {
      aggregateTime += node.selfTime;
      rows.unshift({
        ...model.locations[node.locationId],
        graphId: graphIdCounter++,
        selfTime: node.selfTime,
        aggregateTime,
      });

      if (!node.parent) {
        break;
      }

      node = model.nodes[node.parent];
    }

    columns.push({ width: model.timeDeltas[i + 1] / model.duration, rows });
  }

  // 2. Merge them
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    for (let y = 0; y < col.rows.length; y++) {
      const current = col.rows[y] as ILocation;
      const prevOrNumber = columns[x - 1]?.rows[y];

      if (typeof prevOrNumber === 'number') {
        if (current.id === (columns[prevOrNumber].rows[y] as ILocation).id) {
          col.rows[y] = prevOrNumber;
        }
      } else if (prevOrNumber?.id === current.id) {
        col.rows[y] = x - 1;
      } else {
        continue;
      }

      const prev =
        typeof prevOrNumber === 'number'
          ? (columns[prevOrNumber].rows[y] as ILocation)
          : prevOrNumber;
      prev.selfTime += current.selfTime;
      prev.aggregateTime += current.aggregateTime;
    }
  }

  return columns;
};

const pickColor = (location: ILocation & { graphId: number }, fade?: boolean) => {
  if (location.category === Category.System) {
    return { light: '#999', dark: '#888' };
  }

  const hash = location.graphId * 5381; // djb2's prime, just some bogus stuff
  let hue = 40 - (60 * (hash & 0xff)) / 0xff;
  if (hue < 0) {
    hue += 360;
  }

  let saturation = 80 + (((hash >>> 8) & 0xff) / 0xff) * 20;
  if (fade) {
    saturation -= 50;
  }

  const lum = 30 + (20 * ((hash >>> 16) & 0xff)) / 0xff;
  return {
    light: `hsl(${hue}, ${saturation}%, ${lum}%)`,
    dark: `hsl(${hue}, ${saturation}%, ${lum - 7}%)`,
  };
};

interface IBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: { light: string; dark: string };
  level: number;
  text: string;
  loc: ILocation & { graphId: number };
}

const buildBoxes = (columns: IColumn[]) => {
  const width = 1 / columns.reduce((acc, c) => acc + c.width, 0);
  const boxes: Map<string, IBox> = new Map();

  let offset = 0;
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    for (let y = 0; y < col.rows.length; y++) {
      const loc = col.rows[y];
      if (typeof loc === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        boxes.get(`${loc}:${y}`)!.x2 = (offset + col.width) * width;
      } else {
        const y2 = Constants.BoxHeight * (y + 1);
        boxes.set(`${x}:${y}`, {
          x1: offset * width,
          x2: (offset + col.width) * width,
          y1: Constants.BoxHeight * y,
          y2,
          level: y,
          text: loc.callFrame.functionName,
          color: pickColor(loc),
          loc,
        });
      }
    }

    offset += col.width;
  }

  return [...boxes.values()].sort((a, b) =>
    a.level !== b.level ? a.level - b.level : a.x1 - b.x1,
  );
};

const getBoxAtPosition = (x: number, y: number, boxes: ReadonlyArray<IBox>) => {
  for (const box of boxes) {
    if (box.y1 > y || box.y2 <= y) {
      continue;
    }

    if (box.x1 > x || box.x2 <= x) {
      continue;
    }

    return box;
  }

  return undefined;
};

/**
 * Gets boxes that appear inside the bounds, and with their x/y/faded values
 * adjusted for drawing in the bounds.
 */
const getBoundedBoxes = (rawBoxes: IBox[], { minX, maxX, level }: IBounds) => {
  const filtered: IBox[] = [];
  let maxY = 0;
  for (const box of rawBoxes) {
    if (box.x1 <= maxX && box.x2 > minX) {
      filtered.push({
        ...box,
        color: box.level < level ? pickColor(box.loc, true) : box.color,
        x1: Math.max(0, (box.x1 - minX) / (maxX - minX)),
        x2: Math.min(1, (box.x2 - minX) / (maxX - minX)),
      });
    }

    maxY = Math.max(box.y2, maxY);
  }

  return { boxes: filtered, maxY };
};

const findLast = <T extends {}>(
  arr: ReadonlyArray<T>,
  predicate: (value: T, index: number) => boolean,
  startAt = arr.length - 1,
): T | undefined => {
  for (; startAt >= 0; startAt--) {
    if (predicate(arr[startAt], startAt)) {
      return arr[startAt];
    }
  }

  return undefined;
};

interface IBounds {
  minX: number;
  maxX: number;
  level: number;
}

const enum HighlightSource {
  Hover,
  Keyboard,
}

const dpr = window.devicePixelRatio || 1;

export const FlameGraph: FunctionComponent<{
  model: IProfileModel;
  filterFn: (input: string) => boolean;
}> = ({ model }) => {
  const canvas = useRef<HTMLCanvasElement>();
  const context = useMemo(() => canvas.current?.getContext('2d'), [canvas.current]);
  const windowSize = useWindowSize();
  const [canvasWidth, setCanvasWidth] = useState(100);
  const [highlight, setHighlight] = useState<{ box: IBox; src: HighlightSource } | undefined>(
    undefined,
  );
  const [bounds, setBounds] = useState<IBounds>({ minX: 0, maxX: 1, level: 0 });
  const [focused, setFocused] = useState<IBox | undefined>(undefined);
  const vscode = useContext(VsCodeApi);

  const columns = useMemo(() => buildColumns(model), [model]);
  const rawBoxes = useMemo(() => buildBoxes(columns), [columns]);
  const boxData = useMemo(() => getBoundedBoxes(rawBoxes, bounds), [rawBoxes, bounds]);

  const openBox = useCallback(
    (box: IBox, evt: { altKey: boolean }) => {
      const src = box.loc.src;
      if (!src?.source.path) {
        return;
      }

      vscode.postMessage<IOpenDocumentMessage>({
        type: 'openDocument',
        path: src.source.path,
        lineNumber: src.lineNumber,
        columnNumber: src.columnNumber,
        toSide: evt.altKey,
      });
    },
    [vscode],
  );

  const drawBox = useCallback(
    (
      box: IBox,
      isHighlit = highlight?.box.loc.graphId === box.loc.graphId,
      isFocused = focused?.loc.graphId === box.loc.graphId,
    ) => {
      if (!context) {
        return;
      }

      const { y1, y2, text } = box;
      const x1 = box.x1 * canvasWidth;
      const x2 = box.x2 * canvasWidth;
      const width = x2 - x1;
      const height = y2 - y1;

      context.fillStyle = isFocused
        ? 'rgb(14, 99, 156)'
        : isHighlit
        ? box.color.dark
        : box.color.light;

      context.fillRect(x1, y1, width, height - 1);

      if (width > 10) {
        context.save();
        context.beginPath();
        context.rect(x1, y1, width - 3, height);
        context.clip();

        context.fillStyle = Constants.TextColor;
        context.fillText(text, x1 + 3, y1 + Constants.BoxHeight / 2);
        context.restore();
      }
    },
    [context, highlight, focused, bounds, canvasWidth],
  );

  // Re-render when the box data changes
  useEffect(() => {
    if (!context) {
      return;
    }

    const { boxes, maxY } = boxData;
    context.textBaseline = 'middle';
    context.canvas.height = maxY * dpr;
    context.canvas.style.height = `${maxY}px`;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    for (const box of boxes) {
      drawBox(box);
    }
  }, [context, boxData, canvasWidth]);

  // Update the canvas size when the window size changes, and on initial render
  useEffect(() => {
    if (!canvas.current) {
      return;
    }

    const { width } = (canvas.current.parentElement as HTMLElement).getBoundingClientRect();
    if (width !== canvasWidth) {
      setCanvasWidth(width);
    }
  }, [windowSize, canvas]);

  // Callback that zoomes into the given box.
  const zoomToBox = useCallback(
    (box: IBox) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const original = rawBoxes.find(b => b.loc.graphId === box.loc.graphId)!;
      setBounds({ minX: original.x1, maxX: original.x2, level: box.level });
      setFocused(box);
    },
    [rawBoxes, setBounds, setFocused],
  );

  // Key event handler, deals with focus navigation and escape/enter
  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      switch (evt.key) {
        case 'Escape':
          // If there's a tooltip open, close that on first escape
          return highlight?.src === HighlightSource.Keyboard
            ? setHighlight(undefined)
            : setBounds({ minX: 0, maxX: 1, level: 0 });
        case 'Enter':
          if ((evt.metaKey || evt.ctrlKey) && highlight) {
            return openBox(highlight.box, evt);
          }

          return focused && zoomToBox(focused);
        case 'Space':
          return focused && zoomToBox(focused);
        default:
        // fall through
      }

      const focusIndex = boxData.boxes.findIndex(b => b.loc.graphId === focused?.loc.graphId);
      const f = boxData.boxes[focusIndex];
      if (!f) {
        return;
      }

      let nextFocus: IBox | false | undefined;
      switch (evt.key) {
        case 'ArrowRight':
          const next = boxData.boxes[focusIndex + 1];
          if (next?.y1 === f.y1) {
            nextFocus = next;
          }
          break;
        case 'ArrowLeft':
          const prev = boxData.boxes[focusIndex - 1];
          if (prev?.y1 === f.y1) {
            nextFocus = prev;
          }
          break;
        case 'ArrowUp':
          nextFocus = findLast(
            boxData.boxes,
            b => b.y1 < f.y1 && b.x1 <= f.x1 && b.x2 >= f.x2,
            focusIndex - 1,
          );
          break;
        case 'ArrowDown':
          nextFocus = boxData.boxes.find(
            b => b.y1 > f.y1 && b.x1 >= f.x1 && b.x2 <= f.x2,
            focusIndex - 1,
          );
          break;
        default:
          break;
      }

      if (nextFocus) {
        drawBox(f, undefined, false);
        drawBox(nextFocus, undefined, true);
        setFocused(nextFocus);
        setHighlight({ box: nextFocus, src: HighlightSource.Keyboard });
      }
    },
    [setBounds, setFocused, zoomToBox, focused, boxData, drawBox],
  );

  // Keyboard events
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const getBoxUnderCursor = useCallback(
    (evt: MouseEvent) => {
      if (!canvas.current) {
        return;
      }

      const { top, left, width } = canvas.current.getBoundingClientRect();
      return getBoxAtPosition((evt.pageX - left) / width, evt.pageY - top, boxData.boxes);
    },
    [canvas, boxData],
  );

  const onClick = useCallback(
    (evt: MouseEvent) => {
      const box = getBoxUnderCursor(evt);
      if (box && (evt.ctrlKey || evt.metaKey)) {
        openBox(box, evt);
      } else if (box) {
        zoomToBox(box);
      } else {
        setBounds({ minX: 0, maxX: 1, level: 0 });
      }

      setHighlight(undefined);
    },
    [getBoxUnderCursor, setBounds, rawBoxes, setHighlight],
  );

  const onMove = useCallback(
    (evt: MouseEvent) => {
      if (!context) {
        return;
      }

      const box = getBoxUnderCursor(evt);
      if (!highlight) {
        // no previous = fall through
      } else if (!box && highlight.src === HighlightSource.Keyboard) {
        // don't hide tooltips created by focus change on mousemove
        return;
      } else if (highlight.box.loc.graphId !== box?.loc.graphId) {
        // a previous that wasn't ours, redraw
        const b = boxData.boxes.find(b => b.loc.graphId === highlight.box.loc.graphId);
        b && drawBox(b, false);
      } else {
        // a previous that's the same one, return
        return;
      }

      if (box) {
        drawBox(box, true);
        setHighlight({ box, src: HighlightSource.Hover });
      } else {
        setHighlight(undefined);
      }
    },
    [getBoxUnderCursor, context, canvasWidth, highlight, setHighlight, boxData],
  );

  return (
    <Fragment>
      <canvas
        ref={canvas}
        width={canvasWidth * dpr}
        style={{ width: canvasWidth, cursor: highlight ? 'pointer' : 'default' }}
        onClick={onClick}
        onMouseMove={onMove}
      />
      {highlight && (
        <Tooltip
          left={Math.min(canvasWidth - 300, canvasWidth * highlight.box.x1)}
          src={highlight.src}
          top={highlight.box.y2}
          location={highlight.box.loc}
        />
      )}
    </Fragment>
  );
};

const Tooltip: FunctionComponent<{
  left: number;
  top: number;
  location: ILocation;
  src: HighlightSource;
}> = ({ left, top, src, location }) => {
  const label = getLocationText(location);

  return (
    <div className={styles.tooltip} style={{ left, top }}>
      <div className={styles.function}>{location.callFrame.functionName}</div>
      {label && (
        <div className={classes(styles.label, location.src && styles.clickable)}>{label}</div>
      )}
      <div className={styles.time}>
        <span>Self Time</span>
        <span>{decimalFormat.format(location.selfTime / 1000)}ms</span>
      </div>
      <div className={styles.time}>
        <span>Aggregate Time</span>
        <span>{decimalFormat.format(location.aggregateTime / 1000)}ms</span>
      </div>
      {location.src && (
        <div className={styles.hint}>
          Ctrl+{src === HighlightSource.Keyboard ? 'Enter' : 'Click'} to jump to file
        </div>
      )}
    </div>
  );
};
