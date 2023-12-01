/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { useEffect } from 'preact/hooks';

export const useResizeObserver = <T extends HTMLElement>(
  callback: (entry: ResizeObserverEntry) => void,
  element: T | null,
  options?: ResizeObserverOptions,
) => {
  useEffect(() => {
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        callback(entry);
      }
    });

    observer.observe(element, options);

    return () => observer.disconnect();
  }, [callback, element, options]);
};
