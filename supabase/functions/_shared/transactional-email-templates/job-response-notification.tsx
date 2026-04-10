/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Грузли"

interface JobResponseNotificationProps {
  workerName?: string
  jobTitle?: string
  message?: string
}

const JobResponseNotificationEmail = ({
  workerName = 'Работник',
  jobTitle = 'Заказ',
  message,
}: JobResponseNotificationProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>👷 {workerName} откликнулся на заказ «{jobTitle}»</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logo}>{SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>👷 Новый отклик на заказ</Heading>
        <Section style={card}>
          <Text style={jobTitleStyle}>📋 {jobTitle}</Text>
          <Text style={worker}>Работник: {workerName}</Text>
          {message && <Text style={msg}>«{message}»</Text>}
        </Section>
        <Text style={text}>
          Откройте приложение, чтобы принять или отклонить отклик.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} · Уведомление об отклике
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JobResponseNotificationEmail,
  subject: (data: Record<string, any>) =>
    `👷 ${data.workerName || 'Работник'} откликнулся на «${data.jobTitle || 'заказ'}»`,
  displayName: 'Уведомление об отклике на заказ',
  previewData: {
    workerName: 'Алексей Смирнов',
    jobTitle: 'Разгрузка фуры',
    message: 'Здравствуйте! Готов обсудить детали.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '520px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const logo = { fontSize: '24px', fontWeight: 'bold', color: '#4B6BF5', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 16px' }
const card = {
  backgroundColor: '#f4f6fb',
  borderRadius: '12px',
  padding: '16px 20px',
  marginBottom: '16px',
  border: '1px solid #e2e6f0',
}
const jobTitleStyle = { fontSize: '16px', fontWeight: '600', color: '#1a1a2e', margin: '0 0 8px' }
const worker = { fontSize: '14px', color: '#4B6BF5', fontWeight: '600', margin: '0 0 8px' }
const msg = { fontSize: '14px', color: '#55575d', fontStyle: 'italic', margin: '0' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const hr = { borderColor: '#e2e6f0', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0', textAlign: 'center' as const }
