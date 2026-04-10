/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Подтверждение смены email для {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Смена email</Heading>
        <Text style={text}>
          Вы запросили смену email для {siteName} с{' '}
          <Link href={`mailto:${email}`} style={link}>
            {email}
          </Link>{' '}
          на{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Нажмите кнопку ниже для подтверждения:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Подтвердить смену email
        </Button>
        <Text style={footer}>
          Если вы не запрашивали смену, немедленно защитите свой аккаунт.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1a1d2e',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#5b6abf', textDecoration: 'underline' }
const button = {
  backgroundColor: '#5b6abf',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '16px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
