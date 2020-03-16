/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export const classes = (...classes: ReadonlyArray<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');
