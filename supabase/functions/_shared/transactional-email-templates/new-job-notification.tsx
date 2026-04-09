/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Грузли"

interface NewJobNotificationProps {
  title?: string
  hourlyRate?: string | number
  address?: string
  metro?: string
  startTime?: string
  jobId?: string
}

const NewJobNotificationEmail = ({
  title = 'Новый заказ',
  hourlyRate = '0',
  address,
  metro,
  startTime,
  jobId,
}: NewJobNotificationProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>🆕 Новый заказ: {title} — {hourlyRate}₽/ч</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={logo}>{SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>🆕 Новый заказ</Heading>
        <Section style={card}>
          <Text style={jobTitle}>{title}</Text>
          <Text style={rate}>{hourlyRate} ₽/ч</Text>
          {address && <Text style={detail}>📍 {address}</Text>}
          {metro && <Text style={detail}>🚇 {metro}</Text>}
          {startTime && <Text style={detail}>🕐 Начало: {startTime}</Text>}
        </Section>
        <Text style={text}>
          Откройте приложение, чтобы откликнуться на заказ.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} · Уведомление о новом заказе
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewJobNotificationEmail,
  subject: (data: Record<string, any>) =>
    `🆕 Новый заказ: ${data.title || 'Новый заказ'} — ${data.hourlyRate || ''}₽/ч`,
  displayName: 'Уведомление о новом заказе',
  previewData: {
    title: 'Разгрузка фуры',
    hourlyRate: '350',
    address: 'ул. Ленина 15',
    metro: 'Площадь Революции',
    startTime: '10:00',
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
const jobTitle = { fontSize: '18px', fontWeight: '600', color: '#1a1a2e', margin: '0 0 8px' }
const rate = { fontSize: '20px', fontWeight: 'bold', color: '#4B6BF5', margin: '0 0 12px' }
const detail = { fontSize: '14px', color: '#55575d', margin: '0 0 6px', lineHeight: '1.5' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const hr = { borderColor: '#e2e6f0', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0', textAlign: 'center' as const }
