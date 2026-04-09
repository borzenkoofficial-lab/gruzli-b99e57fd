/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Грузли"

interface NewMessageNotificationProps {
  senderName?: string
  messageText?: string
}

const NewMessageNotificationEmail = ({
  senderName = 'Пользователь',
  messageText = 'Новое сообщение',
}: NewMessageNotificationProps) => {
  const truncated = messageText.length > 120 ? messageText.slice(0, 120) + '…' : messageText

  return (
    <Html lang="ru" dir="ltr">
      <Head />
      <Preview>💬 {senderName}: {truncated}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>{SITE_NAME}</Text>
          </Section>
          <Heading style={h1}>💬 Новое сообщение</Heading>
          <Section style={card}>
            <Text style={sender}>{senderName}</Text>
            <Text style={message}>{truncated}</Text>
          </Section>
          <Text style={text}>
            Откройте приложение, чтобы ответить.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            {SITE_NAME} · Уведомление о сообщении
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: NewMessageNotificationEmail,
  subject: (data: Record<string, any>) =>
    `💬 ${data.senderName || 'Новое сообщение'}: ${(data.messageText || '').slice(0, 50)}`,
  displayName: 'Уведомление о новом сообщении',
  previewData: {
    senderName: 'Иван Петров',
    messageText: 'Привет! Когда будете на объекте?',
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
const sender = { fontSize: '16px', fontWeight: '600', color: '#1a1a2e', margin: '0 0 8px' }
const message = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0', fontStyle: 'italic' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const hr = { borderColor: '#e2e6f0', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999', margin: '0', textAlign: 'center' as const }
