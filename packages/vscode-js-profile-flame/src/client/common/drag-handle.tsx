/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import { useCallback } from 'preact/hooks';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { Constants } from '../common/constants';
import { IBounds, IDrag, LockBound } from '../common/types';
import styles from './common.css';

const DragHandle: FunctionComponent<{
  canvasWidth: number;
  bounds: IBounds;
  current: IDrag | undefined;
  startDrag: (bounds: IDrag) => void;
}> = ({ current, bounds, startDrag, canvasWidth }) => {
  const start = useCallback(
    (evt: MouseEvent, lock: LockBound, original: IBounds = bounds) => {
      startDrag({
        timestamp: Date.now(),
        pageXOrigin: evt.pageX,
        pageYOrigin: evt.pageY,
        original,
        xPerPixel: -1 / canvasWidth,
        lock: lock | LockBound.Y,
      });
      evt.preventDefault();
      evt.stopPropagation();
    },
    [canvasWidth, bounds],
  );

  const range = bounds.maxX - bounds.minX;
  const lock = current?.lock ?? 0;

  return (
    <div
      className={classes(styles.handle, current && styles.active)}
      style={{ height: Constants.TimelineHeight }}
    >
      <div
        className={classes(styles.bg, lock === LockBound.Y && styles.active)}
        onMouseDown={useCallback((evt: MouseEvent) => start(evt, LockBound.Y), [start])}
        style={{ transform: `scaleX(${range}) translateX(${(bounds.minX / range) * 100}%)` }}
      />
      <div
        className={classes(styles.bookend, lock & LockBound.MaxX && styles.active)}
        style={{ transform: `translateX(${bounds.minX * 100}%)` }}
      >
        <div
          style={{ left: 0 }}
          onMouseDown={useCallback((evt: MouseEvent) => start(evt, LockBound.MaxX), [start])}
        />
      </div>
      <div
        className={classes(styles.bookend, lock & LockBound.MinX && styles.active)}
        style={{ transform: `translateX(${(bounds.maxX - 1) * 100}%)` }}
      >
        <div
          style={{ right: 0 }}
          onMouseDown={useCallback((evt: MouseEvent) => start(evt, LockBound.MinX), [start])}
        />
      </div>
    </div>
  );
};

export default DragHandle;
