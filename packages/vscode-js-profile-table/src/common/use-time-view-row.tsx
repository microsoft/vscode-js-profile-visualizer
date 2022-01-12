/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h } from 'preact';
import { useCallback, useContext } from 'preact/hooks';
import * as ChevronDown from 'vscode-codicons/src/icons/chevron-down.svg';
import * as ChevronRight from 'vscode-codicons/src/icons/chevron-right.svg';
import { toggleInSet } from 'vscode-js-profile-core/out/esm/array';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IOpenDocumentMessage } from 'vscode-js-profile-core/out/esm/common/types';
import { getLocationText } from 'vscode-js-profile-core/out/esm/cpu/display';
import { IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import styles from '../common/time-view.css';

const useTimeViewRow = ({
  node,
  expanded,
  onKeyDownRaw,
  onFocusRaw,
  onExpandChange,
}: {
  node: IGraphNode;
  expanded: ReadonlySet<IGraphNode>;
  onExpandChange: (expanded: ReadonlySet<IGraphNode>) => void;
  onKeyDownRaw?: (evt: KeyboardEvent, node: IGraphNode) => void;
  onFocusRaw?: (node: IGraphNode) => void;
}) => {
  const vscode = useContext(VsCodeApi);
  const onClick = useCallback(
    (evt: MouseEvent) =>
      vscode.postMessage<IOpenDocumentMessage>({
        type: 'openDocument',
        callFrame: node.callFrame,
        location: node.src,
        toSide: evt.altKey,
      }),
    [vscode, node],
  );

  const onToggleExpand = useCallback(() => {
    onExpandChange(toggleInSet(expanded, node));
  }, [expanded, onExpandChange, node]);

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
    root = root.parent;
  }

  const location = getLocationText(node);
  const expand = (
    <span className={styles.expander}>
      {node.childrenSize > 0 ? <Icon i={expanded.has(node) ? ChevronDown : ChevronRight} /> : null}
    </span>
  );

  return { location, root, expand, onKeyDown, onFocus, onToggleExpand, onClick };
};

export default useTimeViewRow;
