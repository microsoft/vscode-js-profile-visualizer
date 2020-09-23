/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export interface ISettings {
  enabledMetrics: number[];
  viewDuration: number;
  pollInterval: number;
  zoomLevel: number;
  easing: boolean;
}

export const enum MessageType {
  UpdateSettings,
  AddData,
  SwitchGraph,
  SetEnabledMetrics,
  ApplyData,
}

export interface IDAMetrics {
  // Common
  timestamp: number;

  // NodeJS:
  cpu?: NodeJS.CpuUsage;
  memory?: NodeJS.MemoryUsage;
  resourceUsage?: NodeJS.ResourceUsage;

  // Chrome:
  Timestamp?: number;
  AudioHandlers?: number;
  Documents?: number;
  Frames?: number;
  JSEventListeners?: number;
  LayoutObjects?: number;
  MediaKeySessions?: number;
  MediaKeys?: number;
  Nodes?: number;
  Resources?: number;
  ContextLifecycleStateObservers?: number;
  V8PerContextDatas?: number;
  WorkerGlobalScopes?: number;
  UACSSResources?: number;
  RTCPeerConnections?: number;
  ResourceFetchers?: number;
  AdSubframes?: number;
  DetachedScriptStates?: number;
  LayoutCount?: number;
  RecalcStyleCount?: number;
  LayoutDuration?: number;
  RecalcStyleDuration?: number;
  DevToolsCommandDuration?: number;
  ScriptDuration?: number;
  V8CompileDuration?: number;
  TaskDuration?: number;
  TaskOtherDuration?: number;
  ThreadTime?: number;
  JSHeapUsedSize?: number;
  JSHeapTotalSize?: number;
  FirstMeaningfulPaint?: number;
  DomContentLoaded?: number;
  NavigationStart?: number;
}

export interface IAddData {
  type: MessageType.AddData;
  data: IDAMetrics;
}

export interface IUpdateSettingsMessage {
  type: MessageType.UpdateSettings;
  settings: ISettings;
}

export interface ISwitchGraph {
  type: MessageType.SwitchGraph;
  side: 'left' | 'right';
  options: { name: string; key: number }[];
}

export interface ISetEnabledGraphs {
  type: MessageType.SetEnabledMetrics;
  keys: number[];
}

export interface IApplyData {
  type: MessageType.ApplyData;
  data: number[][];
}

export type ToWebViewMessage = IAddData | IUpdateSettingsMessage | IApplyData;
export type FromWebViewMessage = ISwitchGraph | ISetEnabledGraphs;

export const getSteps = (settings: ISettings) =>
  Math.ceil(settings.viewDuration / settings.pollInterval);
