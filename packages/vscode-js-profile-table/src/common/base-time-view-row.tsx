/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as ChevronDown from '@vscode/codicons/src/icons/chevron-down.svg';
import * as ChevronRight from '@vscode/codicons/src/icons/chevron-right.svg';
import { ComponentChild, FunctionComponent, h } from 'preact';
import { useCallback } from 'preact/hooks';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { ICommonNode } from 'vscode-js-profile-core/out/esm/common/model';
import { IRowProps } from './base-time-view';
import getGlobalUniqueId from './get-global-unique-id';
import styles from './time-view.css';

export const makeBaseTimeViewRow =
  <T extends ICommonNode>(): FunctionComponent<
    IRowProps<T> & { rowText: ComponentChild; locationText?: string; virtual?: boolean }
  > =>
  ({
    node,
    depth,
    numChildren,
    expanded,
    position,
    onKeyDown: onKeyDownRaw,
    onFocus: onFocusRaw,
    onClick,
    onExpanded,
    children,
    rowText,
    locationText,
    virtual = !locationText,
  }) => {
    const onToggleExpand = useCallback(() => onExpanded(!expanded, node), [expanded, node]);

    const onKeyDown = useCallback(
      (evt: KeyboardEvent) => {
        onKeyDownRaw?.(evt, node);
      },
      [onKeyDownRaw, node],
    );

    const onFocus = useCallback(() => {
      onFocusRaw?.(node);
    }, [onFocusRaw, node]);

    let root = node;
    while (root.parent) {
      root = root.parent as T;
    }

    const expand = (
      <span className={styles.expander}>
        {numChildren > 0 ? <Icon i={expanded ? ChevronDown : ChevronRight} /> : null}
      </span>
    );

    return (
      <div
        className={styles.row}
        data-row-id={getGlobalUniqueId(node)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onClick={onToggleExpand}
        tabIndex={0}
        role="treeitem"
        aria-posinset={position}
        aria-level={depth + 1}
        aria-expanded={expanded}
      >
        {children}
        {!locationText ? (
          <div
            className={classes(styles.location, virtual && styles.virtual)}
            style={{ marginLeft: depth * 15 }}
          >
            {expand} <span className={styles.fn}>{rowText}</span>
          </div>
        ) : (
          <div className={styles.location} style={{ marginLeft: depth * 15 }}>
            {expand} <span className={styles.fn}>{rowText}</span>
            <span className={styles.file}>
              <a href="#" onClick={onClick}>
                {locationText}
              </a>
            </span>
          </div>
        )}
      </div>
    );
  };
