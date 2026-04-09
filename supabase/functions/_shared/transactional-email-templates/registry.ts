/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as newJobNotification } from './new-job-notification.tsx'
import { template as newMessageNotification } from './new-message-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-job-notification': newJobNotification,
  'new-message-notification': newMessageNotification,
}
