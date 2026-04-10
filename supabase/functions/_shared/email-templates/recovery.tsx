/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="ru" dir="ltr">
    <Head />
    <Preview>Сброс пароля для {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Сброс пароля</Heading>
        <Text style={text}>
          Мы получили запрос на сброс пароля для вашего аккаунта в {siteName}.
          Нажмите кнопку ниже, чтобы выбрать новый пароль.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Сбросить пароль
        </Button>
        <Text style={footer}>
          Если вы не запрашивали сброс, просто проигнорируйте это письмо.
          Ваш пароль не будет изменён.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#5b6abf',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '16px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
