/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/out/**', '**/node_modules/**'],
  },
})
