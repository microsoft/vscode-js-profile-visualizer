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
import { useCssVariables } from '../../common/client/useCssVariables';
import { TextCache } from './textCache';

const enum Constants {
  BoxHeight = 20,
  TextColor = '#fff',
  BoxColor = '#000',
  ZoomHeight = 22,
  ZoomLabelSpacing = 200,
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
    const root = model.nodes[model.samples[i]];
    const selfTime = model.timeDeltas[i - 1];
    const rows = [
      {
        ...model.locations[root.locationId],
        graphId: graphIdCounter++,
        selfTime,
        aggregateTime: 0,
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (let id = root.parent; id; id = model.nodes[id!].parent) {
      rows.unshift({
        ...model.locations[model.nodes[id].locationId],
        graphId: graphIdCounter++,
        selfTime: 0,
        aggregateTime: selfTime,
      });
    }

    columns.push({ width: selfTime / model.duration, rows });
  }

  // 2. Merge them
  for (let x = 1; x < columns.length; x++) {
    const col = columns[x];
    for (let y = 0; y < col.rows.length; y++) {
      const current = col.rows[y] as ILocation;
      const prevOrNumber = columns[x - 1]?.rows[y];
      if (typeof prevOrNumber === 'number') {
        if (current.id !== (columns[prevOrNumber].rows[y] as ILocation).id) {
          break;
        }
        col.rows[y] = prevOrNumber;
      } else if (prevOrNumber?.id === current.id) {
        col.rows[y] = x - 1;
      } else {
        break;
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
  let maxY = 0;
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    for (let y = 0; y < col.rows.length; y++) {
      const loc = col.rows[y];
      if (typeof loc === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        boxes.get(`${loc}:${y}`)!.x2 = (offset + col.width) * width;
      } else {
        const y1 = Constants.BoxHeight * y + Constants.ZoomHeight;
        const y2 = y1 + Constants.BoxHeight;
        boxes.set(`${x}:${y}`, {
          x1: offset * width,
          x2: (offset + col.width) * width,
          y1,
          y2,
          level: y,
          text: loc.callFrame.functionName,
          color: pickColor(loc),
          loc,
        });

        maxY = Math.max(y2, maxY);
      }
    }

    offset += col.width;
  }

  return {
    boxes: [...boxes.values()].sort((a, b) =>
      a.level !== b.level ? a.level - b.level : a.x1 - b.x1,
    ),
    maxY,
  };
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
  y: number;
  level: number;
}

interface IDrag {
  timestamp: number;
  pageXOrigin: number;
  pageYOrigin: number;
  originalY: number;
  originalX: number;
  xPerPixel: number;
}

const enum HighlightSource {
  Hover,
  Keyboard,
}

const clamp = (min: number, v: number, max: number) => Math.max(Math.min(v, max), min);

const timelineFormat = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 3,
  minimumSignificantDigits: 3,
});

const dpr = window.devicePixelRatio || 1;

export const FlameGraph: FunctionComponent<{
  model: IProfileModel;
  filterFn: (input: string) => boolean;
}> = ({ model }) => {
  const canvas = useRef<HTMLCanvasElement>();
  const context = useMemo(() => canvas.current?.getContext('2d'), [canvas.current]);
  const windowSize = useWindowSize();
  const [canvasSize, setCanvasSize] = useState({ width: 100, height: 100 });
  const [highlight, setHighlight] = useState<{ box: IBox; src: HighlightSource } | undefined>(
    undefined,
  );
  const [bounds, setBounds] = useState<IBounds>({ minX: 0, maxX: 1, y: 0, level: 0 });
  const [focused, setFocused] = useState<IBox | undefined>(undefined);
  const [drag, setDrag] = useState<IDrag | undefined>(undefined);
  const cssVariables = useCssVariables();
  const vscode = useContext(VsCodeApi);

  const columns = useMemo(() => buildColumns(model), [model]);
  const rawBoxes = useMemo(() => buildBoxes(columns), [columns]);
  const boxData = useMemo(() => getBoundedBoxes(rawBoxes.boxes, bounds), [
    rawBoxes.boxes,
    bounds.minX,
    bounds.maxX,
    bounds.level,
  ]);

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

  const textCache = useMemo(() => {
    const cache = new TextCache();
    cache.setup(dpr, ctx => {
      ctx.fillStyle = Constants.TextColor;
    });
    return cache;
  }, [cssVariables]);

  const drawBox = useCallback(
    (
      box: IBox,
      isHighlit = highlight?.box.loc.graphId === box.loc.graphId,
      isFocused = focused?.loc.graphId === box.loc.graphId,
      isOneOff = true,
    ) => {
      if (!context) {
        return;
      }

      if (box.y2 < bounds.y || box.y1 > bounds.y + canvasSize.height) {
        return;
      }

      const text = box.text;
      const y1 = box.y1 - bounds.y;
      const y2 = box.y2 - bounds.y;
      const x1 = box.x1 * canvasSize.width;
      const x2 = box.x2 * canvasSize.width;
      const width = x2 - x1;
      const height = y2 - y1;

      const needsClip = isOneOff && y1 < Constants.ZoomHeight;
      if (needsClip) {
        context.save();
        context.beginPath();
        context.rect(0, Constants.ZoomHeight, canvasSize.width, canvasSize.height);
        context.clip();
      }

      context.fillStyle = isHighlit ? box.color.dark : box.color.light;
      context.fillRect(x1, y1, width, height - 1);

      if (isFocused) {
        context.strokeStyle = cssVariables.focusBorder;
        context.lineWidth = 2;
        context.strokeRect(x1 + 1, y1 + 1, width - 2, height - 3);
      }

      if (width > 10) {
        textCache.drawText(context, text, x1 + 3, y1, width - 6, Constants.BoxHeight);
      }

      if (needsClip) {
        context.restore();
      }
    },
    [context, highlight, focused, bounds.y, canvasSize, cssVariables],
  );

  // Re-render boxes when data changes
  useEffect(() => {
    if (!context) {
      return;
    }

    context.clearRect(0, Constants.ZoomHeight, context.canvas.width, context.canvas.height);
    for (const box of boxData.boxes) {
      drawBox(box, undefined, undefined, false);
    }
  }, [context, bounds, boxData, canvasSize, cssVariables]);

  // Re-render the zoom indicator when bounds change
  useEffect(() => {
    if (!context) {
      return;
    }

    context.clearRect(0, 0, context.canvas.width, Constants.ZoomHeight);
    context.fillStyle = cssVariables['editor-foreground'];
    context.font = context.textAlign = 'right';
    context.strokeStyle = cssVariables['editorRuler-foreground'];
    context.lineWidth = 1 / dpr;

    const labels = Math.round(canvasSize.width / Constants.ZoomLabelSpacing);
    const spacing = canvasSize.width / labels;

    const timeRange = model.duration * (bounds.maxX - bounds.minX);
    const timeStart = model.duration * bounds.minX;

    context.beginPath();
    for (let i = 1; i <= labels; i++) {
      const time = (i / labels) * timeRange + timeStart;
      const x = i * spacing;
      context.fillText(`${timelineFormat.format(time / 1000)}ms`, x - 3, Constants.ZoomHeight / 2);
      context.moveTo(x, 0);
      context.lineTo(x, Constants.ZoomHeight);
    }

    context.stroke();
    context.textAlign = 'left';
  }, [context, model, canvasSize, bounds, cssVariables]);

  // Update the canvas size when the window size changes, and on initial render
  useEffect(() => {
    if (!canvas.current || !context) {
      return;
    }

    const { width, height } = (canvas.current.parentElement as HTMLElement).getBoundingClientRect();
    if (width !== canvasSize.width || height !== canvasSize.height) {
      canvas.current.style.width = `${width}px`;
      canvas.current.width = width * dpr;
      canvas.current.style.height = `${height}px`;
      canvas.current.height = height * dpr;
      context.textBaseline = 'middle';
      context.scale(dpr, dpr);
      setCanvasSize({ width, height });
    }
  }, [windowSize, canvas]);

  // Callback that zoomes into the given box.
  const zoomToBox = useCallback(
    (box: IBox) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const original = rawBoxes.boxes.find(b => b.loc.graphId === box.loc.graphId)!;
      setBounds({
        minX: original.x1,
        maxX: original.x2,
        y: clamp(0, original.y1, rawBoxes.maxY - canvasSize.height),
        level: box.level,
      });
      setFocused(box);
    },
    [rawBoxes, bounds, setBounds, setFocused],
  );

  // Key event handler, deals with focus navigation and escape/enter
  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      switch (evt.key) {
        case 'Escape':
          // If there's a tooltip open, close that on first escape
          return highlight?.src === HighlightSource.Keyboard
            ? setHighlight(undefined)
            : setBounds({ minX: 0, maxX: 1, y: 0, level: 0 });
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
        drawBox(f, false, false);
        drawBox(nextFocus, true, true);
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
      const fromTop = evt.pageY - top;
      const fromLeft = evt.pageX - left;
      if (fromTop < Constants.ZoomHeight) {
        return;
      }

      return getBoxAtPosition(fromLeft / width, fromTop + bounds.y, boxData.boxes);
    },
    [canvas, bounds.y, boxData],
  );

  const onMouseMove = useCallback(
    (evt: MouseEvent) => {
      if (!context) {
        return;
      }

      if (drag) {
        const range = bounds.maxX - bounds.minX;
        const minX = Math.max(
          0,
          Math.min(1 - range, drag.originalX - (evt.pageX - drag.pageXOrigin) * drag.xPerPixel),
        );
        const y = drag.originalY - (evt.pageY - drag.pageYOrigin);
        setBounds({
          minX,
          maxX: minX + range,
          y: clamp(0, y, rawBoxes.maxY - canvasSize.height),
          level: bounds.level,
        });
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
    [getBoxUnderCursor, drag, bounds, context, canvasSize, highlight, setHighlight, boxData],
  );

  const onWheel = useCallback(
    (evt: WheelEvent) => {
      if (!canvas.current) {
        return;
      }

      const { left, width } = canvas.current.getBoundingClientRect();
      const range = bounds.maxX - bounds.minX;
      const center = bounds.minX + (range * (evt.pageX - left)) / width;
      const scale = evt.deltaY / 400;
      setBounds({
        minX: Math.max(0, bounds.minX + scale * (center - bounds.minX)),
        maxX: Math.min(1, bounds.maxX - scale * (bounds.maxX - center)),
        y: bounds.y,
        level: bounds.level,
      });

      evt.preventDefault();
    },
    [canvas.current, bounds, setBounds],
  );

  const onMouseDown = useCallback(
    (evt: MouseEvent) => {
      setDrag({
        timestamp: Date.now(),
        pageXOrigin: evt.pageX,
        pageYOrigin: evt.pageY,
        xPerPixel: (bounds.maxX - bounds.minX) / canvasSize.width,
        originalX: bounds.minX,
        originalY: bounds.y,
      });
    },
    [setDrag, canvasSize, bounds],
  );

  const onMouseUp = useCallback(
    (evt: MouseEvent) => {
      if (!drag) {
        return;
      }

      const isClick =
        Date.now() - drag.timestamp < 500 &&
        Math.abs(evt.pageX - drag.pageXOrigin) < 100 &&
        Math.abs(evt.pageY - drag.pageYOrigin) < 100;

      setDrag(undefined);

      if (!isClick) {
        return;
      }

      const box = getBoxUnderCursor(evt);
      if (box && (evt.ctrlKey || evt.metaKey)) {
        openBox(box, evt);
      } else if (box) {
        zoomToBox(box);
      } else {
        setBounds({ minX: 0, y: 0, maxX: 1, level: 0 });
      }

      setHighlight(undefined);
    },
    [drag, setDrag, getBoxUnderCursor, openBox, zoomToBox, setBounds, setHighlight],
  );

  return (
    <Fragment>
      <canvas
        ref={canvas}
        style={{ cursor: highlight ? 'pointer' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onWheel={onWheel}
      />
      {highlight && (
        <Tooltip
          left={Math.min(canvasSize.width - 300, canvasSize.width * highlight.box.x1 + 10)}
          src={highlight.src}
          top={highlight.box.y2 - bounds.y}
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
