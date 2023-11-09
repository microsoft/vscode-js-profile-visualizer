/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as ChevronDown from '@vscode/codicons/src/icons/chevron-down.svg';
import * as ChevronRight from '@vscode/codicons/src/icons/chevron-right.svg';
import { FunctionComponent, h } from 'preact';
import { useCallback, useContext } from 'preact/hooks';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { getNodeText } from 'vscode-js-profile-core/out/esm/common/display';
import { IOpenDocumentMessage } from 'vscode-js-profile-core/out/esm/common/types';
import { IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import { ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';
import { IRowProps } from './base-time-view';
import getGlobalUniqueId from './get-global-unique-id';
import styles from './time-view.css';

export const makeBaseTimeViewRow =
  <T extends IGraphNode | ITreeNode>(): FunctionComponent<IRowProps<T>> =>
  ({
    node,
    depth,
    expanded,
    position,
    onKeyDown: onKeyDownRaw,
    onFocus: onFocusRaw,
    onExpanded,
    children,
  }) => {
    const vscode = useContext(VsCodeApi);
    const onClick = useCallback(
      (evt: MouseEvent) =>
        vscode.postMessage<IOpenDocumentMessage>({
          type: 'openDocument',
          callFrame: node.callFrame,
          location: (node as IGraphNode).src,
          toSide: evt.altKey,
        }),
      [vscode, node],
    );

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
        {node.childrenSize > 0 ? <Icon i={expanded ? ChevronDown : ChevronRight} /> : null}
      </span>
    );

    const location = getNodeText(node);

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
        aria-setsize={node.parent?.childrenSize ?? 1}
        aria-level={depth + 1}
        aria-expanded={expanded}
      >
        {children}
        {!location ? (
          <div
            className={classes(styles.location, styles.virtual)}
            style={{ marginLeft: depth * 15 }}
          >
            {expand} <span className={styles.fn}>{node.callFrame.functionName}</span>
          </div>
        ) : (
          <div className={styles.location} style={{ marginLeft: depth * 15 }}>
            {expand} <span className={styles.fn}>{node.callFrame.functionName}</span>
            <span className={styles.file}>
              <a href="#" onClick={onClick}>
                {location}
              </a>
            </span>
          </div>
        )}
      </div>
    );
  };
